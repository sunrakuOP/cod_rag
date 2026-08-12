import { createApp } from "./app";
import { env } from "../config/env";
import { logger } from "../observability/logger";
import { startConfirmationWorker } from "../queue/confirmationWorker";

const app = createApp();

// Worker runs in-process for now — fine at this scale, split into its own
// process once send volume justifies scaling API and worker independently.
startConfirmationWorker();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "server listening");
});
