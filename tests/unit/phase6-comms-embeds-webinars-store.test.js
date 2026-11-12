import test from "node:test";
import assert from "node:assert/strict";
import { getWebinarAccessWindow, verifyWebinarAccess } from "../../lib/webinars.js";
import { calculateMerchandiseAddons, generatePickupVoucher } from "../../lib/merchandise.js";

test("Phase 6: Segmented Communication Audience Filtering", async (t) => {
  const registrations = [
    {
      email: "rahul@pict.edu",
      fullName: "Rahul Sharma",
      status: "Used",
      entitledSubEventIds: ["track_workshop", "track_hackathon"],
      checkIns: { track_workshop: { time: new Date() } },
    },
    {
      email: "sneha@coep.ac.in",
      fullName: "Sneha Patel",
      status: "Unused",
      entitledSubEventIds: ["track_hackathon"],
      checkIns: {},
    },
    {
      email: "amit@vit.edu",
      fullName: "Amit Kumar",
      status: "Unused",
      entitledSubEventIds: ["track_proshow"],
      checkIns: {},
    },
  ];

  await t.test("Filters recipients by sub-event entitlement", () => {
    const workshopAudience = registrations.filter(
      (r) => Array.isArray(r.entitledSubEventIds) && r.entitledSubEventIds.includes("track_workshop")
    );
    assert.equal(workshopAudience.length, 1);
    assert.equal(workshopAudience[0].email, "rahul@pict.edu");

    const hackathonAudience = registrations.filter(
      (r) => Array.isArray(r.entitledSubEventIds) && r.entitledSubEventIds.includes("track_hackathon")
    );
    assert.equal(hackathonAudience.length, 2);
  });

  await t.test("Filters recipients by checked-in status", () => {
    const checkedIn = registrations.filter(
      (r) => r.status?.toLowerCase() === "used" || Object.keys(r.checkIns || {}).length > 0
    );
    assert.equal(checkedIn.length, 1);
    assert.equal(checkedIn[0].email, "rahul@pict.edu");

    const notCheckedIn = registrations.filter(
      (r) => r.status?.toLowerCase() !== "used" && Object.keys(r.checkIns || {}).length === 0
    );
    assert.equal(notCheckedIn.length, 2);
  });
});

test("Phase 6: Hybrid Webinars 15-Minute Release Gatekeeper", async (t) => {
  const now = new Date("2027-03-15T10:00:00Z");

  await t.test("Calculates locked window when session starts in 45 minutes", () => {
    const startTime = new Date("2027-03-15T10:45:00Z");
    const windowStatus = getWebinarAccessWindow(startTime, now);

    assert.equal(windowStatus.isOpen, false);
    assert.equal(windowStatus.minutesUntilOpen, 30); // 45 - 15 = 30 mins until unlock
  });

  await t.test("Unlocks window when session starts in 10 minutes", () => {
    const startTime = new Date("2027-03-15T10:10:00Z");
    const windowStatus = getWebinarAccessWindow(startTime, now);

    assert.equal(windowStatus.isOpen, true);
    assert.equal(windowStatus.minutesUntilOpen, 0);
  });

  await t.test("Enforces ticket entitlement check before returning credentials", () => {
    const startTime = new Date("2027-03-15T10:10:00Z"); // Within window
    const subEvent = {
      id: "track_ai_webinar",
      title: "Generative AI Masterclass",
      isOnline: true,
      startTime,
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      meetingPasscode: "AI2027",
    };

    const entitledTicket = {
      id: "TKT-001",
      status: "Valid",
      entitledSubEventIds: ["track_ai_webinar"],
    };

    const unentitledTicket = {
      id: "TKT-002",
      status: "Valid",
      entitledSubEventIds: ["track_proshow"],
    };

    const authorizedResult = verifyWebinarAccess({
      ticket: entitledTicket,
      subEvent,
      currentTime: now,
    });
    assert.equal(authorizedResult.authorized, true);
    assert.equal(authorizedResult.meetingUrl, "https://meet.google.com/abc-defg-hij");
    assert.equal(authorizedResult.meetingPasscode, "AI2027");

    const deniedResult = verifyWebinarAccess({
      ticket: unentitledTicket,
      subEvent,
      currentTime: now,
    });
    assert.equal(deniedResult.authorized, false);
    assert.match(deniedResult.reason, /does not include access/i);
  });
});

test("Phase 6: Lightweight Creator Store & Merchandise Engine", async (t) => {
  const catalog = [
    { id: "merch_hoodie", name: "PRAROHA Official Dev Hoodie", price: 799, stock: 50 },
    { id: "merch_badge_pack", name: "Hacker Badge Pack", price: 149, stock: 2 },
  ];

  await t.test("Calculates total price of merchandise add-ons accurately", () => {
    const selected = [
      { itemId: "merch_hoodie", quantity: 1, size: "L" },
      { itemId: "merch_badge_pack", quantity: 2 },
    ];

    const result = calculateMerchandiseAddons(catalog, selected);
    assert.equal(result.valid, true);
    assert.equal(result.items.length, 2);
    // 799 + (149 * 2) = 799 + 298 = 1097
    assert.equal(result.totalAmount, 1097);
  });

  await t.test("Rejects purchase when requested quantity exceeds available stock", () => {
    const selected = [{ itemId: "merch_badge_pack", quantity: 5 }]; // stock is only 2
    const result = calculateMerchandiseAddons(catalog, selected);

    assert.equal(result.valid, false);
    assert.match(result.error, /Insufficient stock/i);
  });

  await t.test("Generates immutable pickup voucher with order linkage", () => {
    const voucher = generatePickupVoucher({
      orderId: "order_test_987654",
      buyerName: "Rahul Sharma",
      items: [{ name: "Dev Hoodie", quantity: 1, size: "L" }],
    });

    assert.ok(voucher.voucherCode.startsWith("VOUCHER-"));
    assert.equal(voucher.orderId, "order_test_987654");
    assert.equal(voucher.buyerName, "Rahul Sharma");
    assert.equal(voucher.status, "Ready for Pickup");
  });
});
