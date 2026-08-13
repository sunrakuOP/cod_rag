import { Worker, type Job } from "bullmq";
import { connection } from "./connection";
import { RETRY_QUEUE_NAME, scheduleRetryCheck, type RetryCheckJobData } from "./retryQueue";
import { shouldConfirm, nextRetryDelayMinutes } from "../domain/confirmation";
import { findOrderById, markOrderNoShow } from "../db/repositories/ordersRepository";
import { findClientById } from "../db/repositories/clientsRepository";
import { tryClaimIdempotencyKey } from "../db/repositories/idempotencyRepository";
import { sendConfirmationMessage } from "../channels/whatsapp/cloudApiSender";
import { recordMessage } from "../db/repositories/messagesRepository";
import { logger } from "../observability/logger";

/**
 * Fires once per configured cadence step (clients.retry_cadence_minutes).
 * Re-checks the order fresh from the DB each time — if something already
 * moved it off pending_confirmation (a future inbound-reply webhook would
 * do this), the chain just stops here instead of sending a stale retry.
 */
async function processRetryCheck(job: Job<RetryCheckJobData>) {
  const { orderId, clientId, phone, templateName, attemptNumber } = job.data;

  const order = await findOrderById(orderId);
  if (!order || !shouldConfirm(order)) {
    logger.info({ orderId, attemptNumber }, "retry check: order no longer pending, stopping cadence");
    return;
  }

  const client = await findClientById(clientId);
  if (!client) {
    logger.error({ orderId, clientId }, "retry check: client not found, stopping cadence");
    return;
  }

  const idempotencyKey = `order:${orderId}:confirm_retry_${attemptNumber}`;
  const claimed = await tryClaimIdempotencyKey(idempotencyKey, orderId, `confirm_retry_${attemptNumber}`);

  if (claimed) {
    try {
      const result = await sendConfirmationMessage({ phone, orderId, templateName });
      await recordMessage({
        orderId,
        clientId,
        direction: "outbound",
        channel: "whatsapp",
        templateName,
        status: "sent",
        providerMessageId: result.providerMessageId,
        costEstimate: result.costEstimate,
      });
      logger.info({ orderId, attemptNumber }, "retry confirmation sent");
    } catch (err) {
      await recordMessage({
        orderId,
        clientId,
        direction: "outbound",
        channel: "whatsapp",
        templateName,
        status: "failed",
      });
      logger.error({ orderId, attemptNumber, err }, "retry confirmation send failed");
    }
  }

  const nextDelay = nextRetryDelayMinutes(client.retryCadenceMinutes, attemptNumber + 1);

  if (nextDelay === null) {
    await markOrderNoShow(orderId);
    logger.info({ orderId }, "retry cadence exhausted, order marked no_show");
    return;
  }

  await scheduleRetryCheck(
    { orderId, clientId, phone, templateName, attemptNumber: attemptNumber + 1 },
    nextDelay,
  );
}

export function startRetryWorker() {
  const worker = new Worker<RetryCheckJobData>(RETRY_QUEUE_NAME, processRetryCheck, { connection });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "retry check job failed");
  });

  return worker;
}
