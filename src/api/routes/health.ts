import { Router } from "express";
import { checkDbConnection } from "../../db/pool";
import { connection } from "../../queue/connection";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const dbOk = await checkDbConnection();

  let redisOk = false;
  try {
    redisOk = (await connection.ping()) === "PONG";
  } catch {
    redisOk = false;
  }

  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", db: dbOk, redis: redisOk });
});
