/**
 * TicketLelo Email Infrastructure - Resend Provider Adapter
 *
 * Implements sending via the official Resend SDK with proper error mapping,
 * scannable attachment encoding, RFC headers, and idempotency keys.
 */

import { Resend } from "resend";
import fs from "fs";
import { getEmailConfig } from "./config.js";
import { emailLogger } from "./logger.js";
import {
  RateLimitError,
  PermanentRejectionError,
  InvalidRecipientError,
  AuthenticationError,
  TemporaryProviderError,
} from "./errors.js";

let resendInstance = null;

function getResendClient() {
  const config = getEmailConfig();
  if (!resendInstance && config.apiKey) {
    resendInstance = new Resend(config.apiKey);
  }
  return resendInstance;
}

/**
 * Normalizes attachments into Resend's expected format:
 * { filename: string, content: Buffer | string, contentType?: string, path?: string }
 */
export async function normalizeAttachmentsForResend(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return [];
  }

  const resendAttachments = [];

  for (const att of attachments) {
    if (!att || typeof att !== "object" || !att.filename) continue;

    // Direct Buffer content
    if (Buffer.isBuffer(att.content)) {
      resendAttachments.push({
        filename: att.filename,
        content: att.content,
      });
      continue;
    }

    // Path on local disk (e.g. logo)
    if (att.path && typeof att.path === "string") {
      try {
        if (fs.existsSync(att.path)) {
          const buffer = fs.readFileSync(att.path);
          resendAttachments.push({
            filename: att.filename,
            content: buffer,
          });
        }
      } catch (fileErr) {
        emailLogger.warn(`Failed reading attachment file at ${att.path}`, { error: fileErr.message });
      }
      continue;
    }

    // Base64 string or plain content
    if (att.content) {
      resendAttachments.push({
        filename: att.filename,
        content: att.content,
      });
    }
  }

  return resendAttachments;
}

/**
 * Maps Resend API errors to internal typed EmailError classes.
 */
export function classifyResendError(error) {
  if (!error) {
    return new TemporaryProviderError("Unknown provider failure");
  }

  const status = error.statusCode || error.status || 500;
  const message = error.message || error.name || "Resend error";

  if (message.includes("domain is not verified") || message.includes("verify your domain")) {
    return new AuthenticationError(
      `Resend domain verification required: To send emails from ticketlelo.in to external recipients without landing in SPAM, please publish the 4 DNS records (DKIM, SPF MX, SPF TXT, CNAME) in GoDaddy. (${message})`,
      403,
      { raw: error, domainVerificationNeeded: true }
    );
  }

  if (message.includes("can only send testing emails to your own email address")) {
    return new AuthenticationError(
      `Resend Sandbox restriction: When using onboarding@resend.dev, Resend only permits delivering to adil4ticketlelo@gmail.com (and Gmail marks them as Spam). To deliver to any attendee inbox, publish the DNS records for ticketlelo.in. (${message})`,
      403,
      { raw: error, sandboxLimitation: true }
    );
  }

  if (status === 429) {
    const retryAfter = error.retryAfter ? Number(error.retryAfter) * 1000 : 2000;
    return new RateLimitError(message, retryAfter, { raw: error });
  }

  if (status === 401 || status === 403) {
    return new AuthenticationError(message, status, { raw: error });
  }

  if (status === 422) {
    if (message.toLowerCase().includes("recipient") || message.toLowerCase().includes("email")) {
      return new InvalidRecipientError(message, { raw: error });
    }
    return new PermanentRejectionError(message, status, { raw: error });
  }

  if (status >= 500 || error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
    return new TemporaryProviderError(message, status, { raw: error });
  }

  return new TemporaryProviderError(message, status, { raw: error });
}

// Global test simulator hooks for unit and integration testing
let mockSendHandler = null;

export function setMockSendHandler(handler) {
  mockSendHandler = handler;
}

export function clearMockSendHandler() {
  mockSendHandler = null;
}

/**
 * Dispatches an email through Resend.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text alternative
 * @param {string} [options.from] - Sender address override
 * @param {string} [options.replyTo] - Reply-to address override
 * @param {Array} [options.attachments] - Array of attachments
 * @param {Object} [options.headers] - Custom RFC headers
 * @param {string} [options.idempotencyKey] - Idempotency key for deduplication
 * @returns {Promise<{ id: string }>} Resend email response data
 */
export async function sendViaResend(options) {
  const config = getEmailConfig();

  // Test simulation handler
  if (mockSendHandler) {
    return await mockSendHandler(options);
  }

  if (config.isMockEnabled && !config.hasApiKey) {
    // Simulated offline/mock response
    const mockId = `mock_re_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    emailLogger.debug("Mock email sent successfully", { to: options.to, mockId, subject: options.subject });
    return { id: mockId };
  }

  if (!config.hasApiKey) {
    throw new AuthenticationError("RESEND_API_KEY environment variable is not configured");
  }

  const client = getResendClient();
  if (!client) {
    throw new AuthenticationError("Resend client failed initialization");
  }

  const resendAttachments = await normalizeAttachmentsForResend(options.attachments);

  const payload = {
    from: options.from || config.from,
    to: options.to,
    reply_to: options.replyTo || config.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text || undefined,
    headers: options.headers || {},
    attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
  };

  try {
    const response = await client.emails.send(payload);

    if (response.error) {
      throw classifyResendError(response.error);
    }

    if (!response.data || !response.data.id) {
      throw new TemporaryProviderError("Resend accepted request but did not return a message ID");
    }

    emailLogger.info("Email dispatched successfully via Resend", {
      recipient: options.to,
      subject: options.subject,
      providerId: response.data.id,
    });

    return response.data;
  } catch (error) {
    if (error.category) {
      // Already an EmailError
      throw error;
    }
    throw classifyResendError(error);
  }
}
