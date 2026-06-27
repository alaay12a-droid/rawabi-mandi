import { schedule } from "node-cron";
import app from "./app";
import { logger } from "./lib/logger";
import { seedMenu } from "./routes/menu";
import { seedOccasions } from "./routes/occasions";
import { cleanupExpiredDiscountCodes } from "./routes/discounts";
import { seedDashboardAdmin } from "./routes/dashboard-auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  seedMenu().catch((e) => logger.error({ err: e }, "Menu seed failed"));
  seedOccasions().catch((e) => logger.error({ err: e }, "Occasions seed failed"));
  seedDashboardAdmin().catch((e) => logger.error({ err: e }, "Dashboard admin seed failed"));

  schedule(
    "0 0 * * *",
    () => {
      cleanupExpiredDiscountCodes()
        .then((n) => logger.info({ deleted: n }, "Scheduled cleanup: expired discount codes removed"))
        .catch((e) => logger.error({ err: e }, "Scheduled cleanup: failed to remove expired discount codes"));
    },
    { timezone: "Asia/Riyadh" },
  );
  logger.info("Scheduled daily discount-code cleanup at midnight (Riyadh time)");
});
