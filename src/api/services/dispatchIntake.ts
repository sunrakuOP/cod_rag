import { markOrderReadyForDispatch } from "../../integrations/dropi/mockClient";
import { markOrderDispatched } from "../../db/repositories/ordersRepository";
import { notifyOperator, escapeMarkdown } from "../../channels/telegram/notifier";
import { logger } from "../../observability/logger";
import type { Order } from "../../db/repositories/ordersRepository";
import type { Client } from "../../db/repositories/clientsRepository";

/**
 * Called right after an order transitions to confirmed (today: only the
 * inbound WhatsApp webhook does that, guarded by markOrderConfirmed's
 * return value). markOrderDispatched's own SQL guard (status='confirmed')
 * is the real idempotency boundary here, not this function.
 *
 * Takes the already-fetched order/client instead of re-querying — the
 * caller has both in scope, and only order.status is ever stale (see
 * ordersRepository.markOrderConfirmed), not the other fields used here.
 */
export async function markOrderDispatchedIfConfirmed(order: Order, client: Client): Promise<void> {
  const { dropiOrderId } = await markOrderReadyForDispatch(order.id);
  await markOrderDispatched(order.id);

  logger.info({ orderId: order.id, dropiOrderId }, "order marked ready for dispatch (mock Dropi)");

  await notifyOperator(
    client,
    `✅ Pedido *#${order.externalOrderId}* confirmado y despachado (mock Dropi \`${dropiOrderId}\`)\nCliente: ${escapeMarkdown(order.customerName ?? "sin nombre")}`,
  );
}
