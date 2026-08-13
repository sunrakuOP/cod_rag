import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyShopifyHmac } from "./verifySignature";

const SECRET = "test-secret";
const BODY = Buffer.from(JSON.stringify({ id: 123, total_price: "89900.00" }));

function sign(body: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

describe("verifyShopifyHmac", () => {
  it("accepts a signature computed with the correct secret", () => {
    expect(verifyShopifyHmac(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    expect(verifyShopifyHmac(BODY, sign(BODY, "wrong-secret"), SECRET)).toBe(false);
  });

  it("rejects when the body was tampered with after signing", () => {
    const signature = sign(BODY, SECRET);
    const tamperedBody = Buffer.from(JSON.stringify({ id: 123, total_price: "1.00" }));
    expect(verifyShopifyHmac(tamperedBody, signature, SECRET)).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    expect(verifyShopifyHmac(BODY, undefined, SECRET)).toBe(false);
  });
});
