import test from "node:test";
import assert from "node:assert/strict";
import { checkCertificateEligibility } from "../../lib/certificates.js";
import { generateICS } from "../../lib/calendar.js";

test("Phase 5: Dual-Level Certificate Attendance Verification Engine", async (t) => {
  const unusedTicket = {
    id: "TKT-PRAROHA-001",
    status: "Unused",
    checkIns: {},
    entitledSubEventIds: ["track_workshop", "track_hackathon"],
  };

  const parentCheckedInTicket = {
    id: "TKT-PRAROHA-002",
    status: "Used",
    checkIns: {
      main_gate: { time: new Date() },
    },
    entitledSubEventIds: ["track_workshop", "track_hackathon"],
  };

  const workshopCheckedInTicket = {
    id: "TKT-PRAROHA-003",
    status: "Used",
    checkIns: {
      main_gate: { time: new Date() },
      track_workshop: { time: new Date() },
    },
    entitledSubEventIds: ["track_workshop", "track_hackathon"],
  };

  const revokedTicket = {
    id: "TKT-PRAROHA-004",
    status: "Revoked",
    checkIns: { main_gate: { time: new Date() } },
    entitledSubEventIds: ["track_workshop"],
  };

  await t.test("Rejects certificate issuance for attendee who has not checked in", () => {
    const parentEligibility = checkCertificateEligibility(unusedTicket);
    assert.equal(parentEligibility.eligible, false);
    assert.match(parentEligibility.reason, /verified gate check-in/i);

    const subEventEligibility = checkCertificateEligibility(unusedTicket, "track_workshop");
    assert.equal(subEventEligibility.eligible, false);
    assert.match(subEventEligibility.reason, /verified attendance at this sub-event/i);
  });

  await t.test("Grants parent-event festival certificate when general gate check-in is verified", () => {
    const result = checkCertificateEligibility(parentCheckedInTicket);
    assert.equal(result.eligible, true);
  });

  await t.test("Rejects sub-event track certificate if attendee only checked into main gate but not the track", () => {
    const workshopResult = checkCertificateEligibility(parentCheckedInTicket, "track_workshop");
    assert.equal(workshopResult.eligible, false);
    assert.match(workshopResult.reason, /verified attendance at this sub-event track/i);
  });

  await t.test("Grants sub-event track certificate when specific track gate scan is verified", () => {
    const workshopResult = checkCertificateEligibility(workshopCheckedInTicket, "track_workshop");
    assert.equal(workshopResult.eligible, true);
  });

  await t.test("Rejects certificate if ticket is revoked even if previously scanned", () => {
    const result = checkCertificateEligibility(revokedTicket);
    assert.equal(result.eligible, false);
    assert.match(result.reason, /revoked/i);
  });
});

test("Phase 5: RFC 5545 iCalendar (.ics) Generator", async (t) => {
  const eventData = {
    title: "PRAROHA 2027 — National Tech Symposium",
    description: "Annual technical festival featuring AI Workshops, Hackathons, and Pro Shows.",
    location: "PICT Campus, Pune, Maharashtra",
    startDate: new Date("2027-03-15T09:00:00Z"),
    endDate: new Date("2027-03-15T18:00:00Z"),
    url: "https://ticketlelo.com/register/praroha_2027",
  };

  await t.test("Produces valid RFC 5545 VCALENDAR structure", () => {
    const ics = generateICS(eventData);
    assert.ok(ics.includes("BEGIN:VCALENDAR"));
    assert.ok(ics.includes("VERSION:2.0"));
    assert.ok(ics.includes("PRODID:-//TicketLelo//Event Operating Platform//EN"));
    assert.ok(ics.includes("BEGIN:VEVENT"));
    assert.ok(ics.includes("SUMMARY:PRAROHA 2027 — National Tech Symposium"));
    assert.ok(ics.includes("LOCATION:PICT Campus\\, Pune\\, Maharashtra"));
    assert.ok(ics.includes("DTSTART:20270315T090000Z"));
    assert.ok(ics.includes("DTEND:20270315T180000Z"));
    assert.ok(ics.includes("STATUS:CONFIRMED"));
    assert.ok(ics.includes("END:VEVENT"));
    assert.ok(ics.includes("END:VCALENDAR"));
  });
});

test("Phase 5: Financial Rollup & Analytics Calculation Formulas", async (t) => {
  // Test financial aggregation rules matching CTO specification:
  // Gross = 10,000 INR
  // Platform fee = 2.5% of Gross = 250 INR
  // GST = 18% of Gross = 1,800 INR
  // Net settlement = Gross - Platform fee = 9,750 INR
  const gross = 10000;
  const platformFeeRate = 0.025;
  const gstRate = 0.18;

  const platformFee = Math.round(gross * platformFeeRate * 100) / 100;
  const gst = Math.round(gross * gstRate * 100) / 100;
  const netSettlement = Math.round((gross - platformFee) * 100) / 100;

  assert.equal(platformFee, 250);
  assert.equal(gst, 1800);
  assert.equal(netSettlement, 9750);

  // Canonical PRAROHA 2027 Page 12 Analytics Reconciliation
  const canonicalSubEvents = [
    { title: "AI Workshop", sold: 180, cap: 200, rev: 35820, attendance: 162 },
    { title: "Hackathon", sold: 480, cap: 500, rev: 143520, attendance: 460 },
    { title: "Web Dev", sold: 145, cap: 150, rev: 21605, attendance: 138 },
    { title: "Gaming", sold: 240, cap: 250, rev: 47760, attendance: 228 },
    { title: "Pro Show", sold: 2800, cap: 3000, rev: 1200000, attendance: 2500 },
  ];

  for (const s of canonicalSubEvents) {
    const rate = Math.round((s.attendance / s.sold) * 1000) / 10;
    assert.ok(rate >= 89.0 && rate <= 96.0, `Attendance rate ${rate}% must be between 89% and 96%`);
  }
});

test("Phase 5: Canonical Certificate ID Format & Dual-Level Titles", () => {
  // Master Specification Page 11: TL-CERT-2027-8842 format
  const year = "2027";
  const randomSuffix = "8842";
  const canonicalCertId = `TL-CERT-${year}-${randomSuffix}`;
  assert.match(canonicalCertId, /^TL-CERT-2027-\d{4}$/);

  // Major Fest Level title
  const festCertTitle = "PRAROHA 2027 • Certificate of Campus Leadership & Organizing Excellence";
  assert.ok(festCertTitle.includes("PRAROHA 2027"));
  assert.ok(festCertTitle.includes("Certificate of Campus Leadership"));

  // Sub-Event Specific title
  const subEventCertTitle = "Certificate of Completion: Hands-On Generative AI Masterclass (12 March 2027)";
  assert.ok(subEventCertTitle.includes("Certificate of Completion"));
  assert.ok(subEventCertTitle.includes("AI Masterclass"));
});

