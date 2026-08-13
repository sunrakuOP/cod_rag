import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Shopify signs every webhook body with HMAC-SHA256 using the app's client
 * secret (X-Shopify-Hmac-Sha256 header, base64). This must run against the
 * raw request bytes — re-serializing a parsed JSON object can change byte
 * ordering/whitespace and break the signature, which is why the caller has
 * to pass the untouched Buffer, not req.body.
 */
export function verifyShopifyHmac(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const computed = createHmac("sha256", secret).update(rawBody).digest("base64");

  const computedBuf = Buffer.from(computed);
  const receivedBuf = Buffer.from(signatureHeader);

  if (computedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(computedBuf, receivedBuf);
}
