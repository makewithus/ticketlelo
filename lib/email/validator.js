/**
 * TicketLelo Email Infrastructure - Validator
 *
 * Validates recipient addresses, suppresses known non-existent mailboxes,
 * and ensures message payloads conform to deliverability standards.
 */

import { InvalidRecipientError } from "./errors.js";
import { EmailPriority } from "./types.js";

// RFC 5322 simplified but strict regex for valid mailbox format
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Normalized check for non-existent administrative mailboxes that must never receive mail.
 */
export function isSuppressedSuperAdminAddress(email) {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === "superadmin@ticketlelo.com" ||
    normalized === "superadin@ticketlelo.com"
  );
}

/**
 * Validates and normalizes an email address.
 * Throws InvalidRecipientError if format is invalid.
 * Returns null if the address is a suppressed internal non-existent mailbox.
 *
 * @param {string} email
 * @returns {string|null} Normalized email or null if suppressed internal address
 */
export function validateAndNormalizeEmail(email) {
  if (!email || typeof email !== "string") {
    throw new InvalidRecipientError("Recipient email must be a non-empty string");
  }

  const normalized = email.trim().toLowerCase();

  if (isSuppressedSuperAdminAddress(normalized)) {
    return null;
  }

  if (normalized.length > 254) {
    throw new InvalidRecipientError(`Email address exceeds maximum length of 254 characters: ${normalized.slice(0, 30)}...`);
  }

  if (!EMAIL_REGEX.test(normalized)) {
    throw new InvalidRecipientError(`Malformed email address format: ${normalized}`);
  }

  return normalized;
}

/**
 * Validates an email job payload before enqueuing.
 *
 * @param {Object} payload
 * @returns {Object} Cleaned, validated payload
 */
export function validateEmailPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Email payload must be an object");
  }

  const { to, subject, html, text, priority, emailType, attachments, idempotencyKey } = payload;

  const normalizedTo = validateAndNormalizeEmail(to);

  if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
    throw new Error("Email subject must be a non-empty string");
  }

  if (!html && !text) {
    throw new Error("Email must contain either an html or text body");
  }

  const validPriority = Object.values(EmailPriority).includes(priority)
    ? priority
    : EmailPriority.P2;

  // Validate attachments if provided
  const cleanedAttachments = [];
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (!att || typeof att !== "object" || !att.filename) {
        continue;
      }
      const item = {
        filename: String(att.filename),
        contentType: att.contentType || "application/octet-stream",
      };
      if (att.content !== undefined) item.content = att.content;
      if (att.path !== undefined) item.path = att.path;
      if (att.cid !== undefined) item.cid = att.cid;
      cleanedAttachments.push(item);
    }
  }

  return {
    to: normalizedTo,
    subject: subject.trim(),
    html: html || "",
    text: text || "",
    priority: validPriority,
    emailType: emailType || "transactional",
    attachments: cleanedAttachments,
    idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : null,
  };
}
