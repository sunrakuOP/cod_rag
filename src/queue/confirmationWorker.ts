import { Worker, type Job } from "bullmq";
import { connection } from "./connection";
import { CONFIRMATION_QUEUE_NAME, type ConfirmationJobData } from "./confirmationQueue";
import { sendConfirmationMessageMock } from "../channels/whatsapp/mockSender";
import { recordMessage } from "../db/repositories/messagesRepository";
import { logger } from "../observability/logger";

async function processConfirmation(job: Job<ConfirmationJobData>) {
  const { orderId, clientId, phone, templateName } = job.data;

  const result = await sendConfirmationMessageMock({ phone, orderId, templateName });

  await recordMessage({
    orderId,
    clientId,
    direction: "outbound",
    channel: "whatsapp",
    templateName,
    status: "mocked_sent",
    providerMessageId: result.providerMessageId,
    costEstimate: result.costEstimate,
  });

  logger.info({ orderId, jobId: job.id }, "confirmation message recorded");
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
