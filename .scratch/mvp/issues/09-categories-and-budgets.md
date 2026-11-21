# 09: Categories and Category Budgets

**What to build:** An adult shapes their Categories and sets a Category Budget for each Month. The home screen shows each Category's budget, amount spent and amount remaining.

**Blocked by:** 07 (Personal onboarding and Month overview).

**Status:** resolved

- [x] Categories can be added, renamed and reordered. They can be archived (hidden from new Months, kept in history), except Other.
- [x] A Category Budget can be set per Month. Category Budgets use a deterministic ID worked out from the Account, Month and Category.
- [x] The per-Category breakdown shows budget, spent and remaining, worked out by shared functions with Seam C tests.
- [x] Expected Income for the current Month can be edited, and Unallocated updates.

## Comments

Built on `ticket/09-categories-and-budgets`:

- **Shared (Seam C):** `categoryBreakdown` (`budget/categoryBreakdown.ts`) gives each Category's budget, spent and remaining for a Month, in display order with Other always last. A Category with no Category Budget counts as 0. Only the Month's Expenses count; Income doesn't. An Archived Category is left out of a Month where it has no budget and no spending, and stays in Months where it had either. That rule is how "hidden from new Months, kept in history" works. `CATEGORY_NAME_MAX_LENGTH` (60) is now shared by the sync parser and the app.
- **API (Seam A):** `sync.service.ts` `checkOtherCategory` sends back a 422 when a push archives or deletes Other, clears its Other flag, or flags any other ID as Other. Other edits to Other are still accepted.
- **Mobile (Seam B, `src/sync/categories.seamB.test.ts`):** `src/data/categories.ts` has `categoryActions(store, db)` with `add` (trimmed name; goes after the others, before Other), `rename`, `reorder(ids)` (only rows whose order changed are written), `archive` and `restore`. Other can't be renamed, reordered or archived. It also has `categoryNameOf`, `activeCategoriesQuery`, `archivedCategoriesQuery`, `allCategoriesQuery` and `readCategoryBreakdown`. Category Budgets reuse ticket 07's `setCategoryBudgets` and `categoryBudgetId`. The tests cover: adding offline and syncing, invalid names, a rename keeping Expenses attached, reorder on two devices, archive and restore (with history kept), the Other rules, two devices setting the same budget offline (one record, later edit wins), budgets for each Month, and Expected Income changing Unallocated.
- **Screens:** `app/categories/index.tsx` (PDF page 7) names the Month (design flaw 7) and shows Expected Income and Unallocated. Tapping that card goes to `app/categories/income.tsx`, a keypad edit of the Month's Expected Income. Below it is each active Category with its budget and up/down buttons (instead of the mockup's drag handle, so no gesture library and it works with screen readers). Other has a lock icon. An Archived section has Restore. Then "Add category". `app/categories/edit.tsx` adds a Category, or renames it, sets its budget for the Month and archives it. For Other it only sets the budget. On home, under the tiles, a Categories card shows a `ProgressRow` per Category: "X left" or "X over", a progress bar (red when over) and `spent / budget` in a direction isolate. The new `useMonthBudget(month)` hook feeds both home and the Categories screen.

- **Custom icons:** `categoryIconFor` now returns the `app:` icons (housing, food-groceries, transport, bills-utilities, health, shopping-spend, entertainment, kids, other). Unallocated uses `app:unallocated` (on home and the Categories screen) and switches to `app:gentle-warning` when negative. The over-plan Notice shows `app:gentle-warning`, and `Notice.icon` now takes a `GlyphName`. Other's lock is `app:lock-pin` and Add is `app:add`. Ionicons are still used where the set has no match: Categories the adult adds (tag), the edit pencil, the reorder chevrons and Archive.

**Left over / notes for other tickets:**
- `archive` stamps `archivedAt` with `Date.now()` rather than the store's clock. It is only a marker, but say so if that matters.
- Archiving a Category that has a budget this Month keeps it on this Month's breakdown, because the Month still holds that budget. Ticket 10's "copy the previous Month" should skip the Category Budgets of Archived Categories, so they don't come back next Month.
- Ticket 08's Category picker should list `activeCategoriesQuery` (no Archived Categories) instead of `categoriesQuery`.
- Category names aren't checked for duplicates.
- Last edit wins is per record. A rename on one device and a reorder of the same Category on another device keep only the later edit.

**Human follow-up:**
- Check on a device, in English and Arabic: add, rename, reorder (the arrows in RTL), archive and restore; set budgets; edit Expected Income and see Unallocated and the over-plan notice change; the home rows' "left/over" text and the `spent / budget` caption in RTL.
- Deploy the API (the new Other checks on `/sync`).
