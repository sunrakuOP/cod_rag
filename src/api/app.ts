import express from "express";
import { healthRouter } from "./routes/health";
import { testOrdersRouter } from "./routes/testOrders";
import { shopifyWebhookRouter } from "./routes/shopifyWebhook";
import { logger } from "../observability/logger";

export function createApp() {
  const app = express();

  app.use(
    express.json({
      // Stash the exact bytes received so webhook signature checks (Shopify
      // HMAC) can verify against them — a re-serialized req.body would not
      // reliably match what the sender signed.
      verify: (req: express.Request, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(healthRouter);
  app.use(testOrdersRouter);
  app.use(shopifyWebhookRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, "unhandled request error");
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
