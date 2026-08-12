import IORedis from "ioredis";
import { env } from "../config/env";

// BullMQ requires this exact setting on any connection it manages.
export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
