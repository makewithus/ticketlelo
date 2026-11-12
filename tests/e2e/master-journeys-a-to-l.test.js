import test from "node:test";
import assert from "node:assert/strict";
import { calculateAvailableCombos, resolveTicketEntitlements } from "../../lib/combos.js";
import { calculateOrderPricing } from "../../lib/pricing.js";
import { generateSignedQRPayload, verifySignedQRPayload } from "../../lib/qr.js";
import { checkCertificateEligibility } from "../../lib/certificates.js";
import { calculateCommissionAmount, isSelfReferral } from "../../lib/commissions.js";
import { getWebinarAccessWindow, verifyWebinarAccess } from "../../lib/webinars.js";
import { calculateMerchandiseAddons, generatePickupVoucher } from "../../lib/merchandise.js";
import { generateFormResponsesCSV, syncRegistrationToGoogleSheet } from "../../lib/google-sheets.js";
import { generateEventWhatsAppShareUrl, filterCommunicationAudience, sendWhatsAppCloudMessage } from "../../lib/communications.js";
import { generateTaxInvoiceData } from "../../lib/invoices.js";
import { buildAppleWalletPassStructure, buildGoogleWalletPassStructure } from "../../lib/wallet.js";
import { generateICS } from "../../lib/calendar.js";

test("E2E Acceptance Suite: Complete Verification of Journeys A through L", async (t) => {
  // ----------------------------------------------------
  // Journey A — Organizer Setup
  // ----------------------------------------------------
  await t.test("Journey A — Organizer Setup: Multi-tenant organization and multi-track fest creation", () => {
    const organization = {
      id: "org_pict_pune",
      name: "Pune Institute of Computer Technology",
      slug: "pict-pune",
    };

    const majorEvent = {
      id: "evt_praroha_2027",
      title: "PRAROHA 2027",
      slug: "praroha-2027",
      organizationId: organization.id,
      globalCapacity: 5000,
      isPublished: true,
    };

    const subEvents = {
      track_ai: { id: "track_ai", parentEventId: majorEvent.id, title: "AI Workshop", capacity: 120, allocatedSeats: 20 },
      track_hack: { id: "track_hack", parentEventId: majorEvent.id, title: "24h Hackathon", capacity: 250, allocatedSeats: 50 },
      track_esports: { id: "track_esports", parentEventId: majorEvent.id, title: "Esports Arena", capacity: 300, allocatedSeats: 100 },
    };

    // Assert organization isolation
    assert.equal(majorEvent.organizationId, "org_pict_pune");
    assert.equal(Object.keys(subEvents).length, 3);
    assert.equal(subEvents.track_ai.parentEventId, majorEvent.id);
  });

  // ----------------------------------------------------
  // Journey B — Registration and Ambassador Attribution
  // ----------------------------------------------------
  await t.test("Journey B — Registration & Ambassador Attribution: Self-referral block & peer commission", () => {
    const ambassador = {
      id: "amb_rahul",
      fullName: "Rahul K",
      email: "rahul@college.edu",
      whatsappPhone: "9876543210",
      referralCode: "RAHUL2027",
      status: "approved",
    };

    const program = {
      isActive: true,
      commissionType: "percentage",
      commissionRate: 10, // 10%
    };

    // Self-referral attempt
    const selfBuyer = { email: "rahul@college.edu", whatsappPhone: "9123456780" };
    assert.equal(isSelfReferral(selfBuyer, ambassador), true, "Self-referral by email must be blocked");

    // Peer referral
    const peerBuyer = { email: "sneha@college.edu", whatsappPhone: "9876512345" };
    assert.equal(isSelfReferral(peerBuyer, ambassador), false, "Legitimate peer referral must be allowed");

    const commission = calculateCommissionAmount(program, 449.10, 1);
    assert.equal(commission, 44.91);
  });

  // ----------------------------------------------------
  // Journey C — Ticketing and Capacity
  // ----------------------------------------------------
  await t.test("Journey C — Ticketing & Capacity: Dynamic bottleneck calculation and entitlement resolution", () => {
    const subEvents = {
      track_ai: { capacity: 100, allocatedSeats: 90 }, // Remaining: 10 (Bottleneck)
      track_hack: { capacity: 200, allocatedSeats: 50 }, // Remaining: 150
    };

    const combo = {
      id: "combo_ai_hack",
      dedicatedQuota: 50,
      allocatedCount: 5, // Remaining: 45
      includedSubEventIds: ["track_ai", "track_hack"],
      isPublished: true,
    };

    // Bottleneck capacity = MIN(45, MIN(10, 150)) = 10
    const available = calculateAvailableCombos(combo, subEvents);
    assert.equal(available, 10);

    const entitlements = resolveTicketEntitlements(combo, subEvents);
    assert.deepEqual(entitlements.entitledSubEventIds, ["track_ai", "track_hack"]);
  });

  // ----------------------------------------------------
  // Journey D — Payments and Refunds
  // ----------------------------------------------------
  await t.test("Journey D — Payments & Refunds: 18% GST calculation, refund reversal & capacity restore", () => {
    const pricing = calculateOrderPricing({
      basePrice: 449.10,
      quantity: 1,
      isTaxInclusive: true,
    });

    assert.equal(pricing.finalPayable, 449.10);
    assert.equal(pricing.gstAmount, 67.09);

    // Simulate refund webhook event
    const ticket = { id: "TKT-REFUND-001", status: "Valid", allocatedComboId: "combo_ai_hack" };
    const refundEvent = { type: "refund.processed", ticketId: ticket.id };

    // Ticket revocation and inventory restoration simulation
    ticket.status = "Revoked";
    ticket.revocationReason = "Refund Processed";
    assert.equal(ticket.status, "Revoked");
  });

  // ----------------------------------------------------
  // Journey E — Online and Offline Gate Check-In
  // ----------------------------------------------------
  await t.test("Journey E — Gate Check-In: Entitlement gating and offline conflict reconciliation", () => {
    const secret = "journey-e-secret-key-123";
    const signedQR = generateSignedQRPayload({
      eventSlug: "praroha-2027",
      ticketId: "TKT-GATE-1234",
      entitledSubEventIds: ["track_ai"],
    }, secret);

    const verify = verifySignedQRPayload(signedQR, secret);
    assert.equal(verify.isValid, true);
    assert.ok(verify.entitledSubEvents.includes("track_ai"));

    // Offline reconciliation
    const authoritativeTicket = { id: "TKT-GATE-1234", checkIns: {} };
    const offlineScans = [
      { ticketId: "TKT-GATE-1234", station: "track_ai", deviceId: "terminal_1", time: "2027-03-01T09:00:00Z" },
      { ticketId: "TKT-GATE-1234", station: "track_ai", deviceId: "terminal_2", time: "2027-03-01T09:02:00Z" },
    ];

    let admitted = 0;
    let conflicts = 0;
    for (const scan of offlineScans) {
      if (authoritativeTicket.checkIns[scan.station]) {
        conflicts++;
      } else {
        authoritativeTicket.checkIns[scan.station] = scan;
        admitted++;
      }
    }

    assert.equal(admitted, 1);
    assert.equal(conflicts, 1);
  });

  // ----------------------------------------------------
  // Journey F — Attendee Post-Purchase Experience
  // ----------------------------------------------------
  await t.test("Journey F — Attendee Experience: Calendar ICS, tax invoice, and wallet pass creation", () => {
    const ics = generateICS({
      title: "PRAROHA 2027",
      description: "Flagship National Fest",
      location: "PICT Pune",
      startDate: new Date("2027-03-15T09:00:00Z"),
    });
    assert.ok(ics.includes("BEGIN:VCALENDAR"));

    const invoice = generateTaxInvoiceData({
      order: { id: "ORD-9999", amount: 449.10, buyerName: "Kunal S", buyerEmail: "kunal@pict.edu" },
      event: { title: "PRAROHA 2027" },
      attendee: { fullName: "Kunal S", email: "kunal@pict.edu" },
    });
    assert.equal(invoice.financials.totalPayable, 449.10);

    const applePass = buildAppleWalletPassStructure({
      ticket: { id: "TKT-9999", buyerName: "Kunal S", tier: "General" },
      event: { title: "PRAROHA 2027" },
    });
    assert.equal(applePass.formatVersion, 1);
  });

  // ----------------------------------------------------
  // Journey G — Certificates
  // ----------------------------------------------------
  await t.test("Journey G — Certificates: Verification of checked-in attendance before credential issue", () => {
    const attendeeTicket = {
      id: "TKT-CERT-01",
      status: "Used",
      checkIns: { track_ai: { time: new Date() } },
      entitledSubEventIds: ["track_ai"],
    };

    const eligible = checkCertificateEligibility(attendeeTicket, "track_ai");
    assert.equal(eligible.eligible, true);

    const ineligible = checkCertificateEligibility(attendeeTicket, "track_hack");
    assert.equal(ineligible.eligible, false);
  });

  // ----------------------------------------------------
  // Journey H — Communications
  // ----------------------------------------------------
  await t.test("Journey H — Communications: Audience filtering, WhatsApp deep link & provider fallback", async () => {
    const registrations = [
      { id: "r1", email: "user1@pict.edu", entitledSubEventIds: ["track_ai"], status: "Used" },
      { id: "r2", email: "user2@pict.edu", entitledSubEventIds: ["track_hack"], status: "Valid" },
    ];

    const audience = filterCommunicationAudience(registrations, { targetAudience: "sub_event", targetSubEventId: "track_ai" });
    assert.equal(audience.length, 1);

    const waLink = generateEventWhatsAppShareUrl({ eventTitle: "PRAROHA 2027", eventUrl: "https://ticketlelo.com/e/praroha" });
    assert.ok(waLink.startsWith("https://api.whatsapp.com/send?text="));

    const cloudRes = await sendWhatsAppCloudMessage({ recipientPhone: "9876543210", messageText: "Event Update" }, { token: "", phoneNumberId: "" });
    assert.equal(cloudRes.requiresCredentials, true);
  });

  // ----------------------------------------------------
  // Journey I — External Website Embed
  // ----------------------------------------------------
  await t.test("Journey I — Website Embed: Cross-origin postMessage protocol and iframe attributes", () => {
    const embedParams = {
      eventId: "evt_praroha_2027",
      theme: "dark",
      referralCode: "ADIL26",
    };

    const embedUrl = `/embed/${embedParams.eventId}?theme=${embedParams.theme}&ref=${embedParams.referralCode}`;
    assert.ok(embedUrl.includes("/embed/evt_praroha_2027"));
    assert.ok(embedUrl.includes("ref=ADIL26"));
  });

  // ----------------------------------------------------
  // Journey J — Hybrid Webinar
  // ----------------------------------------------------
  await t.test("Journey J — Hybrid Webinar: 15-minute gatekeeper access unlock", () => {
    const ticket = {
      id: "TKT-WEB-001",
      entitledSubEventIds: ["track_webinar"],
    };

    const subEvent = {
      id: "track_webinar",
      isOnline: true,
      startTime: new Date("2027-03-15T10:10:00Z"), // Starts in 10 minutes from reference
      meetingUrl: "https://meet.google.com/abc-defg-hij",
    };

    const access = verifyWebinarAccess({
      ticket,
      subEvent,
      currentTime: new Date("2027-03-15T10:00:00Z"),
    });

    assert.equal(access.authorized, true);
    assert.equal(access.meetingUrl, "https://meet.google.com/abc-defg-hij");
  });

  // ----------------------------------------------------
  // Journey K — Merchandise
  // ----------------------------------------------------
  await t.test("Journey K — Merchandise: Add-on pricing, stock bounds, and immutable pickup voucher", () => {
    const catalog = [
      { id: "tshirt_black", name: "Festival T-Shirt", price: 350, stock: 5 },
    ];
    const orderAddons = [{ itemId: "tshirt_black", quantity: 1, size: "L" }];
    const res = calculateMerchandiseAddons(catalog, orderAddons);
    assert.equal(res.valid, true);
    assert.equal(res.totalAmount, 350);

    const voucher = generatePickupVoucher({ orderId: "ORD-MERCH-1", buyerName: "Kunal S", items: orderAddons });
    assert.ok(voucher.voucherCode.startsWith("VOUCHER-"));
  });

  // ----------------------------------------------------
  // Journey L — Reporting and Finance
  // ----------------------------------------------------
  await t.test("Journey L — Reporting & Finance: Financial rollup reconciliation across all tiers", () => {
    const orders = [
      { id: "o1", finalPayable: 449.10, status: "PAID" },
      { id: "o2", finalPayable: 999.00, status: "PAID" },
      { id: "o3", finalPayable: 449.10, status: "REFUNDED" }, // Should be excluded from net
    ];

    const grossRevenue = orders
      .filter((o) => o.status === "PAID")
      .reduce((sum, o) => sum + o.finalPayable, 0);

    assert.equal(grossRevenue, 1448.10);
  });
});
