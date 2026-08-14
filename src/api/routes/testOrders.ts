import { Router } from "express";
import { z } from "zod";
import { findClientBySlug } from "../../db/repositories/clientsRepository";
import { upsertOrder } from "../../db/repositories/ordersRepository";
import { intakeOrderForConfirmation } from "../services/confirmationIntake";
import { isAuthorizedByApiKey } from "../apiKeyAuth";
import { env } from "../../config/env";
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
 *
 * Auth is required (unlike a webhook, there's no signature to verify): this
 * route can trigger a real WhatsApp send for any client that has real
 * credentials configured (e.g. dovi, see CLAUDE.md guardrail) — an
 * unauthenticated caller on the public Railway URL could otherwise spam a
 * real number and pollute a real client's order/metrics data. Fails closed
 * (500) if TEST_ORDERS_API_KEY isn't set, same pattern as /api/metrics.
 */
testOrdersRouter.post("/api/test-orders", async (req, res) => {
  if (!env.TEST_ORDERS_API_KEY) {
    logger.error("TEST_ORDERS_API_KEY not configured, rejecting test-order request");
    return res.status(500).json({ error: "test_orders_not_configured" });
  }

  if (!isAuthorizedByApiKey(req, env.TEST_ORDERS_API_KEY)) {
    return res.status(401).json({ error: "unauthorized" });
  }

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
