import { Router } from "express";
import { verifyShopifyHmac } from "../../integrations/shopify/verifySignature";
import { mapShopifyOrder } from "../../integrations/shopify/mapOrderPayload";
import { findClientByShopDomain } from "../../db/repositories/clientsRepository";
import { upsertOrder } from "../../db/repositories/ordersRepository";
import { intakeOrderForConfirmation } from "../services/confirmationIntake";
import { env } from "../../config/env";
import { logger } from "../../observability/logger";

export const shopifyWebhookRouter = Router();

/**
 * Real Shopify order intake, replacing the manual /api/test-orders entry
 * point for production traffic. Assumes every order through this webhook is
 * COD (true for a Releasit-driven COD store like Dovi's) — no payment
 * gateway filtering. Shopify requires a fast 2xx ack regardless of whether
 * we actually enqueue anything, so every known-shop branch below returns 200.
 */
shopifyWebhookRouter.post("/webhooks/shopify/orders/create", async (req, res) => {
  if (!env.SHOPIFY_WEBHOOK_SECRET) {
    logger.error("SHOPIFY_WEBHOOK_SECRET not configured, rejecting webhook");
    return res.status(500).json({ error: "webhook_not_configured" });
  }

  const signature = req.header("x-shopify-hmac-sha256");
  const rawBody = req.rawBody;

  if (!rawBody || !verifyShopifyHmac(rawBody, signature, env.SHOPIFY_WEBHOOK_SECRET)) {
    logger.warn({ shopDomain: req.header("x-shopify-shop-domain") }, "shopify webhook signature verification failed");
    return res.status(401).json({ error: "invalid_signature" });
  }

  const shopDomain = req.header("x-shopify-shop-domain");
  const client = shopDomain ? await findClientByShopDomain(shopDomain) : null;

  if (!client) {
    logger.error({ shopDomain }, "shopify webhook from unknown/unconfigured shop domain");
    return res.status(200).json({ received: true, processed: false, reason: "unknown_shop" });
  }

  const mapped = mapShopifyOrder(req.body);

  if (!mapped.customerPhone) {
    logger.warn(
      { shopifyOrderId: mapped.externalOrderId, clientId: client.id },
      "shopify order has no phone in any known field, skipping confirmation",
    );
    return res.status(200).json({ received: true, processed: false, reason: "missing_phone" });
  }

  const order = await upsertOrder({
    clientId: client.id,
    externalOrderId: mapped.externalOrderId,
    customerPhone: mapped.customerPhone,
    customerName: mapped.customerName,
    total: mapped.total,
  });

  const result = await intakeOrderForConfirmation(order, client.id);

  logger.info(
    { shopifyOrderId: mapped.externalOrderId, ...result },
    "shopify order processed",
  );

  return res.status(200).json({ received: true, processed: true, ...result });
});
