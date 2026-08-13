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
  // Optional for the same reason — the sender throws a clear error per-send
  // if these are missing, instead of blocking the whole app from booting.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().default("hello_world"),
  WHATSAPP_TEMPLATE_LANG: z.string().default("en_US"),
});

export const env = envSchema.parse(process.env);
