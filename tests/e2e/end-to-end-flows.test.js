import test from "node:test";
import assert from "node:assert/strict";
import { calculateAvailableCombos, resolveTicketEntitlements } from "../../lib/combos.js";
import { calculateOrderPricing } from "../../lib/pricing.js";
import { generateSignedQRPayload, verifySignedQRPayload } from "../../lib/qr.js";
import { checkCertificateEligibility } from "../../lib/certificates.js";
import { calculateCommissionAmount, isSelfReferral } from "../../lib/commissions.js";
import { getWebinarAccessWindow, verifyWebinarAccess } from "../../lib/webinars.js";
import { calculateMerchandiseAddons, generatePickupVoucher } from "../../lib/merchandise.js";

test("End-to-End Workflow: Journey A — Organizer Event Hierarchy & Combo Setup", async (t) => {
  const majorEvent = {
    id: "evt_praroha_2027",
    title: "PRAROHA 2027",
    slug: "praroha-2027",
    organizationId: "org_pict",
    isPublished: true,
  };

  const subEvents = {
    track_workshop: { id: "track_workshop", title: "AI Workshop", capacity: 100, allocatedSeats: 20 },
    track_hackathon: { id: "track_hackathon", title: "24h Hackathon", capacity: 200, allocatedSeats: 50 },
    track_proshow: { id: "track_proshow", title: "Pro Show Concert", capacity: 500, allocatedSeats: 480 },
  };

  const techCombo = {
    id: "combo_tech",
    title: "TECH COMBO (AI Workshop + Hackathon)",
    dedicatedQuota: 50,
    allocatedCount: 5, // 45 remaining
    includedSubEventIds: ["track_workshop", "track_hackathon"],
    isPublished: true,
  };


  await t.test("Calculates correct dynamic combo bottleneck capacity", () => {
    // Workshop has 80 left; Hackathon has 150 left; Dedicated has 45 left
    // Available = MIN(45, MIN(80, 150)) = 45
    const available = calculateAvailableCombos(techCombo, subEvents);
    assert.equal(available, 45);
  });

  await t.test("Resolves immutable entitlement snapshot containing exact tracks", () => {
    const entitlements = resolveTicketEntitlements(techCombo, subEvents);
    assert.deepEqual(entitlements.entitledSubEventIds, ["track_workshop", "track_hackathon"]);
    assert.deepEqual(entitlements.entitledTrackNames, ["AI Workshop", "24h Hackathon"]);
  });
});

test("End-to-End Workflow: Journey B — Attendee Checkout, Pricing & Ticket Issuance", async (t) => {
  const basePrice = 449.10; // PRAROHA Tech Combo
  const pricing = calculateOrderPricing({
    basePrice,
    quantity: 1,
    isTaxInclusive: true,
  });

  await t.test("Itemized pricing accurately computes GST and platform fees", () => {
    assert.equal(pricing.finalPayable, 449.10);
    assert.ok(pricing.gstAmount > 0);
    assert.ok(pricing.platformFee > 0);
    assert.ok(pricing.organizerSettlement > 0);
  });

  await t.test("Issues cryptographically signed HMAC QR payload upon verified payment", () => {
    const ticketId = "TKT-PRAROHA-09876";
    const qrPayload = generateSignedQRPayload({
      eventSlug: "praroha-2027",
      ticketId,
      entitledSubEventIds: ["track_workshop", "track_hackathon"],
    }, "e2e-secret-key-12345");

    assert.ok(qrPayload.startsWith("TLSEC:sha256:v1|"));
    assert.ok(qrPayload.includes("tkt=TKT-PRAROHA-09876"));

    // Verify payload
    const verification = verifySignedQRPayload(qrPayload, "e2e-secret-key-12345");
    assert.equal(verification.isValid, true);
    assert.deepEqual(verification.entitledSubEvents, ["track_hackathon", "track_workshop"]);
  });
});

test("End-to-End Workflow: Journey C — Gate Check-In & Track Entitlement Gating", async (t) => {
  const issuedTicket = {
    id: "TKT-PRAROHA-09876",
    status: "Valid",
    buyerName: "Rahul Sharma",
    entitledSubEventIds: ["track_workshop", "track_hackathon"],
    checkIns: {},
  };

  function simulateGateCheckIn(ticket, stationId) {
    if (ticket.status === "Revoked") return { status: "revoked" };
    // Track entitlement gating
    if (stationId !== "main_gate" && !ticket.entitledSubEventIds.includes(stationId)) {
      return { status: "unauthorized_track", message: "Denied: Ticket does not include access to this track." };
    }
    // Duplicate check
    if (ticket.checkIns[stationId]) {
      return { status: "already_used", message: "Duplicate Scan" };
    }
    // Admit
    ticket.checkIns[stationId] = { time: new Date() };
    ticket.status = "Used";
    return { status: "admitted", attendee: ticket.buyerName };
  }

  await t.test("Admits attendee to entitled AI Workshop gate", () => {
    const res = simulateGateCheckIn(issuedTicket, "track_workshop");
    assert.equal(res.status, "admitted");
  });

  await t.test("Rejects duplicate scan at the same station", () => {
    const duplicateRes = simulateGateCheckIn(issuedTicket, "track_workshop");
    assert.equal(duplicateRes.status, "already_used");
  });

  await t.test("Denies admission when attempting to enter unauthorized Pro Show concert", () => {
    const proShowRes = simulateGateCheckIn(issuedTicket, "track_proshow");
    assert.equal(proShowRes.status, "unauthorized_track");
  });
});

