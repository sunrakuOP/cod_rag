import { env } from "../../config/env";
import { logger } from "../../observability/logger";

const GRAPH_API_VERSION = "v25.0";

export interface SendConfirmationParams {
  phone: string;
  orderId: number;
  /**
   * Internal event label (e.g. "order_confirmation"), recorded in the
   * messages table — not necessarily the Meta template name actually sent.
   * The Meta template is env.WHATSAPP_TEMPLATE_NAME, set independently, so
   * swapping in the approved production template once it exists is a config
   * change, not a code change.
   */
  templateName: string;
}

export interface SendConfirmationResult {
  providerMessageId: string;
  costEstimate: number;
}

interface WhatsAppSendResponse {
  messages?: { id: string }[];
  error?: { message: string; type: string; code: number };
}

/**
 * WhatsApp Cloud API call — sends a utility template message. Same
 * input/output shape as the mock it replaces (phone/template in, provider
 * id/cost out), so the queue and domain layers didn't need to change.
 *
 * costEstimate is hardcoded 0: the send response doesn't include price,
 * and real per-message cost tracking needs Meta's pricing/analytics API or
 * a lookup table by country+category — not built yet, flagged here so it
 * doesn't get mistaken for a real number in the metrics.
 */
export async function sendConfirmationMessage(
  params: SendConfirmationParams,
): Promise<SendConfirmationResult> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error(
      "WhatsApp Cloud API is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)",
    );
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.phone,
      type: "template",
      template: {
        name: env.WHATSAPP_TEMPLATE_NAME,
        language: { code: env.WHATSAPP_TEMPLATE_LANG },
      },
    }),
  });

  const data = (await response.json()) as WhatsAppSendResponse;

  if (!response.ok || !data.messages?.[0]) {
    logger.error(
      { orderId: params.orderId, status: response.status, data },
      "WhatsApp send failed",
    );
    throw new Error(`WhatsApp send failed: ${data.error?.message ?? response.statusText}`);
  }

  return {
    providerMessageId: data.messages[0].id,
    costEstimate: 0,
  };
}
