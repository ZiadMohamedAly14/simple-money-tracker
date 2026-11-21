/** Top-level routes a Kid-Mode device always opens: home (which sends it to its kid), the kid's screens and Learn. */
const KID_MODE_ROUTES: readonly (string | undefined)[] = [undefined, 'index', 'kid', 'learn'];

/**
 * Parent Area screens a Kid-Mode device opens once the Parent PIN has elevated
 * it: the kid's wallet, Top-ups and Jars, and the Kid-Mode devices list.
 * Adding a kid or setting up a phone belong on the parent's own phone.
 */
const ELEVATED_PARENT_ROUTES: readonly (string | undefined)[] = [undefined, 'index', 'kids', 'devices'];

/**
 * Whether a Kid-Mode device may show the route at `segments` (expo-router's
 * `useSegments`). `/parent` itself is always allowed: its gate asks for the
 * Parent PIN, checked on the server (ADR-0002).
 */
export function kidModeAllows(segments: readonly string[], elevated: boolean): boolean {
  const [top, second, third] = segments;
  if (KID_MODE_ROUTES.includes(top)) return true;
  if (top !== 'parent') return false;
  if (second === undefined || second === 'index') return true;
  return elevated && ELEVATED_PARENT_ROUTES.includes(second) && !(second === 'kids' && third === 'new');
}
