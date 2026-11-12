import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Super Admin Suite — Verification of Core Modules (Hosting Requests, Organisers, Site Settings, Email Monitoring)", async (t) => {
  const root = process.cwd();

  await t.test("SuperAdmin layout includes all 4 required navigation links in topSubtabs & superAdminNav", () => {
    const layoutPath = path.join(root, "src/app/(app)/superadmin/layout.jsx");
    const content = fs.readFileSync(layoutPath, "utf-8");

    // Check topSubtabs
    assert.match(content, /\/superadmin\/hosting-requests/, "Layout must include /superadmin/hosting-requests");
    assert.match(content, /\/superadmin\/organisers/, "Layout must include /superadmin/organisers");
    assert.match(content, /\/superadmin\/site-settings/, "Layout must include /superadmin/site-settings");
    assert.match(content, /\/superadmin\/emails/, "Layout must include /superadmin/emails");

    // Check labels
    assert.match(content, /Hosting requests/, "Layout must label hosting requests");
    assert.match(content, /Organisers/, "Layout must label organisers");
    assert.match(content, /Site settings/, "Layout must label site settings");
    assert.match(content, /Email monitoring/, "Layout must label email monitoring");
  });

  await t.test("SuperAdmin dashboard view provides interactive tabs for management modules", () => {
    const dashboardViewPath = path.join(root, "components/admin/superadmin-dashboard-view.jsx");
    const content = fs.readFileSync(dashboardViewPath, "utf-8");

    // Check tab IDs
    assert.match(content, /id:\s*"organisers"/, "Dashboard tabs must have organisers");
    assert.match(content, /id:\s*"site-settings"/, "Dashboard tabs must have site-settings");
    assert.match(content, /id:\s*"emails"/, "Dashboard tabs must have emails");

    // Check embedded component renderings
    assert.match(content, /<OrganisersManagement/, "Dashboard must embed OrganisersManagement");
    assert.match(content, /<SiteSettingsManager/, "Dashboard must embed SiteSettingsManager");
    assert.match(content, /<EmailMonitoringDashboard/, "Dashboard must embed EmailMonitoringDashboard");
  });

  await t.test("Dedicated routes for all 4 core modules exist and render properly", () => {
    const hostingPath = path.join(root, "src/app/(app)/superadmin/hosting-requests/page.jsx");
    const organisersPath = path.join(root, "src/app/(app)/superadmin/organisers/page.jsx");
    const siteSettingsPath = path.join(root, "src/app/(app)/superadmin/site-settings/page.jsx");
    const emailsPath = path.join(root, "src/app/(app)/superadmin/emails/page.jsx");

    assert.ok(fs.existsSync(hostingPath), "hosting-requests page must exist");
    assert.ok(fs.existsSync(organisersPath), "organisers page must exist");
    assert.ok(fs.existsSync(siteSettingsPath), "site-settings page must exist");
    assert.ok(fs.existsSync(emailsPath), "emails page must exist");

    const hostingContent = fs.readFileSync(hostingPath, "utf-8");
    const organisersContent = fs.readFileSync(organisersPath, "utf-8");
    const siteSettingsContent = fs.readFileSync(siteSettingsPath, "utf-8");
    const emailsContent = fs.readFileSync(emailsPath, "utf-8");

    assert.match(hostingContent, /HostingRequestManagement/, "hosting-requests page must render HostingRequestManagement");
    assert.match(organisersContent, /OrganisersManagement/, "organisers page must render OrganisersManagement");
    assert.match(siteSettingsContent, /SiteSettingsManager/, "site-settings page must render SiteSettingsManager");
    assert.match(emailsContent, /EmailMonitoringDashboard/, "emails page must render EmailMonitoringDashboard");
  });
});
