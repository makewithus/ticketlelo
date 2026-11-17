import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

describe("SuperAdmin Email Monitoring Instant Display & Skeleton Suite", () => {
  test("EmailMonitoringSkeleton is defined and exported from components/ui/skeleton.jsx", () => {
    const skeletonPath = path.join(projectRoot, "components/ui/skeleton.jsx");
    assert.ok(fs.existsSync(skeletonPath), "Skeleton file must exist");
    const content = fs.readFileSync(skeletonPath, "utf-8");

    assert.ok(content.includes("export function EmailMonitoringSkeleton"), "Must export EmailMonitoringSkeleton");
    assert.ok(content.includes("Daily Quota"), "Skeleton must include daily quota placeholder");
    assert.ok(content.includes("Monthly Quota"), "Skeleton must include monthly quota placeholder");
    assert.ok(content.includes("Priority / Type"), "Skeleton must include table columns");
  });

  test("EmailMonitoringDashboard supports instant client-cache hydration & skeleton fallback", () => {
    const compPath = path.join(projectRoot, "components/admin/email-monitoring.jsx");
    assert.ok(fs.existsSync(compPath), "EmailMonitoringDashboard file must exist");
    const content = fs.readFileSync(compPath, "utf-8");

    // Client caching
    assert.ok(content.includes("getCachedItem"), "Must import getCachedItem for instant rendering");
    assert.ok(content.includes("setCachedItem"), "Must import setCachedItem to cache metrics");
    assert.ok(content.includes("superadmin_email_monitoring"), "Must use superadmin_email_monitoring cache key");

    // Skeleton fallback
    assert.ok(content.includes("EmailMonitoringSkeleton"), "Must import EmailMonitoringSkeleton");
    assert.ok(
      content.includes("return <EmailMonitoringSkeleton") || content.includes("<EmailMonitoringSkeleton />"),
      "Must render EmailMonitoringSkeleton while loading without cached data"
    );

    // Refresh control
    assert.ok(content.includes("RefreshCw"), "Must provide refresh trigger with spinning feedback");
    assert.ok(content.includes("isRefreshing"), "Must track isRefreshing state for background revalidation");

    // Safe Date Parsing (no Invalid Date)
    assert.ok(content.includes("parseFirestoreDate"), "Must use parseFirestoreDate for safe timestamp parsing");
    assert.ok(!content.includes("new Date(job.createdAt).toLocaleString"), "Must not use raw new Date(job.createdAt) without parsing");
  });

  test("Superadmin email route serializes timestamps to ISO strings", () => {
    const routePath = path.join(projectRoot, "src/app/api/admin/emails/route.js");
    assert.ok(fs.existsSync(routePath), "Route file must exist");
    const content = fs.readFileSync(routePath, "utf-8");

    assert.ok(content.includes("normalizeIsoDate"), "Route must normalize dates to ISO strings");
    assert.ok(content.includes("createdAt: normalizeIsoDate"), "createdAt must be normalized");
  });

  test("Superadmin emails page wraps dashboard in Suspense fallback", () => {
    const pagePath = path.join(projectRoot, "src/app/(app)/superadmin/emails/page.jsx");
    assert.ok(fs.existsSync(pagePath), "Page file must exist");
    const content = fs.readFileSync(pagePath, "utf-8");

    assert.ok(content.includes("Suspense"), "Page must import Suspense");
    assert.ok(content.includes("fallback={<EmailMonitoringSkeleton"), "Page must provide EmailMonitoringSkeleton fallback");
  });
});
