import cluster from "cluster";
import os from "os";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isProduction = process.env["NODE_ENV"] === "production";
const MAX_WORKERS = 4;
const workerCount = Math.min(os.cpus().length, MAX_WORKERS);

if (isProduction && cluster.isPrimary) {
  logger.info({ workerCount }, "Primary process starting cluster");

  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn({ pid: worker.process.pid, code, signal }, "Worker exited — restarting");
    cluster.fork();
  });
} else {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    const pid = process.pid;
    if (isProduction) {
      logger.info({ port, pid, workerCount }, "Worker listening");
    } else {
      logger.info({ port, pid }, "Server listening");
    }
  });
}
