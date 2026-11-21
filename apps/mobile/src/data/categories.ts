import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { CATEGORY_NAME_MAX_LENGTH, categoryBreakdown, type CategoryFigures, type Month } from '@money-tracker/shared';
import type { LocalStore } from '@/db/localStore';
import { categories } from '@/db/schema';
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

/** The data functions behind the Categories screen. Other can't be renamed, moved or archived. */
export function categoryActions(store: LocalStore, db: LocalDb) {
  return {
    /** Adds a Category after the others (Other stays last). Works offline. Returns its ID. */
    add(name: string): string {
      const valid = requireName(name);
      const others = db.select({ order: categories.order, isOther: categories.isOther }).from(categories).where(isNull(categories.deletedAt)).all();
      const order = Math.max(-1, ...others.filter((c) => !c.isOther).map((c) => c.order)) + 1;
      return store.create('category', { name: valid, order, isOther: false, archivedAt: null });
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
      return row.archivedAt === null ? store.update('category', id, { archivedAt: Date.now() }) : false;
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
    .where(and(isNull(categories.deletedAt), isNull(categories.archivedAt)))
    .orderBy(asc(categories.isOther), asc(categories.order), asc(categories.id));
}

/** Live-queryable: Archived Categories, by name. */
export function archivedCategoriesQuery(db: LocalDb) {
  return db
    .select()
    .from(categories)
    .where(and(isNull(categories.deletedAt), isNotNull(categories.archivedAt)))
    .orderBy(asc(categories.name));
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
