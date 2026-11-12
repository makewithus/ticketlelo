import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Mobile Responsiveness — Verification of Hamburger Nav, Sidebar Drawers & Organisers Mobile View", async (t) => {
  const root = process.cwd();

  await t.test("OrganisersManagement provides single Loading text without 'from database'", () => {
    const filePath = path.join(root, "components/admin/organisers-management.jsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Must not contain "from database"
    assert.doesNotMatch(content, /loading\s+organisers\s+from\s+database/i, "Must not contain 'loading organisers from database'");
    assert.doesNotMatch(content, /from\s+database/i, "Must not contain 'from database'");

    // Must contain single clean Loading...
    assert.match(content, /<p[^>]*>Loading\.\.\.<\/p>/, "Must contain clean 'Loading...'");
  });

  await t.test("OrganisersManagement renders desktop table and mobile responsive card list", () => {
    const filePath = path.join(root, "components/admin/organisers-management.jsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Desktop view must be hidden on mobile
    assert.match(content, /hidden\s+md:block/, "Desktop table must be hidden on mobile");
    // Mobile view must be hidden on desktop
    assert.match(content, /md:hidden/, "Mobile card view must be rendered for small devices");
    // Action menu popover support in both
    assert.match(content, /Inspect portal/);
    assert.match(content, /View guest list/);
    assert.match(content, /Reset login/);
    assert.match(content, /Delete organiser/);
  });

  await t.test("OrganisersManagement supports deleting organisers with confirmation modal and API integration", () => {
    const filePath = path.join(root, "components/admin/organisers-management.jsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.match(content, /handleDeleteOrganiser/, "Must provide delete organiser handler");
    assert.match(content, /fetch\(\"\/api\/superadmin\/organisers\",\s*\{\s*method:\s*\"DELETE\"/, "Must call DELETE /api/superadmin/organisers");
    assert.match(content, /deleteModalData/, "Must maintain delete modal state");
    assert.match(content, /Delete Organiser/, "Must render Delete Organiser confirmation button");
  });

  await t.test("Backend API /api/superadmin/organisers supports DELETE endpoint with superadmin access check", () => {
    const filePath = path.join(root, "src/app/api/superadmin/organisers/route.js");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.match(content, /export\s+async\s+function\s+DELETE/, "Must export async DELETE handler");
    assert.match(content, /isAuthorizedSuperAdmin/, "Must verify super administrator authorization");
    assert.match(content, /Cannot delete a super administrator account/, "Must prevent deleting super admin accounts");
    assert.match(content, /adminAuth\.deleteUser/, "Must delete auth user");
    assert.match(content, /hostingRequests/, "Must clean up hosting requests");
  });

  await t.test("SuperAdminLayout includes mobile hamburger button and slide-out sidebar drawer", () => {
    const filePath = path.join(root, "src/app/(app)/superadmin/layout.jsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Hamburger button
    assert.match(content, /mobileSidebarOpen/, "Layout must maintain mobile sidebar state");
    assert.match(content, /Menu\s+className/, "Layout must include hamburger icon");
    assert.match(content, /aria-label="Open navigation sidebar"/, "Layout must have accessible hamburger button");

    // Sidebar drawer with backdrop
    assert.match(content, /fixed\s+inset-0\s+z-50\s+md:hidden/, "Layout must render modal/drawer container for mobile");
    assert.match(content, /fixed\s+inset-0\s+bg-black/, "Layout must render backdrop overlay");
    assert.match(content, /Switch Portals/, "Sidebar must offer portal switching");
  });

  await t.test("OrganiserShell includes mobile slide-out sidebar drawer with overlay", () => {
    const filePath = path.join(root, "components/layout/organiser-shell.jsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.match(content, /mobileMenuOpen/, "Organiser shell must track mobile menu state");
    assert.match(content, /fixed\s+inset-0\s+bg-black/, "Organiser shell must render backdrop overlay");
    assert.match(content, /Organiser Suite/, "Organiser shell drawer must contain suite links");
  });

  await t.test("DashboardPage includes mobile hamburger button and sidebar drawer", () => {
    const filePath = path.join(root, "src/app/(app)/(user)/dashboard/page.jsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.match(content, /mobileMenuOpen/, "Dashboard page must track mobile menu state");
    assert.match(content, /aria-label="Open navigation sidebar"/, "Dashboard page must have hamburger button");
    assert.match(content, /fixed\s+inset-0\s+bg-black/, "Dashboard drawer must have backdrop overlay");
  });
});
