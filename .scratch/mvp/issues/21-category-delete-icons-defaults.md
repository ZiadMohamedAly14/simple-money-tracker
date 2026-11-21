# 21: Delete Categories, keep at least one, smarter icons, fewer defaults

**What to build:** Adults can delete a Category, not only archive it. The app always keeps at least one real Category besides Other. A new Category gets a sensible icon guessed from its name, which the adult can change. New Accounts start with fewer default Categories. Decided with the user in a grilling session on 2026-11-21.

**Blocked by:** 09 (Categories and Category Budgets).

**Status:** resolved

- [x] **Delete** is on the Category edit screen and on rows in the Archived section. Other never shows it.
- [x] Deleting a Category with no Expenses asks a plain "Delete 'X'?" confirmation.
- [x] Deleting a Category with Expenses shows a confirmation in English and Arabic saying:
  - how many Expenses (counted across all Months) will move to **Other**, and that spending totals won't change;
  - only if it has a budget this Month: that this Month's budget goes back to Unallocated;
  - that this can't be undone, and that **Archive** hides it but keeps its history.

  Buttons: **[Archive instead] [Delete]**. There is no undo after deleting.
- [x] Deleting marks the Category deleted, using the existing deletion marker that beats any edit (ADR-0001), and deletes its Category Budgets in every Month.
- [x] **Moving to Other happens at display time only.** Any Expense whose Category is deleted counts and shows as Other everywhere: Month breakdown, totals, Transaction list, Category chips and the edit screen's picker. Expense records are not rewritten. Saving such an Expense files it under Other. Seam B scenario: phone A deletes a Category while phone B records an Expense into it offline; after both sync, both show that Expense under Other with correct totals.
- [x] **Minimum rule:** the last active Category that isn't Other can't be deleted or archived. Both buttons are disabled with a short reason. Enforce it in the data layer too, not only in the UI.
- [x] **Category icon field:** each Category record gets a synced `icon` (an `app:` icon name).
  - The sync contract and server accept any short kebab-case string (no fixed list), so a newer app's icon never gets a sync refused.
  - The app shows `tag` for a name it doesn't know, and for older records with no icon it falls back to today's mapping (default IDs, otherwise `tag`).
  - Other always shows `other`.
- [x] **Icon guess:** while adding a Category, the icon follows the typed name.
  - It uses an English and Arabic keyword list in shared code, with Seam C tests. Examples: rent/إيجار → housing, gym/doctor/دواء → health, uber/fuel → transport, netflix → entertainment, school → kids, supermarket/سوبرماركت → food-groceries.
  - It stops following once the adult picks an icon by hand. Renaming an existing Category never changes its icon. No match means `tag`.
- [x] **Icon picker** on the add and edit screens: a grid of food-groceries, bills-utilities, monthly-bills, shopping-spend, housing, transport, health, entertainment, kids, personal, gift-give, charity-hand-coin, wallet, jar-save and tag. The current one is marked with `selected`.
- [x] **Defaults:** new Accounts get Food & groceries, Bills & utilities, Shopping, and Other, in both personal and kid onboarding, with each default's icon set. Existing Accounts are not changed (no real users yet).
- [x] **Docs:** add "Deleted" to the Category entry in `GLOSSARY.md` (its Expenses show as Other; its budgets are removed). Update the spec's Category rules (`.scratch/mvp/spec.md`, the business rules and data sections) to match.

## Comments

Built on `ticket/21-category-delete-icons-defaults`:

