import { and, asc, count, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import {
  CATEGORY_NAME_MAX_LENGTH,
  categoryBreakdown,
  guessCategoryIcon,
  isCategoryIconName,
  type CategoryFigures,
  type Month,
} from '@money-tracker/shared';
import type { LocalStore } from '@/db/localStore';
import { categories, categoryBudgets, transactions } from '@/db/schema';
import type { LocalDb } from '@/db/types';
import { categoryBudgetsQuery, monthTransactionsQuery } from './budget';

/** A Category name as saved: trimmed, 1 to `CATEGORY_NAME_MAX_LENGTH` characters; null if it isn't valid. */
export function categoryNameOf(input: string): string | null {
  const name = input.trim();
  return name.length > 0 && name.length <= CATEGORY_NAME_MAX_LENGTH ? name : null;
}

function requireName(input: string): string {
  const name = categoryNameOf(input);
  if (name === null) throw new Error(`A Category name must be 1 to ${CATEGORY_NAME_MAX_LENGTH} characters`);
  return name;
}

type CategoryRow = typeof categories.$inferSelect;

function findCategory(db: LocalDb, id: string): CategoryRow {
  const row = db.select().from(categories).where(and(eq(categories.id, id), isNull(categories.deletedAt))).get();
  if (!row) throw new Error(`No Category ${id}`);
  return row;
}

function requireNotOther(row: CategoryRow): void {
  if (row.isOther) throw new Error('The Other Category always exists as it is');
}

function requireIcon(icon: string): string {
  if (!isCategoryIconName(icon)) throw new Error(`Not a Category icon name: ${icon}`);
  return icon;
}

/**
 * True when `id` is the only active (not Archived, not deleted) Category
 * besides Other. It can then be neither archived nor deleted: the app always
 * keeps at least one real Category.
 */
export function isLastActiveCategory(db: LocalDb, id: string): boolean {
  const row = db.select().from(categories).where(and(eq(categories.id, id), isNull(categories.deletedAt))).get();
  if (!row || row.isOther || row.archivedAt !== null) return false;
  const active = db.select({ n: count() }).from(categories).where(and(isActive(), eq(categories.isOther, false))).get();
  return (active?.n ?? 0) <= 1;
}

function requireNotLast(db: LocalDb, id: string): void {
  if (isLastActiveCategory(db, id)) throw new Error('The last Category besides Other can’t be archived or deleted');
}

/** What deleting a Category would do, for its confirmation. */
export interface CategoryDeletionImpact {
  /** Its Expenses, in every Month, that will show as Other. */
  expenseCount: number;
  /** It has a budget above 0 in the Month on screen, which goes back to Unallocated. */
  hasBudgetThisMonth: boolean;
}

export function categoryDeletionImpact(db: LocalDb, id: string, month: Month): CategoryDeletionImpact {
  const expenses = db
    .select({ n: count() })
    .from(transactions)
    .where(and(eq(transactions.categoryId, id), eq(transactions.kind, 'expense'), isNull(transactions.deletedAt)))
    .get();
  const budget = db
    .select({ id: categoryBudgets.id })
    .from(categoryBudgets)
    .where(
      and(
        eq(categoryBudgets.categoryId, id),
        eq(categoryBudgets.month, month),
        gt(categoryBudgets.amount, 0),
        isNull(categoryBudgets.deletedAt),
      ),
    )
    .get();
  return { expenseCount: expenses?.n ?? 0, hasBudgetThisMonth: budget !== undefined };
}

/**
 * The data functions behind the Categories screen. Other can't be renamed,
 * moved, archived, deleted or given another icon. The last active Category
 * besides Other can't be archived or deleted.
 */
export function categoryActions(store: LocalStore, db: LocalDb) {
  return {
    /**
     * Adds a Category after the others (Other stays last). Its icon is the one
     * picked, or else guessed from the name. Works offline. Returns its ID.
     */
    add(name: string, icon?: string): string {
      const valid = requireName(name);
      const others = db.select({ order: categories.order, isOther: categories.isOther }).from(categories).where(isNull(categories.deletedAt)).all();
      const order = Math.max(-1, ...others.filter((c) => !c.isOther).map((c) => c.order)) + 1;
      return store.create('category', {
        name: valid,
        order,
        isOther: false,
        archivedAt: null,
        icon: icon === undefined ? guessCategoryIcon(valid) : requireIcon(icon),
      });
    },

    /** Changes a Category's icon (an icon name such as `housing`). */
    setIcon(id: string, icon: string): boolean {
      const valid = requireIcon(icon);
      requireNotOther(findCategory(db, id));
      return store.update('category', id, { icon: valid });
    },

    /** Renames a Category. Its ID stays, so its Expenses and Category Budgets follow it. */
    rename(id: string, name: string): boolean {
      const valid = requireName(name);
      requireNotOther(findCategory(db, id));
      return store.update('category', id, { name: valid });
    },

    /** Puts the given Categories in this order (Other is always last and may not be listed). */
    reorder(ids: readonly string[]): void {
      const rows = ids.map((id) => findCategory(db, id));
      rows.forEach(requireNotOther);
      rows.forEach((row, order) => {
        if (row.order !== order) store.update('category', row.id, { order });
      });
    },

    /** Hides a Category from the active list and new Months; Months where it was used keep it. */
    archive(id: string): boolean {
      const row = findCategory(db, id);
      requireNotOther(row);
      requireNotLast(db, id);
      return row.archivedAt === null ? store.update('category', id, { archivedAt: Date.now() }) : false;
    },

    /**
     * Deletes a Category (ADR-0001: the deletion marker beats any edit) and its
     * Category Budgets in every Month, all at once. Its Expenses aren't
     * rewritten: they show as Other wherever they appear. Can't be undone.
     */
    remove(id: string): boolean {
      const row = findCategory(db, id);
      requireNotOther(row);
      requireNotLast(db, id);
      const budgets = db
        .select({ id: categoryBudgets.id })
        .from(categoryBudgets)
        .where(and(eq(categoryBudgets.categoryId, id), isNull(categoryBudgets.deletedAt)))
        .all();
      return (
        store.removeAll([
          { entity: 'category', id },
          ...budgets.map((b) => ({ entity: 'categoryBudget' as const, id: b.id })),
        ]) > 0
      );
    },

    /** Brings an Archived Category back to the active list. */
    restore(id: string): boolean {
      const row = findCategory(db, id);
      return row.archivedAt !== null ? store.update('category', id, { archivedAt: null }) : false;
    },
  };
}

/** Live-queryable: the Categories new Expenses and Months use, in display order (Other last). */
export function activeCategoriesQuery(db: LocalDb) {
  return db
    .select()
    .from(categories)
    .where(isActive())
    .orderBy(asc(categories.isOther), asc(categories.order), asc(categories.id));
}

/** Not deleted and not Archived. */
const isActive = () => and(isNull(categories.deletedAt), isNull(categories.archivedAt));

/**
 * Live-queryable: the Category chips when recording an Expense. The active
 * Categories (as `activeCategoriesQuery`), most recently recorded-against
 * first (by the Expense's UUIDv7 ID, which sorts by when it was recorded, on
 * whichever device), then the never-used ones in display order, Other last.
 * An Expense whose Category is deleted counts as a use of Other, as it shows
 * under Other everywhere else.
 */
export function categoryChoicesQuery(db: LocalDb) {
  const lastUse = sql`(
    select max(${transactions.id}) from ${transactions}
    where ${transactions.kind} = 'expense'
      and ${transactions.deletedAt} is null
      and (
        ${transactions.categoryId} = ${categories.id}
        or (${categories.isOther} = 1 and not exists (
          select 1 from ${categories} as live
          where live.id = ${transactions.categoryId} and live.deleted_at is null
        ))
      )
  )`;
  return db
    .select()
    .from(categories)
    .where(isActive())
    .orderBy(sql`${lastUse} desc nulls last`, asc(categories.isOther), asc(categories.order), asc(categories.id));
}

/** Live-queryable: Archived Categories, by name. */
export function archivedCategoriesQuery(db: LocalDb) {
  return db
    .select()
    .from(categories)
    .where(and(isNull(categories.deletedAt), isNotNull(categories.archivedAt)))
    .orderBy(asc(categories.name));
}

/**
 * Which Category an Expense shows under, from the live Categories
 * (`allCategoriesQuery`): its own, or Other if its Category is deleted.
 */
export function shownCategoryOf<C extends { id: string; isOther: boolean }>(live: readonly C[]) {
  const byId = new Map(live.map((c) => [c.id, c]));
  const other = live.find((c) => c.isOther);
  return (categoryId: string): C | undefined => byId.get(categoryId) ?? other;
}

/** Live-queryable: every Category, archived ones included (for a Month's breakdown). */
export function allCategoriesQuery(db: LocalDb) {
  return db.select().from(categories).where(isNull(categories.deletedAt));
}

/** A Month's per-Category breakdown, read once (tests; screens use the live queries with `categoryBreakdown`). */
export function readCategoryBreakdown(db: LocalDb, month: Month): CategoryFigures[] {
  return categoryBreakdown({
    month,
    categories: allCategoriesQuery(db).all(),
    budgets: categoryBudgetsQuery(db, month).all(),
    transactions: monthTransactionsQuery(db, month).all(),
  });
}
