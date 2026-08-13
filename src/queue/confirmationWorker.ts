import { Worker, type Job } from "bullmq";
import { connection } from "./connection";
import { CONFIRMATION_QUEUE_NAME, type ConfirmationJobData } from "./confirmationQueue";
import { scheduleRetryCheck } from "./retryQueue";
import { sendConfirmationMessage } from "../channels/whatsapp/cloudApiSender";
import { recordMessage } from "../db/repositories/messagesRepository";
import { findClientById } from "../db/repositories/clientsRepository";
import { nextRetryDelayMinutes } from "../domain/confirmation";
import { logger } from "../observability/logger";

async function processConfirmation(job: Job<ConfirmationJobData>) {
  const { orderId, clientId, phone, templateName } = job.data;

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

    logger.info({ orderId, jobId: job.id }, "confirmation message sent");
  } catch (err) {
    // Logged, not rethrown: every attempt leaves a trace either way
    // (CLAUDE.md §4.5), and a failed send still deserves the same
    // cadence-driven resend as an unconfirmed one — both mean "no
    // confirmation has reached the customer yet."
    await recordMessage({
      orderId,
      clientId,
      direction: "outbound",
      channel: "whatsapp",
      templateName,
      status: "failed",
    });
    logger.error({ orderId, jobId: job.id, err }, "confirmation send failed");
  }

  const client = await findClientById(clientId);
  if (!client) {
    logger.error({ orderId, clientId }, "cannot schedule retry cadence: client not found");
    return;
  }

  const firstDelay = nextRetryDelayMinutes(client.retryCadenceMinutes, 1);
  if (firstDelay !== null) {
    await scheduleRetryCheck({ orderId, clientId, phone, templateName, attemptNumber: 1 }, firstDelay);
  }
}

export function startConfirmationWorker() {
  const worker = new Worker<ConfirmationJobData>(CONFIRMATION_QUEUE_NAME, processConfirmation, {
    connection,
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "confirmation job failed");
  });

  return worker;
}
