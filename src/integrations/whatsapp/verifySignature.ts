import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta signs inbound WhatsApp webhook bodies with HMAC-SHA256 using the
 * app's App Secret (X-Hub-Signature-256 header, hex, prefixed "sha256=" —
 * different format from Shopify's base64 X-Shopify-Hmac-Sha256, so this
 * isn't a shared function with integrations/shopify/verifySignature.ts).
 * Must run against the raw request bytes, not a re-serialized req.body.
 */
export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;

  const [scheme, receivedHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !receivedHex) return false;

  const computedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const computedBuf = Buffer.from(computedHex, "hex");
  const receivedBuf = Buffer.from(receivedHex, "hex");

  if (computedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(computedBuf, receivedBuf);
}
