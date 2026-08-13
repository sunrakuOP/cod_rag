import { Router } from "express";
import { verifyMetaSignature } from "../../integrations/whatsapp/verifySignature";
import { parseInboundMessage } from "../../integrations/whatsapp/parseInboundMessage";
import { findClientByWhatsappPhoneNumberId } from "../../db/repositories/clientsRepository";
import {
  findMostRecentPendingOrderByPhone,
  markOrderConfirmed,
} from "../../db/repositories/ordersRepository";
import { markOrderDispatchedIfConfirmed } from "../services/dispatchIntake";
import { recordMessage } from "../../db/repositories/messagesRepository";
import { env } from "../../config/env";
import { logger } from "../../observability/logger";

export const whatsappWebhookRouter = Router();

/**
 * One-time handshake Meta does when you register/re-verify the webhook
 * URL in the app dashboard — must echo back hub.challenge if hub.verify_token
 * matches what we configured on both sides.
 */
whatsappWebhookRouter.get("/webhooks/whatsapp/messages", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

/**
 * Any inbound message from a phone we have a pending order for confirms
 * that order — no button-based template yet, so there's no structured
 * "yes"/"no" signal to key off. Documented simplification (src/README.md):
 * a reply like "no quiero" would be misread as a confirmation just the
 * same as "sí". Revisit once an interactive-button template exists.
 */
whatsappWebhookRouter.post("/webhooks/whatsapp/messages", async (req, res) => {
  if (!env.WHATSAPP_APP_SECRET) {
    logger.error("WHATSAPP_APP_SECRET not configured, rejecting webhook");
    return res.status(500).json({ error: "webhook_not_configured" });
  }

  const signature = req.header("x-hub-signature-256");
  const rawBody = req.rawBody;

  if (!rawBody || !verifyMetaSignature(rawBody, signature, env.WHATSAPP_APP_SECRET)) {
    logger.warn("whatsapp webhook signature verification failed");
    return res.status(401).json({ error: "invalid_signature" });
  }

  const inbound = parseInboundMessage(req.body);
  if (!inbound) {
    // Status-update deliveries (sent/delivered/read receipts) land here too
    // and have no `messages` array — not an error, just nothing to do.
    return res.sendStatus(200);
  }

  const client = await findClientByWhatsappPhoneNumberId(inbound.phoneNumberId);
  if (!client) {
    logger.error({ phoneNumberId: inbound.phoneNumberId }, "inbound whatsapp message: unknown phone_number_id");
    return res.sendStatus(200);
  }

  const order = await findMostRecentPendingOrderByPhone(client.id, inbound.customerPhone);
  if (!order) {
    logger.info(
      { clientId: client.id, customerPhone: inbound.customerPhone },
      "inbound whatsapp message: no pending order for this phone",
    );
    return res.sendStatus(200);
  }

  const confirmed = await markOrderConfirmed(order.id);
  if (confirmed) {
    await markOrderDispatchedIfConfirmed(order.id);
  }

  await recordMessage({
    orderId: order.id,
    clientId: client.id,
    direction: "inbound",
    channel: "whatsapp",
    templateName: "customer_reply",
    status: "delivered",
    providerMessageId: inbound.messageId,
  });

  logger.info({ orderId: order.id, clientId: client.id }, "order confirmed via inbound whatsapp reply");

  return res.sendStatus(200);
});
