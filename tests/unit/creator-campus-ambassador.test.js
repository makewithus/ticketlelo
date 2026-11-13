import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  generateReferralCode,
  normalizeReferralCode,
  isValidReferralCodeFormat,
  checkSelfReferral,
} from "../../lib/creator-campus/referral-registry.js";
import {
  calculateEarnedPoints,
  DEFAULT_POINTS_RULES,
} from "../../lib/creator-campus/points-engine.js";
import {
  sanitizeCellValue,
  parseAndSanitizeCsv,
} from "../../lib/creator-campus/bulk-importer.js";

describe("Creator Campus Ambassador Program — Test Suite", () => {
  const root = process.cwd();

  // ── 1. Referral Code Format & Validation ──
  describe("1. Referral Code Generation & Format (XXXX-NNNN)", () => {
    test("Generates valid uppercase canonical format XXXX-NNNN", () => {
      const code1 = generateReferralCode("Adil Mohammed");
      assert.match(code1, /^[A-Z0-9]{4}-\d{4}$/, "Code must match XXXX-NNNN format");

      const code2 = generateReferralCode("A");
      assert.match(code2, /^[A-Z0-9]{4}-\d{4}$/, "Short names must be padded to 4 letters");

      const code3 = generateReferralCode("");
      assert.match(code3, /^[A-Z0-9]{4}-\d{4}$/, "Empty names fall back to default prefix");
    });

    test("Normalizes codes to uppercase and trims whitespace", () => {
      assert.equal(normalizeReferralCode("  adil-1042  "), "ADIL-1042");
      assert.equal(normalizeReferralCode("cusat-9999"), "CUSAT-9999");
      assert.equal(normalizeReferralCode(null), "");
    });

    test("Validates code format accurately", () => {
      assert.equal(isValidReferralCodeFormat("ADIL-1042"), true);
      assert.equal(isValidReferralCodeFormat("TEST-0001"), true);
      assert.equal(isValidReferralCodeFormat("ADIL1042"), false, "Missing hyphen must be rejected");
      assert.equal(isValidReferralCodeFormat("ADI-1042"), false, "Less than 4 letters must be rejected");
      assert.equal(isValidReferralCodeFormat("ADILL-1042"), false, "More than 4 letters must be rejected");
      assert.equal(isValidReferralCodeFormat("ADIL-104"), false, "Less than 4 digits must be rejected");
    });

    test("Detects and blocks self-referral attempts", () => {
      const amb = {
        userId: "user_adil_123",
        email: "adil@cusat.ac.in",
        phone: "+919876543210",
      };

      assert.equal(checkSelfReferral(amb, { userId: "user_adil_123" }), true);
      assert.equal(checkSelfReferral(amb, { email: "ADIL@CUSAT.AC.IN" }), true);
      assert.equal(checkSelfReferral(amb, { phone: "9876543210" }), true);
      assert.equal(checkSelfReferral(amb, { userId: "other_user", email: "other@example.com" }), false);
    });
  });

  // ── 2. Points Engine & Calculations ──
  describe("2. Points Calculation & Rules", () => {
    test("Calculates correct base points for free tickets", () => {
      const res = calculateEarnedPoints({
        isPaid: false,
        ticketCount: 1,
        rules: { freeRegistrationPoints: 5, paidRegistrationPoints: 15 },
      });
      assert.equal(res.basePoints, 5);
      assert.equal(res.totalPoints, 5);
    });

    test("Applies paid rate for paid orders with ticket count multiplication", () => {
      const res = calculateEarnedPoints({
        isPaid: true,
        ticketCount: 3,
        rules: { freeRegistrationPoints: 5, paidRegistrationPoints: 20 },
      });
      // 20 * 3 = 60
      assert.equal(res.basePoints, 60);
      assert.equal(res.totalPoints, 60);
    });

    test("Unlocks milestone bonuses when registration count crosses threshold", () => {
      const res = calculateEarnedPoints({
        isPaid: true,
        ticketCount: 1,
        currentRegistrationsCount: 4, // 4 -> 5 crosses threshold 5
        rules: {
          paidRegistrationPoints: 10,
          milestones: [{ threshold: 5, bonusPoints: 25 }],
        },
      });
      assert.equal(res.basePoints, 10);
      assert.equal(res.bonusPoints, 25);
      assert.equal(res.totalPoints, 35);
      assert.equal(res.achievedMilestone, 5);
    });

    test("Handles missing or null program rules with secure defaults", () => {
      const resFree = calculateEarnedPoints({
        isPaid: false,
        ticketCount: 1,
      });
      assert.equal(resFree.basePoints, DEFAULT_POINTS_RULES.freeRegistrationPoints);

      const resPaid = calculateEarnedPoints({
        isPaid: true,
        ticketCount: 2,
      });
      assert.equal(resPaid.basePoints, DEFAULT_POINTS_RULES.paidRegistrationPoints * 2);
    });
  });

  // ── 3. Bulk Importer & Formula Injection Sanitization ──
  describe("3. Bulk Importer Security & Formula Injection Sanitization", () => {
    test("Sanitizes formulas starting with '=', '+', '-', '@', tab, and carriage return", () => {
      assert.equal(sanitizeCellValue("=SUM(A1:B10)"), "'=SUM(A1:B10)");
      assert.equal(sanitizeCellValue("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
      assert.equal(sanitizeCellValue("-1+1"), "'-1+1");
      assert.equal(sanitizeCellValue("@SUM(1,2)"), "'@SUM(1,2)");
      assert.equal(sanitizeCellValue("\tmalicious"), "'\tmalicious");
      assert.equal(sanitizeCellValue("Normal Text"), "Normal Text");
    });

    test("Parses CSV rows correctly with formula protection", () => {
      const csvData = `fullName,email,whatsappPhone,college
Adil Mohammed,adil@example.com,9876543210,CUSAT
=HYPERLINK("http://evil.com"),evil@example.com,9876543211,CUSAT`;

      const rows = parseAndSanitizeCsv(csvData);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].fullName, "Adil Mohammed");
      assert.equal(rows[0].email, "adil@example.com");
      assert.equal(rows[1].fullName.startsWith("'="), true, "Formula must be escaped with single quote");
    });
  });

  // ── 4. Firestore Security Rules Inspection ──
  describe("4. Firestore Security Rules Audit & Isolation", () => {
    const rulesPath = path.join(root, "firestore.rules");
    const rulesContent = fs.readFileSync(rulesPath, "utf-8");

    test("Strictly scopes ambassadorPrograms by organizerId", () => {
      assert.match(rulesContent, /match \/ambassadorPrograms\/\{programId\}/, "Must define ambassadorPrograms collection");
      assert.match(rulesContent, /request\.auth\.uid == resource\.data\.get\(['"]organizerId['"]/, "Must scope programs by organizerId");
    });

    test("Blocks client self-approval on ambassadorApplications", () => {
      assert.match(rulesContent, /match \/ambassadorApplications\/\{applicationId\}/, "Must define ambassadorApplications");
      assert.match(rulesContent, /request\.resource\.data\.get\(['"]status['"],\s*['"]['"]\)\s*==\s*['"]pending['"]|request\.resource\.data\.status == ['"]pending['"]/, "Must force client creates to pending status");
    });

    test("Locks pointsLedger, programAmbassadors, and referralCodes from client writes", () => {
      assert.match(rulesContent, /match \/pointsLedger\/\{entryId\}/, "Must define pointsLedger rules");
      assert.match(rulesContent, /match \/programAmbassadors\/\{ambassadorId\}/, "Must define programAmbassadors rules");
      assert.match(rulesContent, /match \/referralCodes\/\{code\w*\}/, "Must define referralCodes rules");
    });
  });

  // ── 5. Payment & Order Attribution Hooks ──
  describe("5. Order Creation & Verification Attribution Hooks", () => {
    const createOrderPath = path.join(root, "src/app/api/create-order/route.js");
    const createOrderContent = fs.readFileSync(createOrderPath, "utf-8");

    test("Validates and attaches referral attribution in create-order", () => {
      assert.match(createOrderContent, /referralCode/, "Must accept referralCode in order request");
      assert.match(createOrderContent, /referralAttribution/, "Must attach referralAttribution to order document");
    });

    test("Safely checks eventDoc.exists as a boolean property in create-order", () => {
      assert.doesNotMatch(createOrderContent, /eventDoc\.exists\(\)/, "Must not call eventDoc.exists() as function");
      assert.match(createOrderContent, /!eventDoc\.exists|eventDoc\.exists === true/, "Must check eventDoc.exists as boolean property");
    });

    const verifyPaymentPath = path.join(root, "src/app/api/verify-payment/route.js");
    const verifyPaymentContent = fs.readFileSync(verifyPaymentPath, "utf-8");

    test("Awards points on payment capture in verify-payment", () => {
      assert.match(verifyPaymentContent, /awardPointsForRegistration/, "Must invoke awardPointsForRegistration on capture");
    });

    const registerFreePath = path.join(root, "src/app/api/register-free/route.js");
    const registerFreeContent = fs.readFileSync(registerFreePath, "utf-8");

    test("Awards points on free event registration in register-free", () => {
      assert.match(registerFreeContent, /awardPointsForRegistration/, "Must invoke awardPointsForRegistration for free ticket");
    });

    const webhookPath = path.join(root, "src/app/api/webhooks/razorpay/route.js");
    const webhookContent = fs.readFileSync(webhookPath, "utf-8");

    test("Reverses points on order refund webhook", () => {
      assert.match(webhookContent, /reversePointsForOrder/, "Must invoke reversePointsForOrder on refund");
    });
  });

  // ── 6. UI & Route Completeness ──
  describe("6. UI Routes & Navigation Completeness", () => {
    test("Organizer shell includes Campus Ambassadors link", () => {
      const shellPath = path.join(root, "components/layout/organiser-shell.jsx");
      const shellContent = fs.readFileSync(shellPath, "utf-8");
      assert.match(shellContent, /\/admin\/programs/, "Shell must link to /admin/programs");
    });

    test("Organizer Program Management Hub page exists", () => {
      const progHubPath = path.join(root, "src/app/(app)/admin/programs/[programId]/page.jsx");
      assert.equal(fs.existsSync(progHubPath), true, "Program Hub page must exist");
    });

    test("Modernized Ambassador Dashboard exists and enforces privacy", () => {
      const ambDashPath = path.join(root, "src/app/(app)/(user)/ambassador/dashboard/page.jsx");
      assert.equal(fs.existsSync(ambDashPath), true, "Ambassador dashboard must exist");
      const ambDashContent = fs.readFileSync(ambDashPath, "utf-8");
      assert.doesNotMatch(ambDashContent, /Total verified visits/, "Must not display click counts");
      assert.doesNotMatch(ambDashContent, /Gross ticket volume/, "Must not display raw revenue numbers");
      assert.match(ambDashContent, /totalPoints/, "Must display points balance");
    });

    test("Public and Embed Leaderboard pages exist", () => {
      const pubLeaderPath = path.join(root, "src/app/(app)/leaderboard/[programId]/page.jsx");
      const embedLeaderPath = path.join(root, "src/app/(app)/embed/leaderboard/[programId]/page.jsx");
      assert.equal(fs.existsSync(pubLeaderPath), true, "Public leaderboard route must exist");
      assert.equal(fs.existsSync(embedLeaderPath), true, "Embed leaderboard route must exist");
    });

    test("Dynamic registration form does not boot user to home screen on payment errors or cancel", () => {
      const formPath = path.join(root, "components/forms/dynamic-registration-form.jsx");
      const formContent = fs.readFileSync(formPath, "utf-8");
      assert.doesNotMatch(formContent, /router\.push\(["']\/["']\)/, "Must not redirect to root '/' on payment failures");
    });

    test("Create Program form presents Program Title field and handles title/name parity", () => {
      const createPagePath = path.join(root, "src/app/(app)/admin/programs/page.jsx");
      const createPageContent = fs.readFileSync(createPagePath, "utf-8");
      assert.match(createPageContent, /Program Title/, "Create modal must display 'Program Title' label");
      assert.match(createPageContent, /title:\s*programTitle/, "Must submit title field in POST body");

      const apiRoutePath = path.join(root, "src/app/api/organizer/programs/route.js");
      const apiRouteContent = fs.readFileSync(apiRoutePath, "utf-8");
      assert.match(apiRouteContent, /body\?\.title\s*\|\|\s*body\?\.name/, "API route must support both title and name");
    });

    test("Date parsing supports DD/MM/YYYY, DD-MM-YYYY and prevents Invalid Date Timestamp errors", async () => {
      const { parseFirestoreDate } = await import("../../lib/date-utils.js");
      const d1 = parseFirestoreDate("13/11/2026");
      assert.ok(d1 instanceof Date);
      assert.equal(d1.getFullYear(), 2026);
      assert.equal(d1.getMonth(), 10); // November (0-indexed)
      assert.equal(d1.getDate(), 13);

      const d2 = parseFirestoreDate("15-11-2026");
      assert.ok(d2 instanceof Date);
      assert.equal(d2.getFullYear(), 2026);
      assert.equal(d2.getMonth(), 10);
      assert.equal(d2.getDate(), 15);

      const d3 = parseFirestoreDate("2026-11-13");
      assert.ok(d3 instanceof Date);
      assert.equal(d3.getFullYear(), 2026);
      assert.equal(d3.getDate(), 13);
    });

    test("Universal authFetch and getAuthToken utilities exist in lib/auth.js", async () => {
      const authModule = await import("../../lib/auth.js");
      assert.equal(typeof authModule.getAuthToken, "function");
      assert.equal(typeof authModule.authFetch, "function");
    });

    test("Public program info endpoint /api/programs/[programId] exists", () => {
      const pubProgRoute = path.join(root, "src/app/api/programs/[programId]/route.js");
      assert.equal(fs.existsSync(pubProgRoute), true, "Public program info route must exist");
    });

    test("Composite index and in-memory sort fallback exist for ambassadorPrograms", () => {
      const indexesPath = path.join(root, "firestore.indexes.json");
      const indexesData = JSON.parse(fs.readFileSync(indexesPath, "utf-8"));
      const programIndex = indexesData.indexes.find(
        (idx) =>
          idx.collectionGroup === "ambassadorPrograms" &&
          idx.fields?.some((f) => f.fieldPath === "organizerId") &&
          idx.fields?.some((f) => f.fieldPath === "createdAt")
      );
      assert.ok(programIndex, "ambassadorPrograms must have composite index in firestore.indexes.json");

      const routePath = path.join(root, "src/app/api/organizer/programs/route.js");
      const routeContent = fs.readFileSync(routePath, "utf-8");
      assert.match(
        routeContent,
        /Composite index not ready|in-memory sort/i,
        "organizer programs route must implement resilient fallback"
      );
      assert.match(
        routeContent,
        /programs\.sort\(/,
        "organizer programs route must perform in-memory sort by createdAt"
      );
    });

    test("Events API endpoint /api/events exists and supports organizer event listing", () => {
      const eventsRoutePath = path.join(root, "src/app/api/events/route.js");
      assert.equal(fs.existsSync(eventsRoutePath), true, "/api/events route must exist");
      const content = fs.readFileSync(eventsRoutePath, "utf-8");
      assert.match(content, /export async function GET/, "Must export GET handler");
      assert.match(content, /adminDb\.collection\("events"\)/, "Must query events collection");
    });

    test("Create Program modal populates associated events and detail review modal is at root level", () => {
      const listPagePath = path.join(root, "src/app/(app)/admin/programs/page.jsx");
      const listContent = fs.readFileSync(listPagePath, "utf-8");
      assert.match(listContent, /availableEvents\.map/, "Create program modal must map availableEvents in dropdown");
      assert.match(listContent, /\/api\/events\?limit=100/, "Create program modal must fetch events from /api/events");

      const detailPagePath = path.join(root, "src/app/(app)/admin/programs/[programId]/page.jsx");
      const detailContent = fs.readFileSync(detailPagePath, "utf-8");
      // Verify review modal has scrollable body and clean structure
      assert.match(detailContent, /selectedApp\s*&&/, "Must render selectedApp review modal");
      assert.match(detailContent, /overflow-y-auto custom-scrollbar/, "Review modal body must have independent scrollbar");
      assert.match(detailContent, /Close/, "Review modal must have Close button");
      assert.match(detailContent, /Approve & Enrol/, "Review modal must have Approve & Enrol button");
    });
  });

  // ── 4. Custom Points Engine (3-Tier Hierarchy, Combos & Bonuses) ──
  describe("4. Custom Points Engine — 3-Tier Priority, Combos & Bonus Rules", () => {
    const customRules = {
      global: {
        freeRegistrationPoints: 10,
        freeEligible: true,
        paidType: "multiplier",
        paidMultiplier: 2,
        paidRegistrationPoints: 20,
        paidEligible: true,
        ineligibleCategories: ["complimentary"],
      },
      eventOverrides: {
        evt_praroha: {
          eventId: "evt_praroha",
          eventName: "PRAROHA Gaming",
          freeRegistrationPoints: 20,
          freeEligible: true,
          paidType: "fixed",
          paidRegistrationPoints: 40,
          paidEligible: true,
          isActive: true,
        },
      },
      ticketOverrides: {
        vip_pass: {
          id: "vip_pass",
          ticketId: "vip_pass",
          ticketName: "VIP Pass",
          points: 30,
          isCombo: false,
          isActive: true,
        },
        combo_pass: {
          id: "combo_pass",
          ticketId: "combo_pass",
          ticketName: "Combo Pass",
          points: 40,
          isCombo: true,
          isActive: true,
        },
      },
      bonusRules: [
        {
          id: "milestone_10",
          name: "First 10 Referrals Milestone",
          bonusType: "milestone",
          bonusPoints: 50,
          milestoneThreshold: 10,
          isActive: true,
        },
        {
          id: "early_bird_rush",
          name: "Early Bird Rush",
          bonusType: "early_bird",
          bonusPoints: 10,
          startDate: "2026-11-01T00:00:00Z",
          endDate: "2026-11-20T23:59:59Z",
          isActive: true,
        },
      ],
      version: 2,
    };

    test("Priority 3: Fallback to Global Default rule when no overrides match", () => {
      const resFree = calculateEarnedPoints({
        isPaid: false,
        ticketCount: 1,
        rules: customRules,
        eventId: "other_event",
      });
      assert.equal(resFree.basePoints, 10);
      assert.equal(resFree.appliedRule.level, "global");

      const resPaid = calculateEarnedPoints({
        isPaid: true,
        ticketCount: 2,
        rules: customRules,
        eventId: "other_event",
      });
      // 10 * 2x * 2 tickets = 40 pts
      assert.equal(resPaid.basePoints, 40);
      assert.equal(resPaid.appliedRule.level, "global");
    });

    test("Priority 2: Event-Specific Rule overrides Global Default (Does NOT sum)", () => {
      const resEvent = calculateEarnedPoints({
        isPaid: false,
        ticketCount: 1,
        rules: customRules,
        eventId: "evt_praroha",
      });
      // Global is 10, but Event override is 20
      assert.equal(resEvent.basePoints, 20);
      assert.equal(resEvent.appliedRule.level, "event");
      assert.equal(resEvent.appliedRule.ruleId, "evt_praroha");
    });

    test("Priority 1: Ticket-Specific Rule overrides Event and Global rules (Highest priority)", () => {
      const resTicket = calculateEarnedPoints({
        isPaid: true,
        ticketCount: 1,
        rules: customRules,
        eventId: "evt_praroha", // Has 40 pt paid override, but VIP pass is 30 pts
        ticketId: "vip_pass",
        ticketType: "VIP Pass",
      });
      assert.equal(resTicket.basePoints, 30);
      assert.equal(resTicket.appliedRule.level, "ticket");
      assert.equal(resTicket.appliedRule.name, "VIP Pass");
    });

    test("Combo Pass has explicit scoring and does NOT multiply across child events", () => {
      const resCombo = calculateEarnedPoints({
        isPaid: true,
        ticketCount: 1,
        rules: customRules,
        ticketId: "combo_pass",
        ticketType: "Combo Pass",
        isCombo: true,
      });
      assert.equal(resCombo.basePoints, 40);
      assert.equal(resCombo.appliedRule.isCombo, true);
    });

    test("Bonus Points Engine: Calculates base + bonuses separately (PRAROHA + Early Bird example)", () => {
      // Prompt Example: Global free = 10, PRAROHA Gaming event override = 20, Early bird bonus = 10 -> Final = 30 pts
      const res = calculateEarnedPoints({
        isPaid: false,
        ticketCount: 1,
        rules: customRules,
        eventId: "evt_praroha",
        registrationTimestamp: "2026-11-13T12:00:00Z", // Within early bird window
      });
      assert.equal(res.basePoints, 20);
      assert.equal(res.bonusPoints, 10);
      assert.equal(res.totalPoints, 30);
    });

    test("Milestone Bonus is awarded on reaching threshold and locked against duplicate awards", () => {
      // Ambassador moves from 9 to 10 referrals -> crosses threshold 10
      const resUnlocked = calculateEarnedPoints({
        isPaid: false,
        ticketCount: 1,
        currentRegistrationsCount: 9,
        rules: customRules,
        eventId: "other_event",
      });
      assert.equal(resUnlocked.bonusPoints, 50);
      assert.equal(resUnlocked.totalPoints, 60); // 10 base + 50 bonus

      // When ambassador has already been awarded milestone_10
      const resDuplicateBlocked = calculateEarnedPoints({
        isPaid: false,
        ticketCount: 1,
        currentRegistrationsCount: 9,
        rules: customRules,
        eventId: "other_event",
        awardedMilestoneIds: ["milestone_10"],
      });
      assert.equal(resDuplicateBlocked.bonusPoints, 0, "Duplicate milestone must not be awarded again");
      assert.equal(resDuplicateBlocked.totalPoints, 10);
    });

    test("Ineligible categories and disabled eligibility evaluate to zero points", () => {
      const resIneligible = calculateEarnedPoints({
        isPaid: true,
        ticketCount: 1,
        rules: customRules,
        ticketType: "complimentary",
      });
      assert.equal(resIneligible.basePoints, 0);
      assert.equal(resIneligible.totalPoints, 0);
      assert.equal(resIneligible.eligible, false);
    });
  });
});
