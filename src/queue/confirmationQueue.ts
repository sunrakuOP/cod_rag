import { Queue } from "bullmq";
import { connection } from "./connection";

export const CONFIRMATION_QUEUE_NAME = "send-whatsapp-confirmation";

export interface ConfirmationJobData {
  orderId: number;
  clientId: number;
  phone: string;
  templateName: string;
}

export const confirmationQueue = new Queue<ConfirmationJobData>(CONFIRMATION_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    // attempts: 1 — the retry-cadence chain (queue/retryQueue.ts) is the
    // single retry mechanism now, covering both "send failed" and "customer
    // hasn't confirmed yet" with the same client-configured cadence. A
    // second, faster BullMQ-level retry here would double-schedule cadence
    // chains on every immediate retry.
    attempts: 1,
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});

export async function enqueueConfirmation(data: ConfirmationJobData) {
  return confirmationQueue.add("confirm", data);
}
