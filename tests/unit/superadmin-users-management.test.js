import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Super Admin Users Management & Login Flow Verification", () => {
  const root = process.cwd();

  test("Super Admin Layout includes Users navigation tab", () => {
    const layoutPath = path.join(root, "src/app/(app)/superadmin/layout.jsx");
    const content = fs.readFileSync(layoutPath, "utf-8");

    assert.ok(content.includes('href: "/superadmin/users"'), "Includes /superadmin/users tab href");
    assert.ok(content.includes('label: "Users"'), "Includes Users label");
    assert.ok(content.includes("Users"), "Imports or references Users icon");
  });

  test("Login page removes manual account creation switcher and enforces sign in", () => {
    const loginPagePath = path.join(root, "src/app/(app)/(public)/login/page.jsx");
    const content = fs.readFileSync(loginPagePath, "utf-8");

    // Must not contain manual create account tab switcher
    assert.strictEqual(
      content.includes("Sign in / Sign up Mode Switcher Tabs"),
      false,
      "Must not contain Mode Switcher Tabs"
    );

    // Must contain ticket guidance in footer instead of open registration link
    assert.ok(
      content.includes("Attending an event? Access your tickets using the link sent to your registered email."),
      "Directs attendees to access via ticket confirmation link"
    );
  });

  test("Super Admin Users API endpoint exists and defines GET, POST, and PATCH", () => {
    const apiPath = path.join(root, "src/app/api/superadmin/users/route.js");
    assert.ok(fs.existsSync(apiPath), "src/app/api/superadmin/users/route.js must exist");

    const content = fs.readFileSync(apiPath, "utf-8");
    assert.ok(content.includes("export async function GET"), "Defines GET handler");
    assert.ok(content.includes("export async function POST"), "Defines POST handler for user creation");
    assert.ok(content.includes("export async function PATCH"), "Defines PATCH handler for role modification");
    assert.ok(content.includes("isAuthorizedSuperAdmin"), "Enforces super admin authorization");
  });

  test("Super Admin Impersonation API endpoint generates custom tokens for dashboard login", () => {
    const apiPath = path.join(root, "src/app/api/superadmin/users/impersonate/route.js");
    assert.ok(fs.existsSync(apiPath), "src/app/api/superadmin/users/impersonate/route.js must exist");

    const content = fs.readFileSync(apiPath, "utf-8");
    assert.ok(content.includes("export async function POST"), "Defines POST handler");
    assert.ok(content.includes("createCustomToken"), "Uses adminAuth.createCustomToken for instant user login");
    assert.ok(content.includes("isAuthorizedSuperAdmin"), "Protects impersonation with super admin check");
  });

  test("Setup Password page includes Full Name, prefilled email, and signs user into dashboard", () => {
    const pagePath = path.join(root, "src/app/(app)/(public)/setup-password/page.jsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    assert.ok(content.includes("fullName"), "Includes fullName state");
    assert.ok(content.includes("newPassword"), "Includes newPassword state");
    assert.ok(content.includes("confirmPassword"), "Includes confirmPassword state");
    assert.ok(content.includes("signInWithCustomToken"), "Signs in immediately with custom token");
  });
});

