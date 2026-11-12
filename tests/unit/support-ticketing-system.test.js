import test from "node:test";
import assert from "node:assert/strict";
import {
  validateTicketPayload,
  validateMessagePayload,
} from "../../lib/support/support-validator.js";
import { generateSupportTicketId } from "../../lib/support/ticket-id-generator.js";
import {
  createSupportTicket,
  getTicketById,
  addMessageToTicket,
  updateTicketStatus,
  assignTicket,
  listTicketsForOrganizer,
  listTicketsForSuperAdmin,
} from "../../lib/support/support-service.js";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  SUPPORT_ROLES,
} from "../../lib/support/types.js";

test("Support Ticketing System Test Suite", async (t) => {
  await t.test("Validation: Enforces all mandatory fields and phone country code", () => {
    // Valid input passes cleanly
    const valid = validateTicketPayload({
      fullName: "Adil Mohammed",
      email: "adil@ticketlelo.com",
      phone: "+91 9876543210",
      category: "SETTLEMENT_PAYOUT",
      subject: "Payout inquiry for tech fest",
      description: "My payout is due on Tuesday and I need verification.",
      priority: "HIGH",
    });
    assert.equal(valid.fullName, "Adil Mohammed");
    assert.equal(valid.category, "Settlements and Payouts");
    assert.equal(valid.priority, "HIGH");

    // Rejects invalid email
    assert.throws(
      () => {
        validateTicketPayload({
          fullName: "Adil M",
          email: "invalid-email-format",
          phone: "+91 9876543210",
          category: "GENERAL_INQUIRY",
          subject: "Test Subject",
          description: "A description of sufficient length.",
        });
      },
      /email/i,
      "Invalid email must throw validation error"
    );

    // Rejects phone without country code
    assert.throws(
      () => {
        validateTicketPayload({
          fullName: "Adil M",
          email: "adil@example.com",
          phone: "9876543210", // Missing + prefix or country code
          category: "GENERAL_INQUIRY",
          subject: "Test Subject",
          description: "A description of sufficient length.",
        });
      },
      /country code/i,
      "Phone without country code must throw validation error"
    );

    // Rejects invalid category (outside the 9 domain categories)
    assert.throws(
      () => {
        validateTicketPayload({
          fullName: "Adil M",
          email: "adil@example.com",
          phone: "+91 9876543210",
          category: "RANDOM_UNSUPPORTED_CATEGORY",
          subject: "Test Subject",
          description: "A description of sufficient length.",
        });
      },
      /category/i,
      "Unsupported category must throw validation error"
    );

    // Rejects short description (< 10 chars)
    assert.throws(
      () => {
        validateTicketPayload({
          fullName: "Adil M",
          email: "adil@example.com",
          phone: "+91 9876543210",
          category: "TECHNICAL_BUG",
          subject: "Test Subject",
          description: "Too short",
        });
      },
      /10 characters/i,
      "Short description must throw validation error"
    );
  });

  await t.test("Ticket ID Generator: Generates unique, monotonic sequential IDs", async () => {
    const id1 = await generateSupportTicketId();
    const id2 = await generateSupportTicketId();
    const id3 = await generateSupportTicketId();

    assert.match(id1, /^TKT-\d+$/, "Ticket ID must match TKT-xxxxx format");
    assert.match(id2, /^TKT-\d+$/, "Ticket ID must match TKT-xxxxx format");
    assert.match(id3, /^TKT-\d+$/, "Ticket ID must match TKT-xxxxx format");

    // Ensure IDs are strictly monotonic and distinct
    assert.notEqual(id1, id2);
    assert.notEqual(id2, id3);

    const num1 = parseInt(id1.replace("TKT-", ""), 10);
    const num2 = parseInt(id2.replace("TKT-", ""), 10);
    assert.equal(num2, num1 + 1, "IDs must increment monotonically");
  });

  await t.test("Support Service: End-to-end ticket creation and role-enforced privacy", async () => {
    // 1. Organizer creates a ticket
    const ticket = await createSupportTicket({
      organizerId: "org_alpha_001",
      fullName: "Organizer Alpha",
      email: "alpha@example.com",
      phone: "+91 9123456789",
      category: "SETTLEMENT_PAYOUT",
      subject: "T+4 Payout Timing Dispute",
      description: "When will the funds for order ord_12345 settle into my account?",
      priority: "HIGH",
      relatedEntity: {
        type: "settlement",
        settlementId: "SETT-ord_12345",
        orderId: "ord_12345",
        amountPaise: 95000,
      },
    });

    assert.ok(ticket.ticketId.startsWith("TKT-"));
    assert.equal(ticket.status, SUPPORT_STATUSES.OPEN);
    assert.equal(ticket.organizerId, "org_alpha_001");
    assert.equal(ticket.relatedEntity.orderId, "ord_12345");

    // 2. Super Admin adds a private internal note (visible ONLY to staff)
    const internalNote = await addMessageToTicket(ticket.ticketId, {
      senderId: "superadmin_01",
      senderName: "Chief Risk Officer",
      senderRole: SUPPORT_ROLES.SUPERADMIN,
      content: "CONFIDENTIAL: Organizer bank verification is currently under fraud review. DO NOT DISCLOSE TO USER.",
      isInternalNote: true,
    });
    assert.equal(internalNote.isInternalNote, true);

    // 3. Super Admin adds a public reply (visible to organizer)
    const publicReply = await addMessageToTicket(ticket.ticketId, {
      senderId: "superadmin_01",
      senderName: "TicketLelo Support",
      senderRole: SUPPORT_ROLES.SUPERADMIN,
      content: "Hello! We are currently reconciling banking settlement cycles for your festival and will disburse on Tuesday.",
      isInternalNote: false,
    });
    assert.equal(publicReply.isInternalNote, false);

    // 4. CRITICAL PRIVACY VERIFICATION: Organizer retrieves their ticket
    const organizerView = await getTicketById(ticket.ticketId, {
      callerRole: SUPPORT_ROLES.ORGANIZER,
      callerId: "org_alpha_001",
    });

    assert.ok(organizerView, "Organizer must be able to view their ticket");
    // Verify that the private internal note was stripped completely!
    const organizerMessages = organizerView.messages;
    const hasInternalNote = organizerMessages.some((m) => m.isInternalNote === true || m.content.includes("CONFIDENTIAL"));
    assert.equal(hasInternalNote, false, "CRITICAL: Internal notes must NEVER be exposed to organizers");
    // Public reply must be visible
    const hasPublicReply = organizerMessages.some((m) => m.content.includes("Hello! We are currently reconciling"));
    assert.equal(hasPublicReply, true, "Public reply must be visible to organizer");

    // 5. Super Admin retrieves the same ticket
    const adminView = await getTicketById(ticket.ticketId, {
      callerRole: SUPPORT_ROLES.SUPERADMIN,
      callerId: "superadmin_01",
    });

    const adminMessages = adminView.messages;
    const adminHasInternalNote = adminMessages.some((m) => m.isInternalNote === true);
    assert.equal(adminHasInternalNote, true, "Super Admin MUST see private internal notes");

    // 6. Security: Another organizer is blocked from accessing this ticket (403 Forbidden)
    await assert.rejects(
      async () => {
        await getTicketById(ticket.ticketId, {
          callerRole: SUPPORT_ROLES.ORGANIZER,
          callerId: "org_other_user_999",
        });
      },
      /access denied/i,
      "Unauthorized organizer must receive 403 Access Denied"
    );

    // 7. Status transitions and staff assignment
    const updatedStatus = await updateTicketStatus(ticket.ticketId, {
      newStatus: SUPPORT_STATUSES.RESOLVED,
      adminId: "superadmin_01",
      reason: "Inquiry fully answered with settlement date confirmation",
    });
    assert.equal(updatedStatus.status, SUPPORT_STATUSES.RESOLVED);

    const assigned = await assignTicket(ticket.ticketId, {
      assignedTo: "staff_vikram",
      assignedToName: "Vikram S",
    });
    assert.equal(assigned.assignedTo, "staff_vikram");
  });

  await t.test("Support Service: List queries filter accurately for organizers and Super Admin", async () => {
    // List for organizer
    const orgList = await listTicketsForOrganizer("org_alpha_001");
    assert.ok(Array.isArray(orgList));
    assert.ok(orgList.length >= 1);
    assert.equal(orgList[0].organizerId, "org_alpha_001");

    // List for Super Admin with search term
    const superList = await listTicketsForSuperAdmin({
      searchTerm: "ord_12345",
    });
    assert.ok(Array.isArray(superList));
    assert.ok(superList.length >= 1);
  });
});
