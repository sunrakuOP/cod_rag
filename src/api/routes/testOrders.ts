import { Router } from "express";
import { z } from "zod";
import { findClientBySlug } from "../../db/repositories/clientsRepository";
import { upsertOrder } from "../../db/repositories/ordersRepository";
import { intakeOrderForConfirmation } from "../services/confirmationIntake";
import { logger } from "../../observability/logger";

export const testOrdersRouter = Router();

const testOrderSchema = z.object({
  clientSlug: z.string().min(1),
  externalOrderId: z.string().min(1),
  customerPhone: z.string().min(1),
  customerName: z.string().optional(),
  total: z.number().optional(),
});

/**
 * The vertical delgado's manual entry point: mock order in -> shouldConfirm()
 * decides -> DB-backed idempotency claim -> enqueue -> log. Shares
 * confirmationIntake with the Shopify webhook so the decision/idempotency
 * logic only lives in one place.
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

  const result = await intakeOrderForConfirmation(order, client.id);

  if (!result.enqueued) {
    return res.json({ enqueued: false, reason: result.reason, order });
  }

  logger.info({ orderId: order.id, jobId: result.jobId }, "confirmation enqueued");
  return res.status(202).json({ enqueued: true, orderId: result.orderId, jobId: result.jobId });
});
