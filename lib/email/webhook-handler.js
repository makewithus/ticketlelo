/**
 * TicketLelo Email Infrastructure - Resend Webhook Handler
 *
 * Verifies cryptographic webhook signatures via Svix,
 * updates durable email job lifecycle states (SENT, DELIVERED, BOUNCED, COMPLAINED),
 * and automatically populates the recipient suppression list on hard bounces or spam complaints.
 */

import { Webhook } from "svix";
import { getEmailConfig } from "./config.js";
import { EmailJobRepository } from "./job-repository.js";
import { EmailSuppression } from "./suppression.js";
import { EmailStatus } from "./types.js";
import { emailLogger } from "./logger.js";
import { adminDb } from "../firebase-admin.js";

/**
 * Handles verified Resend event payloads.
 *
 * @param {Object} event - Verified webhook JSON payload
 * @returns {Promise<Object>}
 */
export async function handleResendWebhookEvent(event) {
  if (!event || typeof event !== "object") {
    throw new Error("Invalid webhook event structure");
  }

  const eventType = event.type;
  const data = event.data || {};
  const emailId = data.email_id || data.id;
  const toAddress = Array.isArray(data.to) ? data.to[0] : data.to;

  emailLogger.info(`Received Resend webhook event: ${eventType}`, {
    emailId,
    recipient: toAddress,
    eventType,
  });

  let matchingJob = null;

  // 1. Locate job by providerMessageId
  if (emailId) {
    matchingJob = await EmailJobRepository.getJobByProviderMessageId(emailId);
  }

  const now = new Date();

  switch (eventType) {
    case "email.sent": {
      if (matchingJob) {
        await EmailJobRepository.updateJob(matchingJob.id, {
          status: EmailStatus.SENT,
          sentAt: now,
          updatedAt: now,
        });
      }
      break;
    }

    case "email.delivered": {
      if (matchingJob) {
        await EmailJobRepository.updateJob(matchingJob.id, {
          status: EmailStatus.DELIVERED,
          deliveredAt: now,
          updatedAt: now,
        });
      }
      break;
    }

    case "email.delivery_delayed": {
      if (matchingJob) {
        await EmailJobRepository.updateJob(matchingJob.id, {
          error: "Provider reported delivery delayed",
          updatedAt: now,
        });
      }
      break;
    }

    case "email.bounced": {
      if (matchingJob) {
        await EmailJobRepository.updateJob(matchingJob.id, {
          status: EmailStatus.BOUNCED,
          error: JSON.stringify(data.bounce || "Email bounced"),
          updatedAt: now,
        });
      }
      if (toAddress) {
        await EmailSuppression.suppress(toAddress, "bounced", data.bounce || {});
        emailLogger.warn(`Recipient ${toAddress} suppressed following hard bounce`, { emailId });
      }
      break;
    }

    case "email.complained": {
      if (matchingJob) {
        await EmailJobRepository.updateJob(matchingJob.id, {
          status: EmailStatus.COMPLAINED,
          error: "Recipient marked message as spam",
          updatedAt: now,
        });
      }
      if (toAddress) {
        await EmailSuppression.suppress(toAddress, "complained", data);
        emailLogger.warn(`Recipient ${toAddress} suppressed following spam complaint`, { emailId });
      }
      break;
    }

    default:
      emailLogger.debug(`Unhandled Resend webhook event type: ${eventType}`);
  }

  return {
    success: true,
    eventType,
    emailId,
    jobId: matchingJob?.id || null,
  };
}

/**
 * Verifies the cryptographic Svix signature on an incoming webhook request
 * and delegates processing to handleResendWebhookEvent.
 *
 * @param {string} rawBody - Raw body text of the HTTP request
 * @param {Headers|Object} headers - Request headers
 * @returns {Promise<Object>}
 */
export async function verifyAndProcessResendWebhook(rawBody, headers) {
  const config = getEmailConfig();

  // Extract svix headers
  const getHeader = (key) => {
    if (headers && typeof headers.get === "function") {
      return headers.get(key) || headers.get(key.toLowerCase());
    }
    return headers ? (headers[key] || headers[key.toLowerCase()]) : null;
  };

  const svixId = getHeader("svix-id");
  const svixTimestamp = getHeader("svix-timestamp");
  const svixSignature = getHeader("svix-signature");

  // In test or simulation environment without secret
  if (config.isMockEnabled && (!config.webhookSecret || !svixSignature)) {
    const parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    return await handleResendWebhookEvent(parsed);
  }

  if (!config.webhookSecret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured on server");
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Missing required svix signature headers");
  }

  const wh = new Webhook(config.webhookSecret);
  let verifiedEvent;

  try {
    verifiedEvent = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    emailLogger.warn("Invalid webhook signature received", { error: err.message });
    throw new Error(`Invalid webhook signature: ${err.message}`);
  }

  return await handleResendWebhookEvent(verifiedEvent);
}
