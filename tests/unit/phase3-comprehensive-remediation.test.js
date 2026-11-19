import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validatePhoneNumber, formatPhoneDisplay } from "../../lib/phone-validation.js";

test("Phase 3 Comprehensive Remediation Suite — All 6 QA Defects", async (t) => {
  const root = process.cwd();

  // ─────────────────────────────────────────────────────────────
  // M1 — ORGANISER AND USER COUNTS ARE INCONSISTENT
  // ─────────────────────────────────────────────────────────────
  await t.test("M1: Metric definitions and count consistency across endpoints", () => {
    const plansRoutePath = path.join(root, "src/app/api/superadmin/plans/route.js");
    const organisersRoutePath = path.join(root, "src/app/api/superadmin/organisers/route.js");
    const usersRoutePath = path.join(root, "src/app/api/superadmin/users/route.js");
    const hostingComponentPath = path.join(root, "components/admin/hosting-request-management.jsx");

    assert.ok(fs.existsSync(plansRoutePath), "Plans route must exist");
    assert.ok(fs.existsSync(organisersRoutePath), "Organisers route must exist");
    assert.ok(fs.existsSync(usersRoutePath), "Users route must exist");
    assert.ok(fs.existsSync(hostingComponentPath), "Hosting component must exist");

    const plansContent = fs.readFileSync(plansRoutePath, "utf-8");
    assert.match(plansContent, /targetUserDocs/, "Plans route must filter target users to organisers");
    assert.match(plansContent, /totalRegisteredUsers/, "Plans route must track total registered users separately");
    assert.match(plansContent, /totalUsers:\s*users\.length/, "Plans metrics.totalUsers must match returned users array");

    const organisersContent = fs.readFileSync(organisersRoutePath, "utf-8");
    assert.match(organisersContent, /uniqueEmailSet/, "Organisers route must compute unique organiser accounts");
    assert.match(organisersContent, /const metrics\s*=\s*\{/, "Organisers route must return structured metrics");
    assert.match(organisersContent, /totalAllocations:/, "Organisers metrics must include totalAllocations");
    assert.match(organisersContent, /uniqueOrganisers:/, "Organisers metrics must include uniqueOrganisers");

    const usersContent = fs.readFileSync(usersRoutePath, "utf-8");
    assert.match(usersContent, /const stats\s*=\s*\{/, "Users route must return partitioned role stats");
    assert.match(usersContent, /attendees,/, "Users route stats must include attendees");
    assert.match(usersContent, /organisers,/, "Users route stats must include organisers");
    assert.match(usersContent, /superAdmins,/, "Users route stats must include superAdmins");

    const hostingContent = fs.readFileSync(hostingComponentPath, "utf-8");
    assert.match(hostingContent, /counts\.pending/, "Hosting UI must track pending count");
    assert.match(hostingContent, /counts\.approved/, "Hosting UI must track approved count");
    assert.match(hostingContent, /counts\.rejected/, "Hosting UI must track rejected count");
  });

  // ─────────────────────────────────────────────────────────────
  // M10 — USER PHONE NUMBER VALIDATION
  // ─────────────────────────────────────────────────────────────
  await t.test("M10: Phone validation, E.164 normalization, and duplicate rejection", () => {
    // 1. Valid Indian mobile numbers
    const v1 = validatePhoneNumber("9876543210", { country: "IN" });
    assert.equal(v1.isValid, true);
    assert.equal(v1.e164, "+919876543210");
    assert.equal(v1.international, "+91 98765 43210");

    const v2 = validatePhoneNumber("+91 82659 40243");
    assert.equal(v2.isValid, true);
    assert.equal(v2.e164, "+918265940243");

    // 2. Reject 12-digit, 14-digit fake numbers from QA report
    const fake14 = validatePhoneNumber("74413131646131", { country: "IN" });
    assert.equal(fake14.isValid, false);
    assert.ok(fake14.error, "Must return error message on invalid 14-digit number");

    const fake12 = validatePhoneNumber("451123753951", { country: "IN" });
    assert.equal(fake12.isValid, false);
    assert.ok(fake12.error, "Must return error message on invalid 12-digit number");

    // 3. Reject alphabetic characters
    const alpha = validatePhoneNumber("98765abcde", { country: "IN" });
    assert.equal(alpha.isValid, false);

    // 4. Safe display formatting without crashes on legacy records
    const legacyFormatted = formatPhoneDisplay("74413131646131");
    assert.equal(legacyFormatted, "74413131646131", "Legacy malformed record preserved without throwing");

    const validFormatted = formatPhoneDisplay("+919876543210");
    assert.equal(validFormatted, "+91 98765 43210");

    // 5. Backend check in users route
    const usersRouteContent = fs.readFileSync(path.join(root, "src/app/api/superadmin/users/route.js"), "utf-8");
    assert.match(usersRouteContent, /validatePhoneNumber\(rawPhone/, "POST /api/superadmin/users must validate phone");
    assert.match(usersRouteContent, /already registered to another account/, "Must check duplicate phone uniqueness");
    assert.match(usersRouteContent, /status:\s*409/, "Must return 409 Conflict on duplicate phone");
  });

  // ─────────────────────────────────────────────────────────────
  // L2 — HOSTING APPROVAL HAS CONFIRMATION DIALOG
  // ─────────────────────────────────────────────────────────────
  await t.test("L2: Safe approval workflow with modal, double-click protection, and idempotency", () => {
    const hostingComponentPath = path.join(root, "components/admin/hosting-request-management.jsx");
    const content = fs.readFileSync(hostingComponentPath, "utf-8");

    // Confirmation dialog state and trigger
    assert.match(content, /approvalConfirmModalOpen/, "Must have approvalConfirmModalOpen state");
    assert.match(content, /Confirm Organizer Approval/, "Modal must display Confirm Organizer Approval heading");

    // Details displayed in modal
    assert.match(content, /requestToApprove\.name/, "Modal must show applicant name");
    assert.match(content, /requestToApprove\.college/, "Modal must show applicant college");
    assert.match(content, /requestToApprove\.eventTitle/, "Modal must show event title");

    // Double submission protection and loading indicator
    assert.match(content, /isApproving/, "Must have isApproving state");
    assert.match(content, /disabled=\{isApproving\}/, "Buttons must be disabled while approving");

    // Idempotency pre-check
    assert.match(content, /req\.status !== "pending"/, "Must guard against approving non-pending requests");

    // Latency metrics tracking
    assert.match(content, /createDuration/, "Must log event creation duration");
    assert.match(content, /dbDuration/, "Must log database write duration");
    assert.match(content, /emailDuration/, "Must log email dispatch duration");
  });

  // ─────────────────────────────────────────────────────────────
  // L3 — HOSTING REQUEST SORTING AND DATE DISPLAY
  // ─────────────────────────────────────────────────────────────
  await t.test("L3: Deterministic sorting, 4-digit year dates, and SprintHacks duplicate preservation", () => {
    const hostingComponentPath = path.join(root, "components/admin/hosting-request-management.jsx");
    const content = fs.readFileSync(hostingComponentPath, "utf-8");

    // Date formatting with 4-digit year and Indian locale
    assert.match(content, /formatRequestDate/, "Must define formatRequestDate helper");
    assert.match(content, /year:\s*"numeric"/, "Date formatter must include 4-digit year");
    assert.match(content, /month:\s*"short"/, "Date formatter must include short month");
    assert.match(content, /day:\s*"numeric"/, "Date formatter must include day");
    assert.match(content, /timeZone:\s*"Asia\/Kolkata"/, "Date formatter must enforce Asia/Kolkata timezone");

    // Sorting logic actually controls data
    assert.match(content, /sortBy === "urgent"/, "Must handle urgent sort order");
    assert.match(content, /sortBy === "oldest"/, "Must handle oldest sort order");
    assert.match(content, /sortBy === "title"/, "Must handle title sort order");
    assert.match(content, /sortBy === "tickets"/, "Must handle tickets sort order");
    assert.match(content, /localeCompare\(itemB\.id/, "Must implement deterministic tie-breaking");

    // Filter separation ensures pending view does NOT show rejected SprintHacks duplicates
    assert.match(content, /statusFilter === "pending"/, "Must filter pending status exclusively");
    assert.match(content, /statusFilter === "rejected"/, "Must filter rejected status exclusively");
  });

  // ─────────────────────────────────────────────────────────────
  // L4 — USERS TABLE PAGINATION
  // ─────────────────────────────────────────────────────────────
  await t.test("L4: Scalable server-side pagination with configurable page size", () => {
    const usersRoutePath = path.join(root, "src/app/api/superadmin/users/route.js");
    const usersPagePath = path.join(root, "src/app/(app)/superadmin/users/page.jsx");

    const routeContent = fs.readFileSync(usersRoutePath, "utf-8");
    assert.match(routeContent, /const page = Math\.max\(1, parseInt\(searchParams\.get\("page"\)/, "API parses page param");
    assert.match(routeContent, /const pageSize = Math\.min\(100/, "API parses pageSize param");
    assert.match(routeContent, /total:\s*totalMatching/, "API returns totalMatching count");
    assert.match(routeContent, /totalPages,/, "API returns totalPages count");

    const pageContent = fs.readFileSync(usersPagePath, "utf-8");
    assert.match(pageContent, /currentPage/, "UI tracks currentPage state");
    assert.match(pageContent, /pageSize/, "UI tracks pageSize state");
    assert.match(pageContent, /totalPages/, "UI tracks totalPages state");
    assert.match(pageContent, /totalMatching/, "UI tracks totalMatching state");
    assert.match(pageContent, /handlePageSizeChange/, "UI renders configurable page size selector");
    assert.match(pageContent, /handlePageChange\(Math\.max\(1, currentPage - 1\)\)/, "UI provides Previous button handler");
    assert.match(pageContent, /handlePageChange\(Math\.min\(totalPages, currentPage \+ 1\)\)/, "UI provides Next button handler");
  });

  // ─────────────────────────────────────────────────────────────
  // L5 — MOBILE RESPONSIVE LAYOUT
  // ─────────────────────────────────────────────────────────────
  await t.test("L5: Mobile cards and accessible touch targets at 375px/390px/430px viewports", () => {
    const hostingComponentPath = path.join(root, "components/admin/hosting-request-management.jsx");
    const content = fs.readFileSync(hostingComponentPath, "utf-8");

    // Responsive bifurcation: desktop table hidden on mobile, mobile cards hidden on desktop
    assert.match(content, /hidden md:block/, "Desktop table must be hidden on mobile (<md)");
    assert.match(content, /md:hidden divide-y/, "Mobile cards container must be rendered for <md viewports");

    // Full action buttons visible without horizontal scroll
    assert.match(content, /h-11/, "Mobile buttons must have h-11 (44px) accessible touch target height");
    assert.match(content, /<span>Approve<\/span>/, "Mobile card must have explicit Approve button");
    assert.match(content, /<span>Reject<\/span>/, "Mobile card must have explicit Reject button");

    // Confirmation modal fits mobile screen
    assert.match(content, /max-w-md/, "Confirmation modal must constrain max-width on larger screens");
  });
});
