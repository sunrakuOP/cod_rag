import { markOrderReadyForDispatch } from "../../integrations/dropi/mockClient";
import { markOrderDispatched } from "../../db/repositories/ordersRepository";
import { logger } from "../../observability/logger";

/**
 * Called right after an order transitions to confirmed (today: only the
 * inbound WhatsApp webhook does that, guarded by markOrderConfirmed's
 * return value). markOrderDispatched's own SQL guard (status='confirmed')
 * is the real idempotency boundary here, not this function.
 */
export async function markOrderDispatchedIfConfirmed(orderId: number): Promise<void> {
  const { dropiOrderId } = await markOrderReadyForDispatch(orderId);
  await markOrderDispatched(orderId);

  logger.info({ orderId, dropiOrderId }, "order marked ready for dispatch (mock Dropi)");
}
