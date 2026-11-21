# 21: Delete Categories, keep at least one, smarter icons, fewer defaults

**What to build:** Adults can delete a Category, not only archive it. The app always keeps at least one real Category besides Other. A new Category gets a sensible icon guessed from its name, which the adult can change. New Accounts start with fewer default Categories. Decided with the user in a grilling session on 2026-11-21.

**Blocked by:** 09 (Categories and Category Budgets).

**Status:** ready-for-agent

- [ ] **Delete** is on the Category edit screen and on rows in the Archived section. Other never shows it.
- [ ] Deleting a Category with no Expenses asks a plain "Delete 'X'?" confirmation.
- [ ] Deleting a Category with Expenses shows a confirmation in English and Arabic saying:
  - how many Expenses (counted across all Months) will move to **Other**, and that spending totals won't change;
  - only if it has a budget this Month: that this Month's budget goes back to Unallocated;
  - that this can't be undone, and that **Archive** hides it but keeps its history.

  Buttons: **[Archive instead] [Delete]**. There is no undo after deleting.
- [ ] Deleting marks the Category deleted, using the existing deletion marker that beats any edit (ADR-0001), and deletes its Category Budgets in every Month.
- [ ] **Moving to Other happens at display time only.** Any Expense whose Category is deleted counts and shows as Other everywhere: Month breakdown, totals, Transaction list, Category chips and the edit screen's picker. Expense records are not rewritten. Saving such an Expense files it under Other. Seam B scenario: phone A deletes a Category while phone B records an Expense into it offline; after both sync, both show that Expense under Other with correct totals.
- [ ] **Minimum rule:** the last active Category that isn't Other can't be deleted or archived. Both buttons are disabled with a short reason. Enforce it in the data layer too, not only in the UI.
- [ ] **Category icon field:** each Category record gets a synced `icon` (an `app:` icon name).
  - The sync contract and server accept any short kebab-case string (no fixed list), so a newer app's icon never gets a sync refused.
  - The app shows `tag` for a name it doesn't know, and for older records with no icon it falls back to today's mapping (default IDs, otherwise `tag`).
  - Other always shows `other`.
- [ ] **Icon guess:** while adding a Category, the icon follows the typed name.
  - It uses an English and Arabic keyword list in shared code, with Seam C tests. Examples: rent/إيجار → housing, gym/doctor/دواء → health, uber/fuel → transport, netflix → entertainment, school → kids, supermarket/سوبرماركت → food-groceries.
  - It stops following once the adult picks an icon by hand. Renaming an existing Category never changes its icon. No match means `tag`.
- [ ] **Icon picker** on the add and edit screens: a grid of food-groceries, bills-utilities, monthly-bills, shopping-spend, housing, transport, health, entertainment, kids, personal, gift-give, charity-hand-coin, wallet, jar-save and tag. The current one is marked with `selected`.
- [ ] **Defaults:** new Accounts get Food & groceries, Bills & utilities, Shopping, and Other, in both personal and kid onboarding, with each default's icon set. Existing Accounts are not changed (no real users yet).
- [ ] **Docs:** add "Deleted" to the Category entry in `GLOSSARY.md` (its Expenses show as Other; its budgets are removed). Update the spec's Category rules (`.scratch/mvp/spec.md`, the business rules and data sections) to match.
