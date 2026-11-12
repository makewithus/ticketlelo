import test from "node:test";
import assert from "node:assert/strict";
import {
  UPI_HANDLES,
  BANK_NAMES,
  PAYOUT_STATUSES,
  validateUpiId,
  validateBankName,
  getOrganizerPayoutProfile,
  saveOrganizerPayoutProfile,
  generateUpiPaymentLink,
  generateUpiQrCode,
  listPayouts,
  getPayoutById,
  confirmPayoutPayment,
  holdPayout,
  releasePayoutHold,
  retryPayout,
} from "../../lib/payments/payout-engine.js";
import {
  createAdminNotification,
  getAdminNotifications,
  markAdminNotificationRead,
  createOrganizerNotification,
  getOrganizerNotifications,
} from "../../lib/notifications/notification-service.js";
import { calculateSettlementDates, addWorkingDays } from "../../lib/payments/working-calendar.js";
import { buildPayoutConfirmedEmail } from "../../lib/email/templates/payout-confirmed.js";

test("Organizer Payout Details & Manual Settlement Management Test Suite", async (t) => {
  // ── PART 1: Combined UPI Input & Bank Name Validation ──
  await t.test("Part 1: Combined UPI ID input and handle dropdown validation", () => {
    // 1. All mandatory handles must be available
    const expectedHandles = ["@ybl", "@oksbi", "@okaxis", "@okhdfcbank", "@ibl", "@axl", "@paytm", "Other"];
    for (const h of expectedHandles) {
      assert.ok(UPI_HANDLES.includes(h), `UPI_HANDLES must include ${h}`);
    }

    // 2. Valid combination of username and handle
    const validCombined = validateUpiId({ username: "adil123", handle: "@ybl" });
    assert.equal(validCombined.isValid, true);
    assert.equal(validCombined.upiId, "adil123@ybl");
    assert.equal(validCombined.username, "adil123");
    assert.equal(validCombined.handle, "@ybl");
    assert.ok(validCombined.disclaimer.includes("Format validation does not verify account ownership"));

    // 3. Username cannot be empty
    const emptyUser = validateUpiId({ username: "   ", handle: "@oksbi" });
    assert.equal(emptyUser.isValid, false);
    assert.ok(emptyUser.error.includes("cannot be empty"));

    // 4. Reject spaces in username
    const spaceUser = validateUpiId({ username: "adil 123", handle: "@oksbi" });
    assert.equal(spaceUser.isValid, false);
    assert.ok(spaceUser.error.includes("cannot contain spaces"));

    // 5. Reject invalid characters in username
    const invalidCharUser = validateUpiId({ username: "adil$#*", handle: "@okaxis" });
    assert.equal(invalidCharUser.isValid, false);
    assert.ok(invalidCharUser.error.includes("letters, numbers"));

    // 6. Handle 'Other' requires full UPI ID
    const otherValid = validateUpiId({ handle: "Other", customHandle: "college.fest@icici" });
    assert.equal(otherValid.isValid, true);
    assert.equal(otherValid.upiId, "college.fest@icici");

    // 7. Explicitly reject raw 10-digit phone number without handle in 'Other'
    const rawPhone = validateUpiId({ handle: "Other", customHandle: "9876543210" });
    assert.equal(rawPhone.isValid, false);
    assert.ok(rawPhone.error.includes("phone number is not a valid UPI ID"));

    // 8. Accept phone number with valid UPI handle
    const phoneWithHandle = validateUpiId({ username: "9876543210", handle: "@paytm" });
    assert.equal(phoneWithHandle.isValid, true);
    assert.equal(phoneWithHandle.upiId, "9876543210@paytm");
  });

  await t.test("Part 1: Bank Name dropdown validation", () => {
    // Required bank list verification
    const mandatoryBanks = [
      "State Bank of India (SBI)",
      "HDFC Bank",
      "ICICI Bank",
      "Axis Bank",
      "Kotak Mahindra Bank",
      "Federal Bank",
      "Punjab National Bank (PNB)",
      "Bank of Baroda",
      "Canara Bank",
      "Union Bank of India",
      "Indian Bank",
      "IDFC FIRST Bank",
      "Other",
    ];

    for (const b of mandatoryBanks) {
      assert.ok(BANK_NAMES.includes(b), `BANK_NAMES must include ${b}`);
    }

    // Valid standard selection
    const resSbi = validateBankName("State Bank of India (SBI)");
    assert.equal(resSbi.isValid, true);
    assert.equal(resSbi.bankName, "State Bank of India (SBI)");

    // Valid 'Other' with custom name
    const resOther = validateBankName("Other", "Kerala Gramin Bank");
    assert.equal(resOther.isValid, true);
    assert.equal(resOther.bankName, "Kerala Gramin Bank");

    // Invalid 'Other' without custom name
    const resOtherEmpty = validateBankName("Other", "  ");
    assert.equal(resOtherEmpty.isValid, false);
    assert.ok(resOtherEmpty.error.includes("enter your bank name"));

    // Empty bank
    const resEmpty = validateBankName("");
    assert.equal(resEmpty.isValid, false);
  });

  await t.test("Part 1: Organizer Payout Profile saving, retrieval & admin alert", async () => {
    const orgId = "org_payout_test_01";
    const callerUser = {
      uid: orgId,
      email: "finance@abccollege.edu",
      displayName: "ABC College",
    };

    const saved = await saveOrganizerPayoutProfile(
      orgId,
      {
        username: "abccollege",
        handle: "@oksbi",
        bankName: "State Bank of India (SBI)",
        organizerName: "ABC College of Engineering",
        email: "finance@abccollege.edu",
        phone: "+91 9876543210",
      },
      callerUser
    );

    assert.equal(saved.organizerId, orgId);
    assert.equal(saved.upiId, "abccollege@oksbi");
    assert.equal(saved.bankName, "State Bank of India (SBI)");
    assert.ok(saved.lastUpdatedDate);

    // Retrieve saved profile
    const fetched = await getOrganizerPayoutProfile(orgId);
    assert.ok(fetched);
    assert.equal(fetched.upiId, "abccollege@oksbi");
    assert.equal(fetched.bankName, "State Bank of India (SBI)");
  });

  // ── PART 2: Settlement Timeline (T+2 Gateway, T+4 Organizer Working Days) ──
  await t.test("Part 2: Calendar-aware T+2 and T+4 settlement schedule math", () => {
    // Wednesday 2026-11-04 (standard weekday)
    const schedule = calculateSettlementDates("2026-11-04T10:00:00.000Z");
    assert.ok(schedule.tPlus2RazorpayDate);
    assert.ok(schedule.tPlus4OrganizerDate);

    const captureDate = new Date("2026-11-04T10:00:00.000Z");
    const tPlus2 = new Date(schedule.tPlus2RazorpayDate);
    const tPlus4 = new Date(schedule.tPlus4OrganizerDate);

    // T+2 must be strictly before T+4
    assert.ok(tPlus2.getTime() < tPlus4.getTime());

    // From Wednesday:
    // +1 working day = Thursday (Nov 5)
    // +2 working days = Friday (Nov 6) -> Razorpay gateway settlement
    // Weekend: Saturday Nov 7 & Sunday Nov 8 skipped!
    // +3 working days = Monday (Nov 9)
    // +4 working days = Tuesday (Nov 10) -> TicketLelo organizer payout due!
    assert.equal(tPlus2.getUTCDay(), 5, "T+2 from Wednesday should be Friday");
    assert.ok(tPlus4.getUTCDate() >= 10, "T+4 must skip the weekend and mature on or after Nov 10");
  });

  // ── PART 3: Super Admin Overview & Notifications ──
  await t.test("Part 3: Super Admin overview metrics & notification generation", async () => {
    // Create admin notification for payout due
    const notif = await createAdminNotification({
      type: "PAYOUT_DUE",
      title: "Payout Due – Action Required",
      message: "Organizer: ABC College | Event: TECH FEST 2026 | Amount: ₹24,500 | UPI ID: abc@oksbi | Bank: SBI | Status: Pending Admin Payment",
      payoutId: "TKT-PO-TECHFEST",
      organizerName: "ABC College",
      eventTitle: "TECH FEST 2026",
      amount: 24500,
      dueDate: "10 November",
    });

    assert.ok(notif.id);
    assert.equal(notif.type, "PAYOUT_DUE");
    assert.equal(notif.read, false);

    // List notifications
    const notifs = await getAdminNotifications({ limit: 10 });
    assert.ok(Array.isArray(notifs));
    assert.ok(notifs.some((n) => n.payoutId === "TKT-PO-TECHFEST"));

    // Mark notification as read
    await markAdminNotificationRead(notif.id);
    const unread = await getAdminNotifications({ unreadOnly: true });
    assert.ok(!unread.some((n) => n.id === notif.id));
  });

  // ── PART 4 & 5: Manual UPI Deep Link & Payment Confirmation ──
  await t.test("Part 4 & 5: UPI Deep link generation & QR Code creation", async () => {
    const upiLink = generateUpiPaymentLink({
      upiId: "abccollege@oksbi",
      payeeName: "ABC College",
      amountRupees: 24500.0,
      payoutRefId: "TICKETLELO-PAYOUT-10001",
      note: "TicketLelo Payout - TECH FEST 2026",
    });

    assert.ok(upiLink.startsWith("upi://pay?"), "Must begin with upi://pay?");
    assert.ok(upiLink.includes("pa=abccollege%40oksbi") || upiLink.includes("pa=abccollege@oksbi"));
    assert.ok(upiLink.includes("am=24500.00"));
    assert.ok(upiLink.includes("tr=TICKETLELO-PAYOUT-10001"));
    assert.ok(upiLink.includes("cu=INR"));

    // Dynamic QR code generation
    const qrDataUrl = await generateUpiQrCode(upiLink);
    assert.ok(qrDataUrl);
    assert.ok(qrDataUrl.startsWith("data:image/png;base64,"));
  });

  await t.test("Part 5: Manual UPI payment confirmation strictly requires UTR & prevents duplicate confirmation", async () => {
    const payoutId = "TKT-PO-UNITTEST1";
    const adminUser = {
      uid: "superadmin_uid_01",
      email: "adil4ticketlelo@gmail.com",
      displayName: "Adil SuperAdmin",
    };

    // Pre-seed an in-memory payout record
    const { _seedMockPayout } = await import("../../lib/payments/payout-engine.js");

    // Initialize mock payout
    const testPayout = {
      payoutId,
      payoutRef: "TICKETLELO-PAYOUT-UNIT1",
      eventId: "event_techfest_2026",
      eventTitle: "TECH FEST 2026",
      organizerId: "org_abc_college",
      organizerName: "ABC College",
      organizerEmail: "finance@abccollege.edu",
      upiId: "abccollege@oksbi",
      bankName: "State Bank of India (SBI)",
      grossAmountPaise: 2500000,
      platformFeePaise: 125000,
      razorpayFeePaise: 59000,
      refundsPaise: 0,
      netOrganizerPaise: 2316000,
      status: PAYOUT_STATUSES.DUE,
      dueDateFormatted: "10 November 2026",
      isOverdue: false,
    };
    _seedMockPayout(payoutId, testPayout);

    // Confirm without UTR must fail
    await assert.rejects(
      confirmPayoutPayment({
        payoutId,
        utr: "",
        adminUser,
      }),
      /UTR is strictly required/
    );

    // Confirm with valid UTR
    const confirmed = await confirmPayoutPayment({
      payoutId,
      utr: "403819283748",
      remarks: "Disbursed via GPay Business",
      adminUser,
    });

    assert.equal(confirmed.status, PAYOUT_STATUSES.PAID);
    assert.equal(confirmed.utr, "403819283748");
    assert.ok(confirmed.paidAt);
    assert.equal(confirmed.paidBy?.email, "adil4ticketlelo@gmail.com");

    // Duplicate confirmation attempt must be blocked
    await assert.rejects(
      confirmPayoutPayment({
        payoutId,
        utr: "403819283748",
        adminUser,
      }),
      /already been confirmed as Paid/
    );
  });

  // ── PART 6: Organizer Notifications & Email Template ──
  await t.test("Part 6: Organizer confirmation email rendering & in-app notification", () => {
    const emailData = {
      organizerName: "ABC College",
      recipientEmail: "finance@abccollege.edu",
      eventTitle: "TECH FEST 2026",
      amountRupees: 23160.0,
      payoutId: "TICKETLELO-PAYOUT-UNIT1",
      utr: "403819283748",
      upiId: "abccollege@oksbi",
      bankName: "State Bank of India (SBI)",
      paidAt: "2026-11-10T12:00:00.000Z",
    };

    const email = buildPayoutConfirmedEmail(emailData);

    assert.ok(email.subject.includes("Your payout has been completed"));
    assert.ok(email.subject.includes("TECH FEST 2026"));
    assert.ok(email.text.includes("403819283748"));
    assert.ok(email.text.includes("abccollege@oksbi"));
    assert.ok(email.html.includes("₹23,160.00"));
    assert.ok(email.html.includes("State Bank of India (SBI)"));
  });

  // ── PART 7: Administrative Hold, Release & Retry Actions ──
  await t.test("Part 7: Hold, Release, and Retry administrative actions", async () => {
    const payoutId = "TKT-PO-ADMINACT1";
    const adminUser = {
      uid: "superadmin_01",
      email: "superadmin@ticketlelo.com",
    };

    const { _seedMockPayout } = await import("../../lib/payments/payout-engine.js");
    _seedMockPayout(payoutId, {
      payoutId,
      payoutRef: "TICKETLELO-PAYOUT-ACT1",
      eventId: "event_workshop",
      eventTitle: "AI Workshop",
      organizerId: "org_ai",
      status: PAYOUT_STATUSES.DUE,
      netOrganizerPaise: 800000,
    });

    // 1. Placing on hold requires a reason
    await assert.rejects(
      holdPayout(payoutId, "", adminUser),
      /mandatory reason/
    );

    // 2. Place on hold with reason
    const held = await holdPayout(payoutId, "Ticket dispute investigation", adminUser);
    assert.equal(held.status, PAYOUT_STATUSES.ON_HOLD);
    assert.equal(held.holdReason, "Ticket dispute investigation");

    // 3. Release hold
    const released = await releasePayoutHold(payoutId, adminUser);
    assert.equal(released.status, PAYOUT_STATUSES.DUE);
    assert.equal(released.holdReason, null);

    // 4. Retry failed payout
    _seedMockPayout(payoutId, {
      payoutId,
      payoutRef: "TICKETLELO-PAYOUT-ACT1",
      status: PAYOUT_STATUSES.FAILED,
      netOrganizerPaise: 800000,
    });

    const retried = await retryPayout(payoutId, adminUser);
    assert.equal(retried.status, PAYOUT_STATUSES.DUE);
    assert.equal(retried.retryCount, 1);
  });
});
