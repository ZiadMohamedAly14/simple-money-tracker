/**
 * Seam B: one simulated device. The app's real auth session, local store and
 * sync engine, on an in-memory better-sqlite3 database. Test-only.
 */
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createApiClient } from '@/api/client';
import { requestCode, verifyCode } from '@/api/auth';
import { createAccountDeletion } from '@/auth/accountDeletion';
import { createAuthSession, type AuthSession, type AuthedResult, type ElevateResult } from '@/auth/authSession';
import type { SessionStore, StoredSession } from '@/auth/tokenStore';
import {
  accountSettingsQuery,
  categoryBudgetsQuery,
  changeAccountSettings,
  completePersonalOnboarding,
  type AccountSettingsChanges,
  monthPlansQuery,
  openMonth,
  readMonthOverview,
  setCategoryBudgets,
  setExpectedIncome,
  type PersonalOnboarding,
} from '@/data/budget';
import {
  categoriesQuery,
  deleteTransaction,
  deleteTransactions,
  editExpense,
  editIncome,
  expensesQuery,
  monthTransactionListQuery,
  recordExpense,
  recordIncome,
  type ExpenseChanges,
  type IncomeChanges,
  type NewExpense,
  type NewIncome,
} from '@/data/transactions';
import {
  addJar,
  addJarTransfer,
  addKidExpense,
  addTopUp,
  archiveJar,
  archiveKidProfile,
  archivedKidProfilesQuery,
  completeKidOnboarding,
  createKidProfile,
  deleteJarTransfer,
  deleteKidExpense,
  deleteTopUp,
  editJarTransfer,
  editKidExpense,
  editTopUp,
  jarsQuery,
  kidProfilesQuery,
  kidTransactionsQuery,
  renameJar,
  restoreKidProfile,
  suggestedSplitOf,
  topUpJarsOf,
  walletOf,
  type JarTransferChanges,
  type KidExpenseChanges,
  type KidOnboarding,
  type NewJarTransfer,
  type NewKidExpense,
  type NewKidProfile,
  type NewTopUp,
  type TopUpChanges,
} from '@/data/kidWallet';
import {
  activeCategoriesQuery,
  allCategoriesQuery,
  archivedCategoriesQuery,
  categoryActions,
  categoryChoicesQuery,
  categoryDeletionImpact,
  isLastActiveCategory,
  readCategoryBreakdown,
  shownCategoryOf,
} from '@/data/categories';
import { createLocalStore } from '@/db/localStore';
import { migrate } from '@/db/migrations';
import { SYNCED_TABLES, schema } from '@/db/schema';
import { leaveKidMode, setUpKidDevice, type KidDeviceChoice } from '@/kid/kidDeviceSetup';
import { listKidDevices, revokeKidDevice } from '@/kid/kidDevices';
import type { LocalDb } from '@/db/types';
import { isSyncOverdue } from '@/sync/pendingSync';
import { createSyncEngine, kidSessionHoldsBack, type SyncOutcome } from '@/sync/syncEngine';
import { createSyncTriggers } from '@/sync/syncTriggers';
import {
  createParentPinGate,
  forgetPinOnSignOutOrKidMode,
  type Biometrics,
  type ParentPinGate,
  type PinGateState,
  type PinGateStore,
} from '@/pin/parentPinGate';
import { SYNC_ENTITIES, defaultJarId, type SyncEntity } from '@money-tracker/shared';
import type { AxiosRequestConfig } from 'axios';
import type { TestServer } from './testServer';

/** Holds the session in memory, the way SecureStore would on a device. */
function memorySessionStore(initial: StoredSession | null = null): SessionStore {
  let current = initial;
  return {
    load: async () => current,
    save: async (session) => {
      current = session;
    },
    clear: async () => {
      current = null;
    },
  };
}

function memoryPinGateStore(): PinGateStore {
  let current: PinGateState | null = null;
  return {
    load: async () => current,
    save: async (state) => {
      current = state;
    },
    clear: async () => {
      current = null;
    },
  };
}

