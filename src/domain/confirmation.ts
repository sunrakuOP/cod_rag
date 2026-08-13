export type OrderStatus = "pending_confirmation" | "confirmed" | "no_show" | "dispatched";

export interface OrderForConfirmation {
  status: OrderStatus;
}

/**
 * Whether a confirmation message should be sent right now. Pure and
 * side-effect free on purpose (CLAUDE.md §4.1): this is the one place that
 * decides, everything else (queue, WhatsApp, DB) just carries out the
 * decision. Only pending orders get confirmed — never re-confirm an order
 * that already moved to confirmed/no_show/dispatched.
 */
export function shouldConfirm(order: OrderForConfirmation): boolean {
  return order.status === "pending_confirmation";
}

/**
 * Minutes to wait before the next retry, given a client's configured
 * cadence (e.g. [15, 60, 180]) and which retry attempt this is (1-indexed:
 * retry 1 uses cadence[0], retry 2 uses cadence[1], ...). Returns null once
 * the cadence is exhausted — the caller's signal to stop retrying and mark
 * the order no_show instead.
 */
export function nextRetryDelayMinutes(
  retryCadenceMinutes: number[],
  attemptNumber: number,
): number | null {
  return retryCadenceMinutes[attemptNumber - 1] ?? null;
}
