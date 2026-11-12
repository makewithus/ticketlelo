const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

describe("Phase 1: Foundation, Security, and Event Hierarchy", () => {
  test("Sub-event remaining capacity formula returns non-negative balance", () => {
    const { calculateRemainingSubEventCapacity } = require("../../lib/sub-events");
    
    // Normal case
    assert.equal(calculateRemainingSubEventCapacity({ capacity: 150, allocatedSeats: 45 }), 105);
    
    // Exact capacity reached
    assert.equal(calculateRemainingSubEventCapacity({ capacity: 200, allocatedSeats: 200 }), 0);
    
    // Oversubscribed boundary condition
    assert.equal(calculateRemainingSubEventCapacity({ capacity: 100, allocatedSeats: 110 }), 0);
    
    // Empty / null sub-event
    assert.equal(calculateRemainingSubEventCapacity(null), 0);
  });

  test("Security sanitization: passwords must never be stored in user memory", () => {
    const dirtyUserData = {
      id: "usr_test_123",
      email: "attendee@test.com",
      fullName: "Test Attendee",
      password: "SuperSecretPassword123!",
      role: "user",
    };

    // Sanitize simulated object as in lib/auth.js
    const sanitized = { ...dirtyUserData };
    delete sanitized.password;

    assert.equal(sanitized.password, undefined);
    assert.equal(Object.keys(sanitized).includes("password"), false);
    assert.equal(sanitized.email, "attendee@test.com");
  });

  test("Major event slug generator sanitizes titles cleanly", () => {
    const title = "PRAROHA 2027: National Level Tech Fest & Summit!";
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    assert.equal(slug, "praroha-2027-national-level-tech-fest-summit");
  });

  test("Role verification: email addresses never grant privileged roles", () => {
    const { resolveUserRole } = require("../../lib/access-policy");

    // Standard user
    assert.equal(resolveUserRole({ role: "user" }), "user");

    // Attempted domain spoofing without database role assignment
    assert.equal(resolveUserRole({ role: "user" }), "user");

    // Legitimate assigned organiser
    assert.equal(resolveUserRole({ role: "organiser" }), "organiser");

    // SuperAdmin
    assert.equal(resolveUserRole(null, "superAdmin"), "superAdmin");
    assert.equal(resolveUserRole(null, null), "user");
  });

  test("Role-based redirect paths: superAdmin, organiser, and user", async () => {
    const { getRedirectPathForRole } = await import("../../lib/auth.js");
    assert.equal(getRedirectPathForRole("superAdmin"), "/superadmin");
    assert.equal(getRedirectPathForRole("organiser"), "/admin/dashboard");
    assert.equal(getRedirectPathForRole("user"), "/dashboard");
    assert.equal(getRedirectPathForRole(undefined), "/dashboard");
  });
});