/** A device clock that only moves when told to, so tests decide which edit is later. */
export function createDeviceClock(start = Date.parse('2026-03-01T09:00:00Z')) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

export interface TestDeviceOptions {
  /** The device clock (Unix ms); real time by default. */
  now?: () => number;
  /** Page size the device asks for when pulling; the server's default otherwise. */
  pullLimit?: number;
  /** Sync after local writes on its own, the way the app does (real timers). */
  autoSync?: boolean;
}

export async function createTestDevice(
  server: TestServer,
  { now = Date.now, pullLimit, autoSync = false }: TestDeviceOptions = {},
) {
  const db: LocalDb = drizzle(new Database(':memory:'), { schema });
  migrate(db);
  const store = createLocalStore({ db, now, randomBytes: (n) => new Uint8Array(randomBytes(n)) });
  const client = createApiClient(server.url);
  let online = true;

  async function startAuth(sessionStore: SessionStore): Promise<AuthSession> {
    const session = createAuthSession({ client, store: sessionStore, localData: store, now: () => clock });
    await session.start();
    return session;
  }

  // The device clock for the PIN gate and PIN elevation; `advanceClock` moves it.
  let clock = Date.now();
  let sessionStore = memorySessionStore();
  let auth = await startAuth(sessionStore);
  const request = (config: AxiosRequestConfig): Promise<AuthedResult> =>
    online ? auth.request(config) : Promise.resolve({ status: 'unreachable' });
  const engine = createSyncEngine({
    store,
    request,
    pullLimit,
    holdBack: (change) => auth.kidProfileId() !== null && !auth.elevated() && kidSessionHoldsBack(change),
  });
  // The Parent PIN gate: its store outlives app restarts, like SecureStore.
  const triggers = createSyncTriggers({ sync: engine.sync });
  const stopListening = autoSync ? store.onWrite(triggers.localWrite) : () => undefined;

  const pinStore = memoryPinGateStore();
  const biometrics = { enrolled: true, nextResult: true };
  const fakeBiometrics: Biometrics = {
    isEnrolled: async () => biometrics.enrolled,
    authenticate: async () => biometrics.nextResult,
  };
  const startPinGate = (): ParentPinGate => {
    const gate = createParentPinGate({
      request,
      accountId: () => auth.account()?.id ?? null,
      store: pinStore,
      biometrics: fakeBiometrics,
      now: () => clock,
    });
    forgetPinOnSignOutOrKidMode(auth, gate);
    return gate;
  };
  let pinGate = startPinGate();
  const categoryActionsOf = categoryActions(store, db);
  const accountDeletion = createAccountDeletion({ request, auth: { forget: () => auth.forget() } });

  return {
    store,
    accountId: () => store.accountId(),

    /** Signs in with an emailed code, like the sign-in screens do. */
    async signIn(email: string): Promise<void> {
      server.nextMinute();
      const sent = await requestCode(client, email, 'en');
      if (sent.status !== 'ok') throw new Error(`requestCode: ${JSON.stringify(sent)}`);
      const verified = await verifyCode(client, { email, code: server.mailer.lastCodeFor(email) });
      if (verified.status !== 'ok') throw new Error(`verifyCode: ${JSON.stringify(verified)}`);
      await auth.signedIn(verified.data);
    },

    signOut: () => auth.signOut(),
    /** Whether the device is signed in, out, or waiting for a new code. */
    authStatus: () => auth.status(),
    /** Settings → Delete account: email a code, then confirm with it. */
    requestDeletionCode: () => accountDeletion.requestCode('en'),
    deleteAccount: (code: string) => accountDeletion.confirm(code),

    /** The app restarting with `account` in SecureStore (e.g. changed while the local DB was kept). */
    async restartAs(account: StoredSession['account']): Promise<void> {
      sessionStore = memorySessionStore({ account, tokens: null });
      auth = await startAuth(sessionStore);
    },

    /** The app restarting: the same SecureStore and local database. */
    async restartApp(): Promise<void> {
      auth = await startAuth(sessionStore);
      pinGate = startPinGate();
    },

    /** An authenticated API call, the way any part of the app makes one. */
    request,

    /** The kid's phone setup step (after sign-in and picking a Kid Profile). */
    setUpKidDevice: (choice: KidDeviceChoice) => setUpKidDevice({ auth, sync: engine.sync }, choice),
    /** Entering the Parent PIN on a Kid-Mode device, as the Parent Area gate does. */
    elevate: (pin: string): Promise<ElevateResult> => (online ? auth.elevate(pin) : Promise.resolve({ status: 'unreachable' })),
    elevated: () => auth.elevated(),
    leaveKidMode: () => leaveKidMode({ auth, sync: engine.sync }),
    kidDevices: () => listKidDevices(request),
    revokeKidDevice: (id: string) => revokeKidDevice(request, id),
    /** The Kid Profile this device is in Kid Mode for (from the stored session), or null. */
    kidProfileId: () => auth.kidProfileId(),
    /** Every record in the local database, live or deleted, with its Kid Profile where it has one. */
    heldRecords: (): { entity: SyncEntity; id: string; kidProfileId?: string }[] =>
      SYNC_ENTITIES.flatMap((entity) =>
        (db.select().from(SYNCED_TABLES[entity]).all() as { id: string; kidProfileId?: string }[]).map((row) => ({
          entity,
          id: row.id,
          ...(entity === 'kidProfile' ? { kidProfileId: row.id } : row.kidProfileId ? { kidProfileId: row.kidProfileId } : {}),
        })),
      ),

    goOffline: () => {
      online = false;
    },
    goOnline: () => {
      online = true;
    },
    sync: (): Promise<SyncOutcome> => engine.sync(),
    stopAutoSync: () => {
      stopListening();
      triggers.stop();
    },
    /** Whether the app would show the pending-sync indicator now. */
    syncOverdue: () => isSyncOverdue(store.oldestPendingAt(), now()),

    recordExpense: (expense: NewExpense) => recordExpense(store, db, expense),
    editExpense: (id: string, changes: ExpenseChanges) => editExpense(store, db, id, changes),
    editIncome: (id: string, changes: IncomeChanges) => editIncome(store, db, id, changes),
    deleteTransaction: (id: string) => deleteTransaction(store, id),
    deleteTransactions: (ids: readonly string[]) => deleteTransactions(store, ids),
    expenses: () => expensesQuery(db).all(),
    recordIncome: (income: NewIncome) => recordIncome(store, db, income),
    monthTransactions: (month: string) => monthTransactionListQuery(db, month).all(),
    categories: () => categoriesQuery(db).all(),
    categoryChoices: () => categoryChoicesQuery(db).all(),
    pendingChanges: () => store.pendingCount(),

    onboarding: () => store.onboarding(),
    onboardPersonal: (choices: PersonalOnboarding) => completePersonalOnboarding(store, choices),
    setExpectedIncome: (month: string, amount: number) => setExpectedIncome(store, month, amount),
    setCategoryBudgets: (month: string, amounts: Record<string, number>) => setCategoryBudgets(store, month, amounts),
    accountSettings: () => accountSettingsQuery(db).get(),
    changeAccountSettings: (changes: AccountSettingsChanges) => changeAccountSettings(store, db, changes),
    monthPlans: () => monthPlansQuery(db).all(),
    openMonth: (month: string) => openMonth(store, db, month),
    monthOverview: (month: string) => readMonthOverview(db, month),
    categoryBudgets: (month: string) => categoryBudgetsQuery(db, month).all(),

    addCategory: (name: string, icon?: string) => categoryActionsOf.add(name, icon),
    setCategoryIcon: (id: string, icon: string) => categoryActionsOf.setIcon(id, icon),
    deleteCategory: (id: string) => categoryActionsOf.remove(id),
    categoryDeletionImpact: (id: string, month: string) => categoryDeletionImpact(db, id, month),
    isLastActiveCategory: (id: string) => isLastActiveCategory(db, id),
    /** The Category an Expense filed under `categoryId` shows as: Other if that Category is deleted. */
    shownCategory: (categoryId: string) => shownCategoryOf(allCategoriesQuery(db).all())(categoryId),
    renameCategory: (id: string, name: string) => categoryActionsOf.rename(id, name),
    reorderCategories: (ids: readonly string[]) => categoryActionsOf.reorder(ids),
    archiveCategory: (id: string) => categoryActionsOf.archive(id),
    restoreCategory: (id: string) => categoryActionsOf.restore(id),
    activeCategories: () => activeCategoriesQuery(db).all(),
    archivedCategories: () => archivedCategoriesQuery(db).all(),
    categoryBreakdown: (month: string) => readCategoryBreakdown(db, month),

    onboardKid: (choices: KidOnboarding) => completeKidOnboarding(store, choices),
    createKidProfile: (kid: NewKidProfile) => createKidProfile(store, kid),
    kidProfiles: () => kidProfilesQuery(db).all(),
    archiveKidProfile: (id: string) => archiveKidProfile(store, db, id),
    restoreKidProfile: (id: string) => restoreKidProfile(store, db, id),
    archivedKidProfiles: () => archivedKidProfilesQuery(db).all(),
    /** The default Jars' IDs for a Kid Profile. */
    jarIds: (kidProfileId: string) => {
      const accountId = store.accountId()!;
      return {
        save: defaultJarId(accountId, kidProfileId, 'save'),
        spend: defaultJarId(accountId, kidProfileId, 'spend'),
        give: defaultJarId(accountId, kidProfileId, 'give'),
      };
    },
    addJar: (kidProfileId: string, name: string) =>
      addJar(store, kidProfileId, name, Math.max(-1, ...jarsQuery(db, kidProfileId).all().map((j) => j.order)) + 1),
    renameJar: (jarId: string, name: string) => renameJar(store, jarId, name),
    archiveJar: (jarId: string) => archiveJar(store, jarId),
    topUpJars: (kidProfileId: string) => topUpJarsOf(jarsQuery(db, kidProfileId).all()),
    addTopUp: (topUp: NewTopUp) => addTopUp(store, topUp),
    editTopUp: (id: string, changes: TopUpChanges) => editTopUp(store, db, id, changes),
    deleteTopUp: (id: string) => deleteTopUp(store, id),
    topUps: (kidProfileId: string) => kidTransactionsQuery(db, kidProfileId).all(),
    addKidExpense: (expense: NewKidExpense) => addKidExpense(store, db, expense),
    editKidExpense: (id: string, changes: KidExpenseChanges) => editKidExpense(store, db, id, changes),
    deleteKidExpense: (id: string) => deleteKidExpense(store, db, id),
    addJarTransfer: (transfer: NewJarTransfer) => addJarTransfer(store, db, transfer),
    editJarTransfer: (id: string, changes: JarTransferChanges) => editJarTransfer(store, db, id, changes),
    deleteJarTransfer: (id: string) => deleteJarTransfer(store, db, id),
    /** The Kid Wallet's history: every live Kid Transaction, newest first. */
    history: (kidProfileId: string) => kidTransactionsQuery(db, kidProfileId).all(),
    wallet: (kidProfileId: string) =>
      walletOf(store.accountId(), jarsQuery(db, kidProfileId).all(), kidTransactionsQuery(db, kidProfileId).all()),
    suggestedSplit: (kidProfileId: string, total: number) =>
      suggestedSplitOf(
        store.accountId()!,
        kidProfileId,
        jarsQuery(db, kidProfileId).all(),
        kidTransactionsQuery(db, kidProfileId).all(),
        total,
      ),

    get pinGate(): ParentPinGate {
      return pinGate;
    },
    /** The app restarting: a new gate over the same stored state. */
    restartPinGate: () => {
      pinGate = startPinGate();
    },
    /** Set `enrolled` / `nextResult` to change what the device's biometrics do. */
    biometrics,
    advanceClock: (ms: number) => {
      clock += ms;
    },
  };
}

export type TestDevice = Awaited<ReturnType<typeof createTestDevice>>;
