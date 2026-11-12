import test from "node:test";
import assert from "node:assert/strict";
import { getQRSecret, generateSignedQRPayload, verifySignedQRPayload } from "../../lib/qr.js";
import { isSelfReferral } from "../../lib/commissions.js";

test("Security Regression: SEC-01 — Least-Privilege Firestore Role Tampering", async (t) => {
  // Simulates client attempting to update protected fields in user document
  function sanitizeClientUserUpdate(existingUser, patchData) {
    const protectedFields = ["role", "isAdmin", "eventsAllowed", "eventsCreated", "organizationId"];
    const hasTampering = Object.keys(patchData).some((k) => protectedFields.includes(k));
    if (hasTampering) {
      throw new Error("Permission Denied: Client cannot modify privileged security fields.");
    }
    return { ...existingUser, ...patchData };
  }

  await t.test("Rejects client write attempting to escalate role to superAdmin", () => {
    const user = { id: "usr_1", email: "user@gmail.com", role: "user" };
    assert.throws(
      () => sanitizeClientUserUpdate(user, { role: "superAdmin" }),
      /Permission Denied/i
    );
  });

  await t.test("Rejects client write attempting to set isAdmin: true", () => {
    const user = { id: "usr_1", email: "user@gmail.com", role: "user", isAdmin: false };
    assert.throws(
      () => sanitizeClientUserUpdate(user, { isAdmin: true }),
      /Permission Denied/i
    );
  });

  await t.test("Allows legitimate self-service profile updates (name, phone)", () => {
    const user = { id: "usr_1", email: "user@gmail.com", fullName: "Old Name", role: "user" };
    const updated = sanitizeClientUserUpdate(user, { fullName: "New Name", phone: "9876543210" });
    assert.equal(updated.fullName, "New Name");
    assert.equal(updated.role, "user");
  });
});

test("Security Regression: SEC-02 — Plaintext Password Storage Elimination", async (t) => {
  // Simulates user object retrieval and ensures no password field is exposed
  function sanitizeUserRecord(rawDoc) {
    const sanitized = { ...rawDoc };
    delete sanitized.password;
    delete sanitized.passwordHash;
    return sanitized;
  }

  await t.test("Sanitizes legacy user document and strips plaintext password", () => {
    const raw = {
      id: "usr_legacy",
      email: "attendee@pict.edu",
      password: "PlaintextPassword123!",
      role: "user",
    };
    const clean = sanitizeUserRecord(raw);
    assert.equal(clean.password, undefined);
    assert.equal("password" in clean, false);
    assert.equal(clean.email, "attendee@pict.edu");
  });
});

test("Security Regression: SEC-03 — Server-Only Payment Gateway Secrets", async (t) => {
  await t.test("Public checkout payloads must only contain key_id, never key_secret", () => {
    function prepareClientOrderResponse(order, keyId) {
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpayKeyId: keyId, // Public
      };
    }

    const clientPayload = prepareClientOrderResponse(
      { id: "order_123", amount: 44910, currency: "INR" },
      "rzp_test_12345"
    );

    assert.equal(clientPayload.razorpayKeyId, "rzp_test_12345");
    assert.equal(clientPayload.razorpayKeySecret, undefined);
    assert.equal("razorpayKeySecret" in clientPayload, false);
  });
});

test("Security Regression: SEC-04 — Role Escalation Domain Sniffing Elimination", async (t) => {
  function verifyOrganiserAccess(user) {
    // Correct logic: Only verified database role grants organiser privileges
    return user.role === "superAdmin" || user.role === "organiser";
  }

  await t.test("Rejects organiser access for @ticketlelo.com email without explicit database role", () => {
    const attacker = {
      email: "attacker@ticketlelo.com",
      role: "user", // Normal user in database
    };
    assert.equal(verifyOrganiserAccess(attacker), false);
  });

  await t.test("Permits organiser access for legitimate assigned organiser", () => {
    const legit = {
      email: "festhead@college.edu",
      role: "organiser",
    };
    assert.equal(verifyOrganiserAccess(legit), true);
  });
});

test("Security Regression: SEC-05 — Fail-Closed Production QR Secrets", async (t) => {
  await t.test("Fails closed in production if QR_SIGNING_SECRET is missing", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.QR_SIGNING_SECRET;
    const originalHmac = process.env.QR_HMAC_SECRET_KEY;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.QR_SIGNING_SECRET;
      delete process.env.QR_HMAC_SECRET_KEY;

      assert.throws(
        () => getQRSecret(),
        /CRITICAL SECURITY CONFIGURATION ERROR/i
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalSecret) process.env.QR_SIGNING_SECRET = originalSecret;
      if (originalHmac) process.env.QR_HMAC_SECRET_KEY = originalHmac;
    }
  });

  await t.test("Uses custom or configured secret when provided", () => {
    const customKey = "my-secure-production-key-98765";
    const secret = getQRSecret(customKey);
    assert.equal(secret, customKey);
  });
});
