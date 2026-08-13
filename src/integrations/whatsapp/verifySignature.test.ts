import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "./verifySignature";

const SECRET = "test-app-secret";
const BODY = Buffer.from(JSON.stringify({ entry: [{ id: "123" }] }));

function sign(body: Buffer, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifyMetaSignature", () => {
  it("accepts a signature computed with the correct app secret", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong app secret", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, "wrong-secret"), SECRET)).toBe(false);
  });

  it("rejects when the body was tampered with after signing", () => {
    const signature = sign(BODY, SECRET);
    const tampered = Buffer.from(JSON.stringify({ entry: [{ id: "999" }] }));
    expect(verifyMetaSignature(tampered, signature, SECRET)).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    expect(verifyMetaSignature(BODY, undefined, SECRET)).toBe(false);
  });

  it("rejects a header without the sha256= scheme prefix", () => {
    const raw = createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(verifyMetaSignature(BODY, raw, SECRET)).toBe(false);
  });
});
