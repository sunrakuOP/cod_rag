export interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{ from?: string; type?: string; id?: string }>;
      };
    }>;
  }>;
}

export interface InboundMessage {
  phoneNumberId: string;
  customerPhone: string;
  messageId: string;
}

/**
 * Meta batches messages into entry[].changes[].value.messages[]; in
 * practice a webhook delivery carries exactly one, but the shape allows
 * more. We only act on the first — extra messages in the same delivery
 * aren't expected from a single customer reply and aren't handled.
 *
 * "from" arrives as digits only (no "+"), Shopify-style E.164 elsewhere in
 * this codebase always has it — normalized here so it matches
 * orders.customer_phone as stored.
 */
export function parseInboundMessage(payload: WhatsAppWebhookPayload): InboundMessage | null {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  const phoneNumberId = value?.metadata?.phone_number_id;

  if (!message?.from || !message.id || !phoneNumberId) return null;

  return {
    phoneNumberId,
    customerPhone: `+${message.from}`,
    messageId: message.id,
  };
}
