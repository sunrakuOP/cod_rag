import { Router } from "express";
import { z } from "zod";
import { findClientBySlug } from "../../db/repositories/clientsRepository";
import { upsertOrder } from "../../db/repositories/ordersRepository";
import { tryClaimIdempotencyKey } from "../../db/repositories/idempotencyRepository";
import { shouldConfirm } from "../../domain/confirmation";
import { enqueueConfirmation } from "../../queue/confirmationQueue";
import { logger } from "../../observability/logger";

export const testOrdersRouter = Router();

const testOrderSchema = z.object({
  clientSlug: z.string().min(1),
  externalOrderId: z.string().min(1),
  customerPhone: z.string().min(1),
  customerName: z.string().optional(),
  total: z.number().optional(),
});

const CONFIRMATION_TEMPLATE = "order_confirmation";
const CONFIRMATION_EVENT = "confirm_send";

/**
 * The vertical delgado: mock order in -> shouldConfirm() decides -> DB-backed
 * idempotency claim -> enqueue -> log. Nothing here talks to Meta yet
 * (channels/whatsapp/mockSender), but every other seam is the real one.
 */
testOrdersRouter.post("/api/test-orders", async (req, res) => {
  const parsed = testOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }

  const { clientSlug, externalOrderId, customerPhone, customerName, total } = parsed.data;

  const client = await findClientBySlug(clientSlug);
  if (!client) {
    return res.status(404).json({ error: "unknown_client", clientSlug });
  }

  const order = await upsertOrder({
    clientId: client.id,
    externalOrderId,
    customerPhone,
    customerName,
    total,
  });

  if (!shouldConfirm(order)) {
    return res.json({ enqueued: false, reason: "not_pending", order });
  }

  const idempotencyKey = `order:${order.id}:${CONFIRMATION_EVENT}`;
  const claimed = await tryClaimIdempotencyKey(idempotencyKey, order.id, CONFIRMATION_EVENT);

  if (!claimed) {
    logger.info({ orderId: order.id, idempotencyKey }, "confirmation already processed, skipping");
    return res.json({ enqueued: false, reason: "already_processed", orderId: order.id });
  }

  const job = await enqueueConfirmation({
    orderId: order.id,
    clientId: client.id,
    phone: order.customerPhone,
    templateName: CONFIRMATION_TEMPLATE,
  });

  logger.info({ orderId: order.id, jobId: job.id }, "confirmation enqueued");
  return res.status(202).json({ enqueued: true, orderId: order.id, jobId: job.id });
});
