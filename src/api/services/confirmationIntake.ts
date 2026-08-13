import { shouldConfirm } from "../../domain/confirmation";
import { tryClaimIdempotencyKey } from "../../db/repositories/idempotencyRepository";
import { enqueueConfirmation } from "../../queue/confirmationQueue";
import type { Order } from "../../db/repositories/ordersRepository";

const CONFIRMATION_TEMPLATE = "order_confirmation";
const CONFIRMATION_EVENT = "confirm_send";

export interface ConfirmationIntakeResult {
  enqueued: boolean;
  reason?: "not_pending" | "already_processed";
  orderId: number;
  jobId?: string;
}

/**
 * Shared by every order source (test endpoint, Shopify webhook, future
 * Dropi/manual intake): domain decision -> DB-backed idempotency claim ->
 * enqueue. One place, so the idempotency and decision logic can't drift
 * between entry points.
 */
export async function intakeOrderForConfirmation(
  order: Order,
  clientId: number,
): Promise<ConfirmationIntakeResult> {
  if (!shouldConfirm(order)) {
    return { enqueued: false, reason: "not_pending", orderId: order.id };
  }

  const idempotencyKey = `order:${order.id}:${CONFIRMATION_EVENT}`;
  const claimed = await tryClaimIdempotencyKey(idempotencyKey, order.id, CONFIRMATION_EVENT);

  if (!claimed) {
    return { enqueued: false, reason: "already_processed", orderId: order.id };
  }

  const job = await enqueueConfirmation({
    orderId: order.id,
    clientId,
    phone: order.customerPhone,
    templateName: CONFIRMATION_TEMPLATE,
  });

  return { enqueued: true, orderId: order.id, jobId: job.id };
}
