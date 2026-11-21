# 12: Kid Profiles, Jars and Top-ups

**What to build:** A parent creates a Kid Profile (during the kid onboarding path or later from Personal), gets Save, Spend and Give Jars, and tops up the Kid Wallet with a split across Jars. They can see the wallet from their own phone.

**Blocked by:** 07 (Personal onboarding and Month overview), 11 (Parent PIN and Parent Area gate).

**Status:** ready-for-agent

- [x] Kid onboarding path: currency, create a Kid Profile (name, optional avatar), set the Parent PIN, then an optional first Top-up.
- [x] Several Kid Profiles can be added from the Personal experience's Parent Area.
- [x] Default Jars are created. In the Parent Area, Jars can be added, renamed and archived.
- [x] Top-up with a split across Jars. The split must add up to the total, checked on the server too, and the last split is remembered (defaulting to all Spend).
- [x] Parents can edit and delete Top-ups.
- [x] The Kid wallet view (Jar balances) uses the Kid theme. Balances are worked out by a shared function with Seam C tests.
- [x] Everything works offline on the parent's device.

## Comments

Built on `ticket/12-kid-profiles-jars-topups`:

- **Shared (Seam C):** sync entities `kidProfile` (name, avatar, archivedAt), `jar` (kidProfileId, name, order, archivedAt) and `kidTransaction` (kidProfileId, kind `topUp`, amount, `splits: { jarId, amount }[]`, date, note). `jarBalances` (`kid/jarBalances.ts`) works out balances; an archived Jar keeps its money. `topUpSplitProblem` (at least one Jar, each share a positive whole number, each Jar once, sum equals the total) runs in `parsePushedChange`, so the server refuses a bad split with a 422 on `splits`. `suggestTopUpSplit` repeats the last split's proportions for a new total, rounds shares down and gives the remainder to Spend (design flaw 8). An archived Jar's share also goes to Spend; if Spend itself is archived, the first Jar takes its place. `DEFAULT_JAR_KEYS` and `defaultJarId(accountId, kidProfileId, key)` (deterministic, like `defaultCategoryId`), so Spend is still known after a rename.
- **API (Seam A, `test/kidWallet.test.ts`):** `KidProfile`, `Jar` and `KidTransaction` collections and sync rules. A Jar's and a Top-up's Kid Profile must belong to this Account. A new `checkWallets` step requires every Jar named in a split to be this Account's Jar of the same Kid Profile (stored, or pushed in the same sync). A Kid Session still can't write any of these (403). `kidCanRead` stays false for ticket 14.
- **Mobile (Seam B, `src/sync/kidWallet.seamB.test.ts`):** migration 3 (`kid_profiles`, `jars`, `kid_transactions`; splits stored as JSON). `localStore` gains `newId()`, and `update` accepts `(now) => changes`. `src/data/kidWallet.ts` holds `completeKidOnboarding` (currency, default Categories through the shared `accountBasics` so the Personal Budget exists later, and the Kid Profile with its Jars, in one transaction), `createKidProfile`, `addJar`/`renameJar`/`archiveJar`, `addTopUp`/`editTopUp`/`deleteTopUp` (a split that doesn't add up is refused locally and nothing is saved), and the live queries plus `walletOf`, `suggestedSplitOf` and `topUpJarsOf`. The last split is the newest Top-up's, so it syncs and every parent device suggests the same split. The tests cover offline kid onboarding, a second device, several kids, split Top-ups, a refused split, the remembered split (also on the tablet), adding, renaming and archiving Jars, and editing and deleting Top-ups offline.
- **Screens:** the kid path is now Who is it for → currency (`?path=kid`, "Step N of 5") → `onboarding/kid` (name and optional emoji avatar; this records onboarding) → `/pin/set?next=/onboarding/kid-top-up?kid=…` (skipped if the Account already has a PIN) → `onboarding/kid-top-up` (optional, with Skip) → the kid's wallet. The old stub and its `kidSoon*` strings are gone. In the Parent Area (`app/parent/index.tsx`) each kid shows as a card with its total and Jar tiles, next to Add a kid, Change PIN and Lock. `parent/kids/new` adds a kid. `parent/kids/[id]` is the wallet in the Kid theme: the green "In the wallet" card, Jar rows, Top up, Manage jars, and the list of Top-ups (tap one to edit). `parent/kids/[id]/top-up` adds a Top-up, or edits or deletes one with `topUpId`. One keypad types the total, or a Jar's share once that Jar is tapped. Percentages are for display only. A mismatch shows the sum in red with Reset split, and Save stays disabled until the shares add up. `parent/kids/[id]/jars` renames, archives (the last live Jar can't be archived) and adds Jars. Icons come from the custom set (`app:jar-save`, `app:shopping-spend`, `app:gift-give`, `app:kids`, `app:income-money`, `app:add`, `app:lock-pin`, `app:delete`). EN and AR strings are under `kid.*`.

**Left over / notes:**
- A Kid Expense or Jar Transfer is ticket 13. `KidTransactionKind` is only `topUp`, so 13 extends the parser, model enum, `jarBalances` and the local table (expense Jar, transfer Jars). The "went below zero" banner is also 13.
- Jars the parent adds share one icon and the primary color. Kid Profiles have no order field and are listed oldest first (UUIDv7 order). There is no unarchive for Jars yet.
- Top-ups are dated today. There is no date or note field on the Top-up screen; the data layer accepts both.
- The "% · amount" text on split rows isn't run through `Intl` percent formatting. Check it in RTL.
- Archiving a Kid Profile is ticket 18.

**Human follow-up:**
- No new native modules, but a dev build from before the custom icon set (`react-native-svg`) needs rebuilding anyway.
- Deploy the API (new collections, plus the split and wallet checks on `/sync`).
- Manual device check in English and Arabic (RTL): the kid onboarding path from a new Account (with and without biometrics enrolled), offline too; adding a second kid; a split Top-up, editing a share so it doesn't add up, Reset split; editing and deleting a Top-up; renaming, archiving and adding Jars; the Kid-theme wallet screen; a second phone showing the same balances after sync.
