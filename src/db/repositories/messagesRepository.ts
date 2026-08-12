import { pool } from "../pool";

export interface RecordMessageParams {
  orderId: number;
  clientId: number;
  direction: "outbound" | "inbound";
  channel: string;
  templateName: string;
  status: "queued" | "sent" | "delivered" | "failed" | "mocked_sent";
  providerMessageId?: string;
  costEstimate?: number;
}

/**
 * Every send attempt (real or mocked) lands here — this table is the source
 * for the confirmation-rate and cost metrics CLAUDE.md §6 requires, so it
 * gets written regardless of channel being mocked today.
 */
export async function recordMessage(params: RecordMessageParams): Promise<void> {
  await pool.query(
    `INSERT INTO messages (order_id, client_id, direction, channel, template_name, status, provider_message_id, cost_estimate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.orderId,
      params.clientId,
      params.direction,
      params.channel,
      params.templateName,
      params.status,
      params.providerMessageId ?? null,
      params.costEstimate ?? 0,
    ],
  );
}
