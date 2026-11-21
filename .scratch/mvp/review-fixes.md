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
10. **Learn illustrations in dark mode** (ticket 23): only if the user agrees, put a light backdrop behind `learn-illustration-*` drawings in dark mode so their dark outlines stay visible.

After the fixes: typecheck + `npm test` green → `git push origin mvp` (user asked: push after 15, 18 and the code review). Then ticket 19.
