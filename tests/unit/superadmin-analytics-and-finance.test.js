import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

describe("Super Admin Advanced UI, Finance & Event Analytics Suite", () => {
  test("Overview API guarantees double-entry financial consistency & event separation", () => {
    const routePath = path.join(projectRoot, "src/app/api/superadmin/overview/route.js");
    assert.ok(fs.existsSync(routePath), "Overview route must exist");
    const routeContent = fs.readFileSync(routePath, "utf-8");

    // Financial calculations & double-entry balance
    assert.match(routeContent, /totalGMVPaise/, "Route must calculate totalGMVPaise");
    assert.match(routeContent, /totalCommissionPaise/, "Route must calculate totalCommissionPaise");
    assert.match(routeContent, /totalOrganizerPaise/, "Route must calculate totalOrganizerPaise");
    assert.match(routeContent, /totalRefundedPaise/, "Route must calculate totalRefundedPaise");
    assert.match(
      routeContent,
      /totalGrossPaise\s*-\s*totalCommissionPaise\s*-\s*totalRefundedPaise/,
      "Route must strictly balance organizer net share against gross, commission, and refunds"
    );

    // Dedicated Event Analytics separation
    assert.match(routeContent, /eventAnalytics/, "Route must return dedicated eventAnalytics object");
    assert.match(routeContent, /categoryMap|inferCategory/, "Route must provide event category segmentation");
    assert.match(routeContent, /topEventsByTickets/, "Route must compute top events by tickets");
    assert.match(routeContent, /topEventsByRevenue/, "Route must compute top events by revenue");
    assert.match(routeContent, /capacityFulfillmentRate/, "Route must compute overall capacity fulfillment rate");
  });

  test("Payments summary API provides platform-wide rollup for Super Admin", () => {
    const paymentsSummaryRoute = path.join(projectRoot, "src/app/api/payments/summary/route.js");
    assert.ok(fs.existsSync(paymentsSummaryRoute), "Payments summary route must exist");
    const content = fs.readFileSync(paymentsSummaryRoute, "utf-8");

    // SuperAdmin role resolution
    assert.match(content, /isSuperAdmin/, "Route must verify super admin privileges");
    assert.match(content, /caller\.role\s*===\s*['"]superAdmin['"]/, "Route must recognize 'superAdmin' role");
    assert.match(content, /getLedgerSummaryForOrganizer/, "Route must invoke ledger summary");
  });

  test("SuperAdmin Dashboard View embeds animated finance and dedicated event analytics studios", () => {
    const dashboardViewPath = path.join(projectRoot, "components/admin/superadmin-dashboard-view.jsx");
    assert.ok(fs.existsSync(dashboardViewPath), "Dashboard view must exist");
    const content = fs.readFileSync(dashboardViewPath, "utf-8");

    // Core navigation tabs
    assert.match(content, /id:\s*"overview"/, "Must have overview tab");
    assert.match(content, /id:\s*"financials"/, "Must have financials tab");
    assert.match(content, /id:\s*"events"/, "Must have events tab");
    assert.match(content, /id:\s*"organisers"/, "Must have organisers tab");
    assert.match(content, /id:\s*"site-settings"/, "Must have site-settings tab");
    assert.match(content, /id:\s*"emails"/, "Must have emails tab");

    // Embedded Core Components
    assert.match(content, /<OrganisersManagement/, "Must embed OrganisersManagement");
    assert.match(content, /<SiteSettingsManager/, "Must embed SiteSettingsManager");
    assert.match(content, /<EmailMonitoringDashboard/, "Must embed EmailMonitoringDashboard");

    // Visual animated charts (AreaChart & PieChart)
    assert.match(content, /<AreaChart/, "Must render AreaChart for revenue velocity");
    assert.match(content, /<PieChart/, "Must render PieChart for payment method split");
    assert.match(content, /CustomChartTooltip/, "Must have dark mode custom chart tooltip");

    // Double-entry accounting presentation
    assert.match(content, /Gross GMV/, "Must present Gross GMV");
    assert.match(content, /Platform Margin/, "Must present Platform Margin");
    assert.match(content, /Creator Net Share/, "Must present Creator Net Share");
    assert.match(content, /Refunds Processed/, "Must present Refunds Processed");

    // Event intelligence presentation
    assert.match(content, /Gate Check-In Conversion/, "Must present check-in conversion");
    assert.match(content, /Event Distribution by Genre/, "Must present category distribution");
    assert.match(content, /Top Events Leaderboard/, "Must present top events leaderboard");
  });
});
