import { Router } from "express";
import { getMetricsReport } from "../../observability/metricsReport";
import { isAuthorizedByApiKey } from "../apiKeyAuth";
import { env } from "../../config/env";
import { logger } from "../../observability/logger";

export const metricsRouter = Router();

/**
 * Fails closed: this endpoint exposes per-client business data (confirmation
 * rate, no-show rate, cost) on a public Railway URL, so an unset
 * METRICS_API_KEY means "reject," not "open by default" — same pattern as
 * SHOPIFY_WEBHOOK_SECRET in shopifyWebhook.ts.
 */
metricsRouter.get("/api/metrics", async (req, res) => {
  if (!env.METRICS_API_KEY) {
    logger.error("METRICS_API_KEY not configured, rejecting metrics request");
    return res.status(500).json({ error: "metrics_not_configured" });
  }

  if (!isAuthorizedByApiKey(req, env.METRICS_API_KEY)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const clientSlug = typeof req.query.client === "string" ? req.query.client : undefined;
  const report = await getMetricsReport(clientSlug);

  return res.json(report);
});
