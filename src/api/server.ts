import { createApp } from "./app";
import { env } from "../config/env";
import { logger } from "../observability/logger";
import { startConfirmationWorker } from "../queue/confirmationWorker";
import { startRetryWorker } from "../queue/retryWorker";

const app = createApp();

// Workers run in-process for now — fine at this scale, split into their own
// process once send volume justifies scaling API and workers independently.
startConfirmationWorker();
startRetryWorker();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "server listening");
});
