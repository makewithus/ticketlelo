import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handleResendWebhookEvent } from "../../lib/email/webhook-handler.js";
import { EmailSuppression } from "../../lib/email/suppression.js";
import { EmailJobRepository } from "../../lib/email/job-repository.js";
import { processEmailJob } from "../../lib/email/queue.js";
import { EmailStatus, EmailPriority, EmailType } from "../../lib/email/types.js";

describe("Phase 6: Webhook Deliverability & Suppression Engine", () => {
  beforeEach(() => {
    EmailSuppression.resetMemorySuppression();
    EmailJobRepository.resetMemoryStore();
  });

  test("handles email.delivered event and marks job DELIVERED", async () => {
    const job = await EmailJobRepository.createJob({
      recipient: "attendee@example.com",
      subject: "Test Pass",
      html: "<p>Pass</p>",
      priority: EmailPriority.P0,
      emailType: EmailType.TICKET_DELIVERY,
    });

    await EmailJobRepository.updateJob(job.id, {
      status: EmailStatus.SENT,
      providerMessageId: "re_msg_delivered_123",
    });

    const webhookPayload = {
      type: "email.delivered",
      data: {
        email_id: "re_msg_delivered_123",
        to: ["attendee@example.com"],
      },
    };

    const res = await handleResendWebhookEvent(webhookPayload);
    assert.ok(res.success);
    assert.equal(res.eventType, "email.delivered");

    const updated = await EmailJobRepository.getJob(job.id);
    assert.equal(updated.status, EmailStatus.DELIVERED);
    assert.ok(updated.deliveredAt);
  });

  test("handles email.bounced event, marks job BOUNCED, and suppresses recipient", async () => {
    const job = await EmailJobRepository.createJob({
      recipient: "bad-mailbox@example.com",
      subject: "Test Pass",
      html: "<p>Pass</p>",
      priority: EmailPriority.P0,
      emailType: EmailType.TICKET_DELIVERY,
    });

    await EmailJobRepository.updateJob(job.id, {
      status: EmailStatus.SENT,
      providerMessageId: "re_msg_bounce_456",
    });

    assert.equal(await EmailSuppression.isSuppressed("bad-mailbox@example.com"), false);

    const webhookPayload = {
      type: "email.bounced",
      data: {
        email_id: "re_msg_bounce_456",
        to: ["bad-mailbox@example.com"],
        bounce: {
          type: "hard_bounce",
          message: "Mailbox does not exist",
        },
      },
    };

    const res = await handleResendWebhookEvent(webhookPayload);
    assert.ok(res.success);

    const updated = await EmailJobRepository.getJob(job.id);
    assert.equal(updated.status, EmailStatus.BOUNCED);

    // Recipient is now suppressed
    assert.equal(await EmailSuppression.isSuppressed("bad-mailbox@example.com"), true);

    // Any future job for this recipient should be blocked
    const newJob = await EmailJobRepository.createJob({
      recipient: "bad-mailbox@example.com",
      subject: "Another Attempt",
      html: "<p>Hello</p>",
      priority: EmailPriority.P0,
      emailType: EmailType.TICKET_DELIVERY,
    });

    const sendRes = await processEmailJob(newJob.id);
    assert.equal(sendRes.success, false);
    assert.equal(sendRes.reason, "suppressed");

    const blockedJob = await EmailJobRepository.getJob(newJob.id);
    assert.equal(blockedJob.status, EmailStatus.FAILED);
  });

  test("handles email.complained event, marks job COMPLAINED, and suppresses recipient", async () => {
    const job = await EmailJobRepository.createJob({
      recipient: "complainer@example.com",
      subject: "Announcement",
      html: "<p>Update</p>",
      priority: EmailPriority.P3,
      emailType: EmailType.ANNOUNCEMENT,
    });

    await EmailJobRepository.updateJob(job.id, {
      status: EmailStatus.SENT,
      providerMessageId: "re_msg_spam_789",
    });

    const webhookPayload = {
      type: "email.complained",
      data: {
        email_id: "re_msg_spam_789",
        to: ["complainer@example.com"],
      },
    };

    await handleResendWebhookEvent(webhookPayload);

    const updated = await EmailJobRepository.getJob(job.id);
    assert.equal(updated.status, EmailStatus.COMPLAINED);

    assert.equal(await EmailSuppression.isSuppressed("complainer@example.com"), true);
  });
});
