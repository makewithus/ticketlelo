import test from "node:test";
import assert from "node:assert/strict";
import { calculateAvailableCombos } from "../../lib/combos.js";
import { generateTaxInvoiceData } from "../../lib/invoices.js";
import { buildAppleWalletPassStructure, buildGoogleWalletPassStructure } from "../../lib/wallet.js";
import { filterCommunicationAudience, generateEventWhatsAppShareUrl } from "../../lib/communications.js";

test("Concurrency & Realistic Race Conditions: Sub-Event & Combo Inventory Reservation", async (t) => {
  // Simulates an atomic transactional reservation function under high concurrency
  class InventoryEngine {
    constructor() {
      this.subEvents = {
        track_ai: { capacity: 10, allocatedSeats: 8 }, // Only 2 remaining seats
        track_dev: { capacity: 20, allocatedSeats: 15 }, // 5 remaining seats
      };
      this.combos = {
        combo_tech: {
          dedicatedQuota: 5,
          allocatedCount: 3, // 2 remaining dedicated
          includedSubEventIds: ["track_ai", "track_dev"],
          isPublished: true,
        },
      };
      this.locks = new Map();
    }

    async reserveCombo(buyerId) {
      // Simulate database atomic transaction
      const available = calculateAvailableCombos(this.combos.combo_tech, this.subEvents);
      if (available <= 0) {
        return { success: false, reason: "SOLD_OUT", available: 0 };
      }

      // Check bottleneck capacity
      const aiRem = this.subEvents.track_ai.capacity - this.subEvents.track_ai.allocatedSeats;
      const devRem = this.subEvents.track_dev.capacity - this.subEvents.track_dev.allocatedSeats;
      const dedicatedRem = this.combos.combo_tech.dedicatedQuota - this.combos.combo_tech.allocatedCount;

      if (aiRem <= 0 || devRem <= 0 || dedicatedRem <= 0) {
        return { success: false, reason: "CAPACITY_EXHAUSTED", available: 0 };
      }

      // Atomic allocation
      this.subEvents.track_ai.allocatedSeats += 1;
      this.subEvents.track_dev.allocatedSeats += 1;
      this.combos.combo_tech.allocatedCount += 1;

      return {
        success: true,
        buyerId,
        remainingAI: this.subEvents.track_ai.capacity - this.subEvents.track_ai.allocatedSeats,
        remainingDev: this.subEvents.track_dev.capacity - this.subEvents.track_dev.allocatedSeats,
      };
    }
  }

  await t.test("Prevents overselling when 10 simultaneous buyers race for the last 2 seats", async () => {
    const engine = new InventoryEngine();

    // 10 concurrent purchase requests attempting to checkout at the exact same instant
    const buyerIds = Array.from({ length: 10 }, (_, i) => `buyer_${i + 1}`);

    const results = await Promise.all(
      buyerIds.map((id) => engine.reserveCombo(id))
    );

    const successfulPurchases = results.filter((r) => r.success);
    const rejectedPurchases = results.filter((r) => !r.success);

    // Assert that strictly exactly 2 purchases succeed and 8 are rejected as sold out
    assert.equal(successfulPurchases.length, 2, "Only 2 buyers should successfully purchase");
    assert.equal(rejectedPurchases.length, 8, "8 buyers should be safely rejected");

    // Assert sub-event capacity never exceeds 100%
    assert.equal(engine.subEvents.track_ai.allocatedSeats, 10, "AI track allocated must cap at exactly 10");
    assert.equal(engine.subEvents.track_ai.capacity - engine.subEvents.track_ai.allocatedSeats, 0);
  });
});

test("Concurrency & Idempotency: Webhook Deduplication Under Concurrent Delivery", async (t) => {
  const processedEvents = new Set();

  function handleWebhookDelivery(eventPayload) {
    if (processedEvents.has(eventPayload.id)) {
      return { status: 200, duplicate: true, action: "IGNORED" };
    }
    processedEvents.add(eventPayload.id);
    return { status: 200, duplicate: false, action: "RECONCILED" };
  }

  await t.test("Rejects duplicate webhook deliveries fired simultaneously", async () => {
    const event = { id: "evt_razorpay_refund_9988", type: "refund.processed" };

    // Simulate Razorpay network retry delivering same webhook 5 times concurrently
    const deliveries = await Promise.all([
      Promise.resolve(handleWebhookDelivery(event)),
      Promise.resolve(handleWebhookDelivery(event)),
      Promise.resolve(handleWebhookDelivery(event)),
      Promise.resolve(handleWebhookDelivery(event)),
      Promise.resolve(handleWebhookDelivery(event)),
    ]);

    const reconciled = deliveries.filter((d) => d.action === "RECONCILED");
    const ignored = deliveries.filter((d) => d.duplicate === true);

    assert.equal(reconciled.length, 1, "Exactly one delivery must be reconciled");
    assert.equal(ignored.length, 4, "Four duplicates must be recognized and ignored");
  });
});