- **Shared (Seam C):** `guessCategoryIcon(name)` (`budget/categoryIcon.ts`) with an English and Arabic keyword list. English keywords match whole words (so "Scarves" isn't "car"); Arabic matching ignores "ال" and the usual spelling variants (أ/إ/آ, ة/ه, ى/ي, diacritics). No match gives `tag`. The same file has `CATEGORY_ICON_CHOICES` (the picker's 15 icons), `isCategoryIconName` (short kebab-case, up to 40 characters) and `OTHER_CATEGORY_ICON`. `CategoryFields.icon` (`string | null`) is in the sync contract: any kebab-case name is accepted, and a missing icon (an older app) reads as null. `OTHER_CATEGORY` now carries `icon: 'other'`. `categoryBreakdown` counts an Expense whose Category isn't among the live Categories under Other. `DEFAULT_CATEGORY_KEYS` is now `food`, `bills`, `shopping`, with `DEFAULT_CATEGORY_ICONS`. `EARLIER_DEFAULT_CATEGORY_ICONS` keeps the eight old keys, so records with no icon still find theirs by fixed ID.
- **API (Seam A):** `Category.icon` (default null). Tests cover: storing an icon and pulling it on the other device, an icon name the server doesn't know, no icon from an older app, a malformed icon refused with a 422 on `icon`, and a Category deletion beating a later edit. The Other rules (no archive, no delete, only the fixed ID) are unchanged and still tested with the icon present.
- **Mobile data (Seam B, `categories.seamB.test.ts`):** local migration 5 adds `categories.icon`. `categoryActions` gains:
  - `add(name, icon?)`, which guesses the icon when none is given;
  - `setIcon`;
  - `remove(id)`, which uses the new `localStore.removeAll` to mark the Category and all its Category Budgets deleted in one transaction.

  `archive` and `remove` both refuse the last active Category besides Other (`isLastActiveCategory`). `categoryDeletionImpact(db, id, month)` gives the Expense count (all Months) and whether it has a budget above 0 this Month. `shownCategoryOf(liveCategories)` maps a deleted Category to Other for display. `editExpense` files an Expense whose Category is deleted under Other. `categoryBudgetsQuery` ignores budgets of deleted Categories, because a budget set offline on another device can outlive the deletion and would otherwise lower Unallocated.

  The tests cover: deleting with Expenses (shown as Other on both devices, records not rewritten, budgets gone in every Month, Unallocated going up by the budget, spending unchanged); saving such an Expense; phone A deleting while phone B records into it, renames it and sets its budget offline (both show it under Other with correct totals); Other can't be deleted; the minimum rule (including deleting an Archived one and adding a Category to lift the block); icon guess, pick, rename keeping the icon, sync; Other's icon can't change. The onboarding and kid onboarding tests check the new defaults and their icons. Other Seam B tests were moved off the removed default names.
- **Screens:** the Category edit screen has the icon picker (`src/categories/CategoryIconPicker.tsx`, a grid of 15 icons with the current one marked by `app:selected`). On a new Category the icon follows the typed name until one is picked. The screen also has Archive and Delete side by side; both are disabled for the last active Category, with "Keep at least one category besides Other." Archived rows on the Categories screen have a Delete icon button. Deleting goes through `useConfirmDeleteCategory`:
  - With no Expenses, it shows "Delete “X”?".
  - With Expenses, it shows the count, the budget line (only if there's a budget this Month) and the "can't be undone, Archive keeps history" line, with Archive instead and Delete.

  The Transaction list and the edit screen's chips show a deleted Category's Expenses as Other. The home Categories card needed no change: `categoryIconFor` now reads the record's icon (`app:tag` for a name this app doesn't have, the old ID mapping when there's none, `app:other` for Other). The default names are now "Food & groceries" and "Bills & utilities". The unused default-name strings are gone.

**Notes / left over:**
- The confirmations use the system `Alert`, which also has a Cancel button, so the with-Expenses one shows [Cancel] [Archive instead] [Delete]. On an Archived row it's [Cancel] [Delete], since it's already archived.
- An older app that edits a Category (before it knows about icons) pushes no icon, so last edit wins clears the icon to null. The app then falls back to the ID mapping or `tag`. There are no real users yet.
- The Category chips' "most recently used" order still credits a deleted Category's Expenses to nobody, not to Other.
- The Expense count in the confirmation isn't pluralized. The sentence puts the number where English and Arabic both read correctly without plural forms (the typed translations need the same keys in both languages).

**Human follow-up:**
- No new native modules. Deploy the API: Category `icon` is a new accepted field. Older apps keep syncing. An API without it silently drops icons from this app (unknown fields are stripped), so deploy the API before shipping the app.
- Check on a device, in English and Arabic: type "Rent" / "إيجار" and see the icon follow, then pick one and see it stop; rename and see the icon stay; delete an empty Category, one with Expenses and a budget this Month (check the Arabic text and the count's digits), and an Archived one; the disabled buttons and reason on the last Category; Expenses of a deleted Category under Other in the list and the edit screen; deleting on one phone while another records offline; the picker grid in RTL.
