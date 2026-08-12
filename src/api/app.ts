import express from "express";
import { healthRouter } from "./routes/health";
import { testOrdersRouter } from "./routes/testOrders";
import { logger } from "../observability/logger";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(healthRouter);
  app.use(testOrdersRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, "unhandled request error");
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
