import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  // Optional so the app still boots without Shopify configured; the webhook
  // route itself rejects requests when this is unset.
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
