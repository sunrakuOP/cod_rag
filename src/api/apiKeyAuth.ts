import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

/**
 * Shared x-api-key check for internal routes that aren't Meta/Shopify
 * webhooks (those verify a signature instead). `expectedKey` is undefined
 * when the operator hasn't configured that route's env var — callers should
 * treat that as "reject," not "compare against nothing."
 */
export function isAuthorizedByApiKey(req: Request, expectedKey: string | undefined): boolean {
  if (!expectedKey) return false;

  const provided = req.header("x-api-key");
  if (!provided) return false;

  const expectedBuf = Buffer.from(expectedKey);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
