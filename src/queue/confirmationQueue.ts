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
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});

export async function enqueueConfirmation(data: ConfirmationJobData) {
  return confirmationQueue.add("confirm", data);
}
