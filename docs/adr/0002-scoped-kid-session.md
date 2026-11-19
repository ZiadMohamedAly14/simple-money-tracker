# Kid-Mode devices hold a narrowed Kid Session, not the Account token

Kids have no login, so a Kid-Mode device is signed in under the parent's Account. If that device held a full Account token, a kid could reach the parent's Personal Budget through the API. Instead a Kid-Mode device holds a Kid Session token that can only read one Kid Profile's wallet and Learn content and only write Kid Expenses. Entering the Parent PIN temporarily raises the device to full access, and the full-access token is never stored on a Kid-Mode device.

## Consequences

- The Parent PIN is checked on the server, so the Parent Area on a Kid-Mode device needs internet. We don't cache the PIN hash there, because a 4–6 digit PIN could be guessed by brute force in seconds. The parent's own Personal-Mode device can top up any kid fully offline.
- A kid's device is set up by the parent signing in on it, choosing a Kid Profile and confirming the PIN. The device then swaps its full session for a Kid Session and deletes the full tokens.
- A Personal-Mode device does keep a copy of the PIN hash so it can check the PIN offline. Only Kid-Mode devices are denied it.
