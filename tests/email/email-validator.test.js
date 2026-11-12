import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateAndNormalizeEmail,
  isSuppressedSuperAdminAddress,
  validateEmailPayload,
} from "../../lib/email/validator.js";
import { InvalidRecipientError } from "../../lib/email/errors.js";
import { EmailPriority } from "../../lib/email/types.js";

describe("Phase 1 & 2: Email Address & Payload Validation", () => {
  test("validates and normalizes valid email addresses", () => {
    assert.equal(validateAndNormalizeEmail("Aarav@example.com"), "aarav@example.com");
    assert.equal(validateAndNormalizeEmail("  user.name+tag@ticketlelo.in  "), "user.name+tag@ticketlelo.in");
  });

  test("suppresses non-existent superadmin mailbox addresses", () => {
    assert.equal(validateAndNormalizeEmail("superadmin@ticketlelo.com"), null);
    assert.equal(validateAndNormalizeEmail("superadin@ticketlelo.com"), null);
    assert.equal(validateAndNormalizeEmail("  SUPERADMIN@ticketlelo.com  "), null);
    assert.ok(isSuppressedSuperAdminAddress("superadmin@ticketlelo.com"));
    assert.ok(isSuppressedSuperAdminAddress("superadin@ticketlelo.com"));
    assert.equal(isSuppressedSuperAdminAddress("organizer@ticketlelo.in"), false);
  });

  test("rejects malformed email formats with InvalidRecipientError", () => {
    assert.throws(() => validateAndNormalizeEmail("not-an-email"), InvalidRecipientError);
    assert.throws(() => validateAndNormalizeEmail("missing@domain"), InvalidRecipientError);
    assert.throws(() => validateAndNormalizeEmail("@nodomain.com"), InvalidRecipientError);
    assert.throws(() => validateAndNormalizeEmail(""), InvalidRecipientError);
    assert.throws(() => validateAndNormalizeEmail(null), InvalidRecipientError);
  });

  test("validates complete email payload", () => {
    const payload = {
      to: "attendee@example.com",
      subject: "Your Ticket Confirmation",
      html: "<p>Hello</p>",
      priority: EmailPriority.P0,
      emailType: "ticket_delivery",
      attachments: [{ filename: "ticket.pdf", content: Buffer.from("pdf") }],
    };

    const validated = validateEmailPayload(payload);
    assert.equal(validated.to, "attendee@example.com");
    assert.equal(validated.subject, "Your Ticket Confirmation");
    assert.equal(validated.priority, EmailPriority.P0);
    assert.equal(validated.emailType, "ticket_delivery");
    assert.equal(validated.attachments.length, 1);
  });

  test("rejects payload missing subject or body", () => {
    assert.throws(
      () => validateEmailPayload({ to: "user@example.com", html: "<p>No subject</p>" }),
      /Email subject must be a non-empty string/
    );
    assert.throws(
      () => validateEmailPayload({ to: "user@example.com", subject: "Subject" }),
      /Email must contain either an html or text body/
    );
  });
});