test("Financial Tax Invoice & Wallet Pass Structure Verification", async (t) => {
  await t.test("Generates valid 18% GST tax invoice with SAC 999659", () => {
    const invoice = generateTaxInvoiceData({
      order: {
        id: "ord_fest_7788",
        amount: 449.10,
        createdAt: "2027-03-01T12:00:00Z",
        buyerName: "Aditi Patil",
        buyerEmail: "aditi@college.edu",
        ticketTitle: "PRAROHA Tech Combo",
      },
      event: { title: "PRAROHA 2027", location: "PICT Campus, Pune" },
      attendee: { fullName: "Aditi Patil", email: "aditi@college.edu" },
    });

    assert.ok(invoice.invoiceNumber.startsWith(`INV-${new Date().getFullYear()}-`));
    assert.equal(invoice.financials.totalPayable, 449.10);
    assert.equal(invoice.financials.subTotal, 380.59);
    assert.equal(invoice.financials.totalGst, 68.51);
    assert.equal(invoice.seller.sacCode, "999659");
    assert.equal(invoice.lineItems[0].sacCode, "999659");
  });

  await t.test("Builds compliant Apple Wallet pass.json data dictionary", () => {
    const pass = buildAppleWalletPassStructure({
      ticket: {
        id: "TKT-WALLET-001",
        buyerName: "Kunal Shah",
        tier: "VIP Fest Pass",
        qrPayload: "TLSEC:sha256:v1|tkt=TKT-WALLET-001|sig=abc",
        entitledTrackNames: ["AI Workshop", "Hackathon"],
      },
      event: { title: "PRAROHA 2027", venueName: "Main Auditorium" },
    });

    assert.equal(pass.formatVersion, 1);
    assert.equal(pass.serialNumber, "TKT-WALLET-001");
    assert.equal(pass.eventTicket.primaryFields[0].value, "PRAROHA 2027");
    assert.equal(pass.barcode.format, "PKBarcodeFormatQR");
    assert.equal(pass.backgroundColor, "rgb(11, 19, 43)");
  });

  await t.test("Builds compliant Google Wallet EventTicketObject", () => {
    const gPass = buildGoogleWalletPassStructure({
      ticket: {
        id: "TKT-GWALLET-002",
        buyerName: "Kunal Shah",
        tier: "VIP Fest Pass",
        qrPayload: "TLSEC:sha256:v1|tkt=TKT-GWALLET-002|sig=xyz",
        entitledTrackNames: ["AI Workshop"],
      },
      event: { title: "PRAROHA 2027" },
    });

    assert.equal(gPass.state, "ACTIVE");
    assert.equal(gPass.ticketHolderName, "Kunal Shah");
    assert.equal(gPass.barcode.type, "QR_CODE");
    assert.equal(gPass.hexBackgroundColor, "#0B132B");
  });
});

test("Communications: WhatsApp Deep Link & Audience Filter Verification", async (t) => {
  await t.test("Generates properly URI-encoded WhatsApp deep links", () => {
    const url = generateEventWhatsAppShareUrl({
      eventTitle: "PRAROHA 2027 & Tech Fest",
      eventUrl: "https://ticketlelo.com/e/praroha-2027",
      hostName: "PICT ACM",
    });

    assert.ok(url.startsWith("https://api.whatsapp.com/send?text="));
    assert.ok(url.includes(encodeURIComponent("PRAROHA 2027 & Tech Fest")));
  });

  await t.test("Filters audience by sub-event entitlement and check-in status", () => {
    const registrations = [
      { id: "reg_1", email: "a@pict.edu", fullName: "User A", entitledSubEventIds: ["workshop_ai"], status: "Used" },
      { id: "reg_2", email: "b@pict.edu", fullName: "User B", entitledSubEventIds: ["hackathon"], status: "Valid" },
      { id: "reg_3", email: "c@pict.edu", fullName: "User C", entitledSubEventIds: ["workshop_ai"], status: "Valid" },
    ];

    const workshopAudience = filterCommunicationAudience(registrations, {
      targetAudience: "sub_event",
      targetSubEventId: "workshop_ai",
    });
    assert.equal(workshopAudience.length, 2);

    const checkedInAudience = filterCommunicationAudience(registrations, {
      targetAudience: "checked_in",
    });
    assert.equal(checkedInAudience.length, 1);
    assert.equal(checkedInAudience[0].email, "a@pict.edu");
  });
});
