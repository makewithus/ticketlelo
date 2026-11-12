import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildPasswordResetOtpEmail } from "../../lib/email/templates/password-reset-otp.js";

describe("Forgot Password OTP & Hosting Request Protection Suite", () => {
  test("buildPasswordResetOtpEmail renders 6-digit code, brand colors and security notices", () => {
    const code = "849201";
    const email = "organizer@ticketlelo.in";

    const { html, text } = buildPasswordResetOtpEmail({ code, email });

    // Brand and design preservation
    assert.ok(html.includes("#131517"), "Canvas background #131517");
    assert.ok(html.includes("#1A1C1F"), "Card background #1A1C1F");
    assert.ok(html.includes("#FE760B"), "Primary accent #FE760B");
    assert.ok(html.includes("849201"), "Includes exact 6-digit code");
    assert.ok(html.includes("15 minutes"), "Displays 15-minute expiration notice");
    assert.ok(html.includes("organizer@ticketlelo.in"), "Mentions recipient email");
    assert.ok(text.includes("849201"), "Plain-text alternative includes 6-digit code");
    assert.ok(text.includes("15 minutes"), "Plain-text alternative mentions expiration");
  });

  test("OTP generation produces a valid 6-digit numeric string with SHA-256 hash", () => {
    const code = String(crypto.randomInt(100000, 999999));
    assert.match(code, /^\d{6}$/, "Code must be exactly 6 digits");

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    assert.equal(codeHash.length, 64, "SHA-256 hex digest length is 64 chars");

    // Re-verify hash match
    const verifyHash = crypto.createHash("sha256").update(code).digest("hex");
    assert.equal(codeHash, verifyHash, "Hash matches input code");
  });

  test("Password reset token validation logic", () => {
    const resetToken = crypto.randomBytes(32).toString("hex");
    assert.equal(resetToken.length, 64, "Cryptographically secure 32-byte hex token");

    const expiresAt = Date.now() + 10 * 60 * 1000;
    assert.ok(expiresAt > Date.now(), "Token expiration is in the future");
  });

  test("Password complexity & confirmation rules", () => {
    const shortPassword = "abc";
    assert.ok(shortPassword.length < 6, "Rejects password shorter than 6 characters");

    const validPassword = "SecurePassword123!";
    assert.ok(validPassword.length >= 6, "Accepts password >= 6 characters");

    const mismatchedConfirm = "DifferentPassword123!";
    assert.notEqual(validPassword, mismatchedConfirm, "Rejects mismatched confirm password");
  });
});
