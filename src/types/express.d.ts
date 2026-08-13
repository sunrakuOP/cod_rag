import type {} from "express";

declare global {
  namespace Express {
    interface Request {
      /** Raw request bytes, captured by app.ts's express.json({ verify }) so
       * webhook signature checks (Shopify HMAC) run against the exact bytes
       * the sender signed, not a re-serialized copy. */
      rawBody?: Buffer;
    }
  }
}

export {};
