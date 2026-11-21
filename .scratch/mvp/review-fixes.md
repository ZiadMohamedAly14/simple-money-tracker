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
