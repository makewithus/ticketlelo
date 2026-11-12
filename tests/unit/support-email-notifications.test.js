import test from "node:test";
import assert from "node:assert/strict";
import {
  renderSuperAdminNewTicketEmail,
  renderOrganizerConfirmationEmail,
  renderOrganizerReplyEmail,
  renderStatusChangeEmail,
} from "../../lib/email/templates/support-ticket.js";
import { getSuperAdminSupportEmail } from "../../lib/support/support-service.js";

test("Support Email Notifications Test Suite", async (t) => {
  const sampleTicket = {
    ticketId: "TKT-10025",
    organizerName: "Aarav Sharma",
    email: "aarav@techconclave.org",
    phone: "+91 9876543210",
    category: "Settlements and Payouts",
    subject: "T+4 Holiday Settlement Clarification",
    description: "Will our payout for Diwali weekend be processed on Monday or Wednesday?",
    priority: "HIGH",
    relatedEntity: {
      type: "settlement",
      id: "SETT-ord_998877",
      amountPaise: 1250000, // ₹12,500.00
      status: "SCHEDULED",
    },
    createdAt: "2026-11-04T10:00:00.000Z",
  };

  await t.test("Super Admin Alert: Renders complete organizer, priority, and financial details", () => {
    const rendered = renderSuperAdminNewTicketEmail({
      ticket: sampleTicket,
      adminUrl: "https://ticketlelo.com/superadmin/support?ticketId=TKT-10025",
    });

    assert.ok(rendered.subject.includes("TKT-10025"));
    assert.ok(rendered.subject.includes("Settlements and Payouts"));

    // Check HTML contents
    assert.ok(rendered.html.includes("Aarav Sharma"));
    assert.ok(rendered.html.includes("aarav@techconclave.org"));
    assert.ok(rendered.html.includes("+91 9876543210"));
    assert.ok(rendered.html.includes("T+4 Holiday Settlement Clarification"));
    assert.ok(rendered.html.includes("SETT-ord_998877"));
    assert.ok(rendered.html.includes("₹12,500.00"));
    assert.ok(rendered.html.includes("https://ticketlelo.com/superadmin/support?ticketId=TKT-10025"));

    // Check Plain text fallback
    assert.ok(rendered.text.includes("TKT-10025"));
    assert.ok(rendered.text.includes("+91 9876543210"));
    assert.ok(rendered.text.includes("https://ticketlelo.com/superadmin/support?ticketId=TKT-10025"));
  });

  await t.test("Organizer Confirmation: Confirms receipt and clearly communicates 24-hour SLA", () => {
    const rendered = renderOrganizerConfirmationEmail({
      ticket: sampleTicket,
      ticketUrl: "https://ticketlelo.com/admin/support?ticketId=TKT-10025",
      slaHours: 24,
    });

    assert.ok(rendered.subject.includes("TKT-10025"));
    assert.ok(rendered.html.includes("24"));
    assert.ok(rendered.html.includes("business hours"));
    assert.ok(rendered.html.includes("Aarav Sharma"));
    assert.ok(rendered.html.includes("https://ticketlelo.com/admin/support?ticketId=TKT-10025"));
    assert.ok(rendered.text.includes("TKT-10025"));
    assert.ok(rendered.text.includes("24"));
  });

  await t.test("Organizer Public Reply: Dispatches message thread update to organizer", () => {
    const rendered = renderOrganizerReplyEmail({
      ticket: sampleTicket,
      reply: {
        senderName: "TicketLelo Risk & Settlements",
        content: "Hello Aarav! Because Diwali is a gazetted banking holiday, your T+4 working settlement moves to Wednesday Nov 11.",
        createdAt: "2026-11-04T12:30:00.000Z",
      },
      ticketUrl: "https://ticketlelo.com/admin/support?ticketId=TKT-10025",
    });

    assert.ok(rendered.subject.includes("TKT-10025"));
    assert.ok(rendered.html.includes("TicketLelo Risk & Settlements"));
    assert.ok(rendered.html.includes("Diwali is a gazetted banking holiday"));
    assert.ok(rendered.html.includes("https://ticketlelo.com/admin/support?ticketId=TKT-10025"));
  });

  await t.test("Status Change Notification: Informs organizer when ticket is marked RESOLVED", () => {
    const rendered = renderStatusChangeEmail({
      ticket: sampleTicket,
      newStatus: "RESOLVED",
      ticketUrl: "https://ticketlelo.com/admin/support?ticketId=TKT-10025",
    });

    assert.ok(rendered.subject.includes("TKT-10025"));
    assert.ok(rendered.subject.includes("Resolved") || rendered.subject.includes("RESOLVED"));
    assert.ok(rendered.html.includes("RESOLVED"));
    assert.ok(rendered.html.includes("Aarav Sharma"));
  });

  await t.test("Configurable Super Admin Email: Resolves environment overrides and fallback", async () => {
    // 1. Fallback default
    const originalSupportEnv = process.env.SUPER_ADMIN_SUPPORT_EMAIL;
    const originalAdminEnv = process.env.SUPER_ADMIN_EMAIL;

    delete process.env.SUPER_ADMIN_SUPPORT_EMAIL;
    delete process.env.SUPER_ADMIN_EMAIL;

    const defaultEmail = await getSuperAdminSupportEmail();
    assert.equal(defaultEmail, "adil4ticketlelo@gmail.com");

    // 2. Specific SUPER_ADMIN_SUPPORT_EMAIL override
    process.env.SUPER_ADMIN_SUPPORT_EMAIL = "risk-operations@ticketlelo.in";
    const overriddenEmail = await getSuperAdminSupportEmail();
    assert.equal(overriddenEmail, "risk-operations@ticketlelo.in");

    // Restore environment
    if (originalSupportEnv) process.env.SUPER_ADMIN_SUPPORT_EMAIL = originalSupportEnv;
    else delete process.env.SUPER_ADMIN_SUPPORT_EMAIL;
    if (originalAdminEnv) process.env.SUPER_ADMIN_EMAIL = originalAdminEnv;
  });
});