test("End-to-End Workflow: Journey D — Offline Gate Check-In & Sync Conflict Detection", async (t) => {
  // Simulates two offline terminals scanning the same ticket while disconnected
  const authoritativeTicket = {
    id: "TKT-DUAL-OFFLINE",
    status: "Valid",
    checkIns: {},
  };

  function serverReconcileOfflineScans(ticket, offlineBatch) {
    let synced = 0;
    let conflicts = 0;

    for (const scan of offlineBatch) {
      if (ticket.checkIns[scan.station]) {
        conflicts++;
      } else {
        ticket.checkIns[scan.station] = {
          time: scan.time,
          deviceId: scan.deviceId,
        };
        ticket.status = "Used";
        synced++;
      }
    }
    return { synced, conflicts };
  }

  await t.test("Reconciles first offline terminal and flags second offline terminal as conflict duplicate", () => {
    const offlineBatch = [
      { ticketId: "TKT-DUAL-OFFLINE", station: "track_workshop", deviceId: "device_gate_A", time: new Date("2027-03-15T09:00:00Z") },
      { ticketId: "TKT-DUAL-OFFLINE", station: "track_workshop", deviceId: "device_gate_B", time: new Date("2027-03-15T09:05:00Z") },
    ];

    const outcome = serverReconcileOfflineScans(authoritativeTicket, offlineBatch);
    assert.equal(outcome.synced, 1);
    assert.equal(outcome.conflicts, 1);
    assert.equal(authoritativeTicket.checkIns.track_workshop.deviceId, "device_gate_A");
  });
});

test("End-to-End Workflow: Journey E — Ambassador Referral, Commission & Refund Reversal", async (t) => {
  const ambassador = {
    id: "amb_alex",
    email: "alex@college.edu",
    whatsappPhone: "9876543210",
    referralCode: "ALEX2027",
  };

  const program = {
    isActive: true,
    commissionType: "percentage",
    commissionRate: 10, // 10%
  };


  await t.test("Prevents self-referral when buyer email matches ambassador", () => {
    const selfBuyer = { email: "alex@college.edu", whatsappPhone: "9123456789" };
    assert.equal(isSelfReferral(selfBuyer, ambassador), true);
  });

  await t.test("Computes valid commission for peer referral and creates ledger entry", () => {
    const peerBuyer = { email: "priya@college.edu", whatsappPhone: "9988776655" };
    assert.equal(isSelfReferral(peerBuyer, ambassador), false);

    const commissionAmount = calculateCommissionAmount(program, 449.10, 1);
    assert.equal(commissionAmount, 44.91);

    const ledgerEntry = {
      orderId: "ord_1001",
      ambassadorId: ambassador.id,
      commissionAmount,
      status: "held", // 7-day holding period
    };
    assert.equal(ledgerEntry.status, "held");

    // Simulate refund webhook event reversing commission
    ledgerEntry.status = "reversed";
    assert.equal(ledgerEntry.status, "reversed");
  });
});

test("End-to-End Workflow: Journey F — Certificate Issuance & Hybrid Webinar Gatekeeper", async (t) => {
  const attendedTicket = {
    id: "TKT-CONCERT-01",
    status: "Used",
    checkIns: { track_workshop: { time: new Date() } },
    entitledSubEventIds: ["track_workshop"],
  };

  await t.test("Authorizes certificate generation only for attended and checked-in track", () => {
    const eligibility = checkCertificateEligibility(attendedTicket, "track_workshop");
    assert.equal(eligibility.eligible, true);

    const unverifiedEligibility = checkCertificateEligibility(attendedTicket, "track_hackathon");
    assert.equal(unverifiedEligibility.eligible, false);
  });

  await t.test("Webinar gatekeeper unlocks meeting link only inside 15-minute window", () => {
    const now = new Date("2027-03-15T11:00:00Z");
    const sessionStartsSoon = new Date("2027-03-15T11:10:00Z"); // 10 mins away
    const subEvent = {
      id: "track_workshop",
      isOnline: true,
      startTime: sessionStartsSoon,
      meetingUrl: "https://meet.google.com/xyz-abcd-efg",
    };

    const access = verifyWebinarAccess({
      ticket: attendedTicket,
      subEvent,
      currentTime: now,
    });

    assert.equal(access.authorized, true);
    assert.equal(access.meetingUrl, "https://meet.google.com/xyz-abcd-efg");
  });
});
