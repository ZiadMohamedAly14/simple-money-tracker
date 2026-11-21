# Extra fixes for the code-review implementer (agreed with the user)

The fix agent applies these on top of whatever `/code-review` finds.

1. **Kid-device choice after sign-in** (ticket 14 as written)
   - After a successful email-code sign-in, if the Account is already onboarded and has a Parent PIN, show "Whose phone is this? [Mine] [For a kid]".
   - "For a kid" leads into ticket 14's existing pick/create-kid → confirm-PIN screens. The PIN is asked once only.
   - Keep the Parent Area "Set up this phone for a kid" button as a second way in.
   - A brand-new Account (not onboarded) goes through onboarding as now.
2. **Keyboard covers the keypad** on the Category edit screen while typing the name (ticket 08 note).
3. **Currency-vs-digits edge case** (ticket 17's Comments): changing the currency on a device that hasn't received the Account settings yet writes Western digits, and could overwrite a digits choice made on another device.
4. **Remove Ionicons entirely**, once 15 and 18 are merged: drop plain Ionicons names from `GlyphName` / `Glyph` and delete `DirectionalIcon`, so only `app:` icons type-check (icons-round-2 note).

5. **Other parent devices after an Account deletion** (ticket 18's Comments): they keep local data until someone signs in. When the server says the session or Account is gone (401 on sync or refresh), wipe local data and return to sign-in. If ticket 15 already handles this for every signed-out case, skip it.

6. **Hide Archive on a kid's own phone** (ticket 15 gap): while the Parent Area is unlocked on a Kid-Mode device, the kid detail screen still shows ticket 18's Archive button, and archiving that phone's own kid signs the phone out. Hide it there.
7. **Stuck sync after a parent Top-up on a kid phone** (ticket 15 gap): if the unlock expires or the phone is offline before a parent-made Top-up/Transfer syncs, the kid phone's later syncs are refused. Hold parent-only outbox entries back from Kid-session pushes, or drop them with a clear notice. Pick the simplest safe fix.

8. **Chip order after a Category delete** (ticket 21 gap): "most recently used" Category chip order should credit a deleted Category's Expenses to Other, consistent with display-time re-filing.

9. **Sign out uses the Danger tint fill** (ticket 23, from the user's palette: "Danger tint: Delete and sign-out button fill").
10. (superseded, see 10 below)

After the fixes: typecheck + `npm test` green → `git push origin mvp` (user asked: push after 15, 18 and the code review). Then ticket 19.

## Added after the code review (2026-11-21), all approved by the user

### From the user
10. **Learn illustrations in dark mode:** use the user's new `learn-illustration-<topic>-dark.svg` drawings (commit after 013ad71) in dark mode, falling back to the light drawing. Register them in `appIcons.ts` (the registry test requires it) as coloured illustrations. No backdrop needed.
11. **Remaining = Expected Income − Spending** (user decision). Budgets don't count as spent. Update the shared calculation and its Seam C tests, the hero card, `GLOSSARY.md` ("Remaining") and the spec (story 24/30 wording and the home-screen rules). The income bar and "X of Y expected" caption and the Income tile still show recorded Income.

### From the Standards review
12. ADR-0006: amend to allow deterministic hash-based UUIDv8 IDs for the per-Account/per-Month singletons (Month plan, Category Budget, Account settings, default Categories, default Jars).
13. `onboarding.routes.ts`: use `requireFullScope` so a Kid session gets the standard `{ reason: 'kid_session' }` 403.
14. GLOSSARY: document that a Kid Expense's Jar balance is checked on the device only (the server accepts overspends under last-edit-wins).
15. Glossary terms: UI says "Move money / Edit move / Delete move" → use "Transfer" wording (EN and AR). Rename `evaluateAllocation` / `AmountEntry.allocation` away from "allocation".
16. De-duplicate:
    - Account deletion's code flow should reuse auth's code machinery (`requestCode`/`useCode` with a purpose).
    - One shared `secondsUntil`.
    - Shared PIN, code and language validators for routes.
    - Drop `sync/sha256.ts` in favour of `@noble/hashes`.
17. Types: one scope-error reason type, and don't type `requireFullScope` with `ParentPinErrorData`. `ids.ts` takes `Month`, not `string`.

### From the Spec review
18. **Month creation conflict:** two devices copying the same new Month must converge on the copy from the newest source Month (not "first to sync"). Copied plans never include budgets of archived or deleted Categories, including after a merge with another device's copy. Seam B test with one device behind on sync.
19. **Kid edits on a negative Jar:** editing a Kid Expense or Jar Transfer is allowed when it doesn't increase what's taken from the Jar (note/date change, lower amount). Only an increase is checked against `spendableFrom`.
20. **Account deletion race:** a sync already past `requireAuth` must not write after deletion. Check that the Account still exists inside sync before writing, and don't create Other for a deleted Account.
21. **Minimum-Category rule across devices:** stays device-side. If sync leaves only Other, the Categories screen shows a gentle "add a category" prompt.
22. Fix ticket 14's checklist wording: a Kid session can read its own Top-ups and Jar Transfers; it can't write them or read other kids'.
23. **Elevated Kid-Mode session:** limit its pushes to Kid Wallet entities (Kid Profiles, Jars, Kid Transactions). No Personal Transactions or Categories.

## Applied

On branch `fix/code-review` (2026-11-21). Checks: `npm run typecheck` and `npm test` pass in every workspace (shared 284, api 166, mobile 382), and `npx expo export --platform android` bundles. `mvp` had no new commits to merge.

1. Done. After sign-in, an onboarded Account with a Parent PIN sees "Whose phone is this? [Mine] [For a kid]" (`app/whose-phone.tsx`, rule in `src/kid/whosePhone.ts`). Ticket 14's setup screens moved from the PIN-gated `/parent/kid-device` to `/kid-device` (with its own "Create a new kid" step), so this path asks for the PIN once. The Parent Area button still opens them; that path asks at the gate and again at the confirm step, as before.
2. Done. The Category edit screen hides the keypad while the system keyboard is open; tapping the budget closes the keyboard.
3. Done. `changeAccountSettings` returns `not_ready` and writes nothing until the device holds the Account settings; Settings shows a short notice.
4. Done. `GlyphName` takes only `app:` names, `DirectionalIcon` is deleted, and `@expo/vector-icons` is out of `apps/mobile/package.json`.
5. Done, with a new reason. Ticket 15 only wiped Kid-Mode devices, and wiping a Personal device on any 401 would break spec story 5 (keep data after an expired sign-in). So the server now answers 401 `account_deleted` when a token's Account no longer exists (calls and refresh), and the app wipes and returns to sign-in on that reason only.
6. Done. Archive is hidden on the kid wallet screen on a Kid-Mode phone.
7. Done. The sync engine holds back everything but Kid Expenses while a Kid-Mode phone syncs as its Kid Session (`kidSessionHoldsBack`). Those entries stay queued and go out on the next unlock.
8. Done. Chip order counts a deleted Category's Expenses as uses of Other.
9. Done. Sign out uses the `danger` button (Danger tint fill, red text).
10. (superseded) Skipped.
10. (Learn illustrations) Done. The nine `-dark` drawings are registered, and Learn shows them in dark mode, falling back to the light drawing.
11. Done. Remaining = Expected Income − Spending in `monthFigures`, the tests, the glossary, the spec (stories 24 and 30, home-screen rule) and the design note.
12. Done. ADR-0006 is amended.
13. Done.
14. Done. The glossary's Kid Expense entry is updated.
15. Done. The parent screens say Transfer / Jar transfer (EN) and تحويل (AR), with keys `kid.transfer.*` and route `parent/kids/[id]/transfer`. The kid's neutral "10 moved to Save" history line is unchanged (design flaw 4). `evaluateAllocation` is now `evaluateNonNegativeAmount`, and `AmountEntry.allocation` is now `nonNegative`.
16. Done. Account deletion uses auth's `requestCode`/`useCode` with a `deleteAccount` purpose. One-time codes are now kept per email and purpose, and the purpose is part of the hash, so a PIN-reset or deletion code never signs in. The `AccountDeletionCode` collection is gone, and the server runs `SignInCode.syncIndexes()` at start to replace the old unique `email` index. One shared `secondsUntil`, shared route validators in `routes/fields.ts`, and `sync/sha256.ts` is replaced by `@noble/hashes` (same IDs).
17. Done. `ScopeErrorReason`/`ScopeErrorData`. `ids.ts` takes `Month` (an alias of string, so this is documentation only).
18. Done. A copied plan's edit time is `copiedPlanEditTime(sourceMonth)`, a small number per source Month, so the copy from the newer source wins and a real edit still beats any copy. The copy also writes 0 for every live Category it leaves out, so an older copy can't bring back an Archived Category's budget. Budgets of deleted Categories that come back this way are ignored by `categoryBudgetsQuery`, as before.
19. Done. `spendableFrom` lets an edit keep what it already took and checks only an increase.
20. Done. Sync checks the Account before it starts and before each write. The check and the write aren't atomic, so a millisecond window remains, much smaller than before.
21. Done. The Categories screen shows a notice when only Other is active.
22. Done.
23. Done. An elevated Kid-Mode session may push only Kid Profiles, Jars and Kid Transactions (other entities get 403 `kid_session`).

Human follow-up: deploy the API together with the app (`account_deleted`, per-purpose codes and the index change, the elevated-scope rule). No new native modules. Check by hand: the "Whose phone is this?" flow in EN/AR, the Category edit keyboard, the Learn dark drawings, and the Transfer wording in RTL.
