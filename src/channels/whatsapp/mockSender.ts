import { logger } from "../../observability/logger";

export interface MockSendParams {
  phone: string;
  orderId: number;
  templateName: string;
}

export interface MockSendResult {
  providerMessageId: string;
  costEstimate: number;
}

/**
 * Stands in for the WhatsApp Cloud API call (CLAUDE.md §2 — WhatsApp can
 * ship mocked in this first vertical). Same shape a real sender will have
 * (phone/template in, provider id/cost out) so swapping this for the real
 * Cloud API client later doesn't touch the queue or the domain layer.
 */
export async function sendConfirmationMessageMock(
  params: MockSendParams,
): Promise<MockSendResult> {
  logger.info(
    { orderId: params.orderId, phone: params.phone, templateName: params.templateName },
    "[mock] WhatsApp confirmation would be sent here",
  );

  return {
    providerMessageId: `mock_${params.orderId}_${Date.now()}`,
    costEstimate: 0,
  };
}
