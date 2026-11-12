import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Super Admin Organisers — Delete Functionality & Security Suite", async (t) => {
  const root = process.cwd();

  await t.test("Organisers route implements secure DELETE endpoint", () => {
    const routePath = path.join(root, "src/app/api/superadmin/organisers/route.js");
    assert.ok(fs.existsSync(routePath), "Route file must exist");

    const content = fs.readFileSync(routePath, "utf-8");
    assert.match(content, /export async function DELETE\(request\)/, "Must export DELETE handler");
    assert.match(content, /isAuthorizedSuperAdmin/, "Must verify super administrator authorization");
    assert.match(content, /Database unavailable/, "Must handle database unavailability");
    assert.match(content, /Super administrator access required/, "Must enforce 403 on non-superadmin caller");
  });

  await t.test("DELETE endpoint protects super administrator accounts from accidental deletion", () => {
    const routePath = path.join(root, "src/app/api/superadmin/organisers/route.js");
    const content = fs.readFileSync(routePath, "utf-8");

    assert.match(content, /adil4ticketlelo@gmail\.com/, "Must protect hardcoded superadmin");
    assert.match(content, /superadmin@ticketlelo\.com/, "Must protect domain superadmin");
    assert.match(content, /SUPER_ADMIN_EMAIL/, "Must check SUPER_ADMIN_EMAIL env");
    assert.match(content, /Cannot delete a super administrator account/, "Must return error message on superadmin target");
  });

  await t.test("DELETE endpoint performs comprehensive cleanup across Auth, Firestore users, hosting requests, and events", () => {
    const routePath = path.join(root, "src/app/api/superadmin/organisers/route.js");
    const content = fs.readFileSync(routePath, "utf-8");

    // Auth user deletion
    assert.match(content, /adminAuth\.deleteUser/, "Must delete user from Firebase Auth");

    // Firestore user doc deletion
    assert.match(content, /collection\("users"\)\.doc\(resolvedUid\)\.delete\(\)/, "Must delete user document in users collection");

    // Hosting request cleanup
    assert.match(content, /hostingRequests/, "Must query and clean hostingRequests collection");

    // Associated events handling (delete or unpublish)
    assert.match(content, /customForms/, "Must clean up associated custom forms if events are deleted");
    assert.match(content, /unpublishReason/, "Must unpublish events if not permanently deleting");

    // Audit logging
    assert.match(content, /adminAuditLogs/, "Must log action to adminAuditLogs");
    assert.match(content, /ORGANISER_DELETED/, "Must record ORGANISER_DELETED in audit logs");
  });

  await t.test("OrganisersManagement UI exposes Delete Organiser action in table and mobile card menus", () => {
    const componentPath = path.join(root, "components/admin/organisers-management.jsx");
    const content = fs.readFileSync(componentPath, "utf-8");

    // Must import Trash2 icon
    assert.match(content, /Trash2/, "Must import Trash2 icon");

    // Desktop and mobile action menu button
    const deleteButtonMatches = content.match(/Delete organiser/g);
    assert.ok(deleteButtonMatches && deleteButtonMatches.length >= 2, "Must include 'Delete organiser' in both desktop and mobile menus");

    // Delete confirmation modal
    assert.match(content, /deleteModalData/, "Must control confirmation modal with state");
    assert.match(content, /Delete Organiser/, "Must render confirmation modal with action button");
    assert.match(content, /Also permanently delete associated events/, "Must offer option to delete associated events");

    // Client cache update after deletion
    assert.match(content, /setCachedItem\("superadmin_organisers"/, "Must invalidate or update superadmin_organisers cache upon deletion");
  });
});
