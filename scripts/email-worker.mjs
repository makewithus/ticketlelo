#!/usr/bin/env node
/**
 * Standalone background worker process for TicketLelo email processing.
 *
 * Usage:
 *   node scripts/email-worker.mjs
 *   npm run email:worker
 */

try {
  process.loadEnvFile?.(".env");
} catch {}

import { EmailWorkerService } from "../lib/email/worker.js";
import { emailLogger } from "../lib/email/logger.js";

const worker = new EmailWorkerService();

emailLogger.info("Starting TicketLelo standalone background email worker process...");
worker.start();

const shutdown = async (signal) => {
  emailLogger.info(`Received ${signal}, initiating graceful shutdown...`);
  await worker.stop();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
