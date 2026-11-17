import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

describe("SuperAdmin Unified Light Theme & Image-1 Consistency Suite", () => {
  test("Superadmin emails page matches Hosting Requests layout and typography", () => {
    const pagePath = path.join(projectRoot, "src/app/(app)/superadmin/emails/page.jsx");
    assert.ok(fs.existsSync(pagePath), "emails/page.jsx must exist");
    const content = fs.readFileSync(pagePath, "utf-8");

    // Standardized page wrapper
    assert.ok(content.includes('className="space-y-6"'), "Must use space-y-6 wrapper");
    assert.ok(!content.includes("max-w-6xl"), "Must not artificially constrain width with max-w-6xl");

    // Standardized typography
    assert.ok(
      content.includes("text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight"),
      "Must match Image 1 page title styling"
    );
    assert.ok(content.includes("Email monitoring"), "Must have clean Email monitoring title");
    assert.ok(
      content.includes("text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] mt-1"),
      "Must match Image 1 subtitle styling"
    );
  });

  test("EmailMonitoringDashboard matches Image 1 toolbar, segmented tabs, and table styling", () => {
    const compPath = path.join(projectRoot, "components/admin/email-monitoring.jsx");
    assert.ok(fs.existsSync(compPath), "email-monitoring.jsx must exist");
    const content = fs.readFileSync(compPath, "utf-8");

    // Live status pill
    assert.ok(content.includes("animate-ping"), "Must include pulsating ping dot for live status");
    assert.ok(content.includes("Live"), "Must show Live status indicator");

    // Segmented Status Buttons
    assert.ok(content.includes("Delivered ("), "Must include Delivered segmented tab with count");
    assert.ok(content.includes("Pending ("), "Must include Pending segmented tab with count");
    assert.ok(content.includes("Scheduled ("), "Must include Scheduled segmented tab with count");
    assert.ok(content.includes("Failed ("), "Must include Failed segmented tab with count");

    // Dropdowns for Sort & Period matching Image 1
    assert.ok(content.includes('label="Sort"'), "Must include Sort dropdown");
    assert.ok(content.includes('label="Period"'), "Must include Period dropdown");

    // Table Header styling
    assert.ok(
      content.includes("bg-slate-50/70 dark:bg-[#131517]/50"),
      "Table headers must use light canvas bg-slate-50/70"
    );
    assert.ok(
      content.includes("text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px]"),
      "Table headers must match Image 1 tracking and font size"
    );

    // Status Pills with colored dots
    assert.ok(
      content.includes("rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"),
      "Delivered pill must match Image 1 green pill styling"
    );
    assert.ok(
      content.includes("rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400"),
      "Pending pill must match Image 1 yellow pill styling"
    );

    // Pagination
    assert.ok(content.includes("Showing") && content.includes("jobs"), "Must include pagination summary");
    assert.ok(content.includes("Previous"), "Must include Previous button");
    assert.ok(content.includes("Next"), "Must include Next button");
  });

  test("Organisers management page has dark-mode and light-mode compatible tokens", () => {
    const compPath = path.join(projectRoot, "components/admin/organisers-management.jsx");
    assert.ok(fs.existsSync(compPath), "organisers-management.jsx must exist");
    const content = fs.readFileSync(compPath, "utf-8");

    // Title contrast
    assert.ok(
      content.includes("text-slate-900 dark:text-white"),
      "Title must have text-slate-900 for light mode"
    );

    // Segmented buttons
    assert.ok(
      content.includes("inline-flex items-center bg-slate-100 dark:bg-[#1A1C1F]"),
      "Segmented tabs container must support light mode background"
    );

    // Table styling
    assert.ok(
      content.includes("bg-slate-50/70 dark:bg-[#131517]/50"),
      "Table headers must use light canvas bg-slate-50/70"
    );
  });

  test("Subscription plans view provides polished high-contrast table headers and switcher", () => {
    const compPath = path.join(projectRoot, "components/admin/plans/superadmin-plans-view.jsx");
    assert.ok(fs.existsSync(compPath), "superadmin-plans-view.jsx must exist");
    const content = fs.readFileSync(compPath, "utf-8");

    // Title
    assert.ok(content.includes("Plans &amp; facilities") || content.includes("Plans & facilities"));
    assert.ok(content.includes("text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight"));

    // Table header
    assert.ok(
      content.includes("bg-slate-50/70 dark:bg-[#131517]/50 border-b border-slate-200 dark:border-[#2A2D31] text-slate-500 dark:text-[#9B9EA4] font-semibold text-[12px] uppercase tracking-[0.6px]"),
      "Table headers must match Image 1 styling"
    );
  });
});
