/**
 * The one reason a route or sync change refuses a Kid Session (ADR-0002):
 * `kid_session` (403). Every full-scope-only route and the sync scope rules
 * send it as `data.reason`.
 */
export type ScopeErrorReason = 'kid_session';

/** `data` of a 403 refusing a Kid Session. */
export interface ScopeErrorData {
  reason: ScopeErrorReason;
}
