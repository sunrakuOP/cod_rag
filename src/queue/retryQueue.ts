import { Queue } from "bullmq";
import { connection } from "./connection";

export const RETRY_QUEUE_NAME = "order-retry-check";

export interface RetryCheckJobData {
  orderId: number;
  clientId: number;
  phone: string;
  templateName: string;
  /** 1-indexed: which retry this is (matches clients.retry_cadence_minutes[attemptNumber - 1]). */
  attemptNumber: number;
}

export const retryQueue = new Queue<RetryCheckJobData>(RETRY_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});

export async function scheduleRetryCheck(data: RetryCheckJobData, delayMinutes: number) {
  return retryQueue.add("retry-check", data, { delay: delayMinutes * 60_000 });
}
