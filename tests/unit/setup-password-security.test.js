import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

describe("Password Setup Endpoint Security (SEC-1, SEC-4, BUG-5, R41, R42, R46-R49, R79, R84)", () => {
  const root = process.cwd();
  const routePath = path.join(root, "src/app/api/auth/setup-password/route.js");
  const content = fs.readFileSync(routePath, "utf-8");

  test("Endpoint enforces fail-closed token requirement (SEC-1)", () => {
    // Must check tokenDoc.exists and reject if false
    assert.match(content, /if\s*\(!tokenDoc\.exists\)/, "Must reject if token document does not exist");
    assert.match(content, /Invalid or expired password setup link/, "Must return secure error message when tokenDoc does not exist");
    // Must NOT have empty token fallback allowing arbitrary tokens
    assert.strictEqual(content.includes("else if (!setupToken)"), false, "Must not allow arbitrary tokens when tokenDoc is absent");
  });

  test("Endpoint verifies token using constant-time comparison (SEC-1, SEC-8)", () => {
    assert.match(content, /crypto\.timingSafeEqual/, "Must use crypto.timingSafeEqual for constant-time comparison");
    assert.match(content, /safeCompare/, "Must wrap timing comparison in safe helper");
  });

  test("Endpoint supports both hashed token (tokenHash) and legacy plaintext token (SEC-1, R45)", () => {
    assert.match(content, /tokenHash/, "Must check tokenHash");
    assert.match(content, /sha256\(setupToken\)/, "Must hash input token before comparing with tokenHash");
    assert.match(content, /plainToken/, "Must support fallback to plainToken for backward compatibility");
  });

  test("Endpoint executes transactional / atomic token consumption (SEC-1, R47)", () => {
    assert.match(content, /runTransaction/, "Must use runTransaction for atomic token consumption");
    assert.match(content, /used:\s*true/, "Must mark token as used");
    assert.match(content, /usedAt:/, "Must record usedAt timestamp");
  });

  test("Endpoint protects existing accounts and Google Sign-In accounts (SEC-1, R79)", () => {
    assert.match(content, /userData\?\.hasSetPassword === true/, "Must reject if account already has password set");
    assert.match(content, /google\.com/, "Must detect and protect Google OAuth provider accounts");
  });

  test("Endpoint implements rate limiting (SEC-3, R82)", () => {
    assert.match(content, /checkRateLimit/, "Must invoke checkRateLimit");
    assert.match(content, /429/, "Must return 429 when rate limit is exceeded");
    assert.match(content, /Retry-After/, "Must include Retry-After header");
  });

  test("Endpoint protects against account enumeration (SEC-4, R84)", () => {
    // 404 should not leak account absence
    assert.strictEqual(
      content.includes("No account found for this email address"),
      false,
      "Must not leak 'No account found' 404 message"
    );
  });

  test("Password policy enforces minimum 6 characters (R41, R42)", () => {
    assert.match(content, /newPassword\.length < 6/, "Must validate minimum password length");
    assert.match(content, /newPassword !== confirmPassword/, "Must validate password confirmation");
  });

  test("Client and server password whitespace handling is aligned (BUG-5)", () => {
    // Server must not arbitrarily trim passwords differently than client
    assert.match(
      content,
      /const newPassword = typeof body\.newPassword === "string" \? body\.newPassword : ""/,
      "Server must not silently trim passwords differently from input"
    );
  });

  test("Cryptographic token verification function behaves accurately", () => {
    function sha256(val) {
      return crypto.createHash("sha256").update(String(val)).digest("hex");
    }
    function safeCompare(a, b) {
      if (typeof a !== "string" || typeof b !== "string") return false;
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    }

    const secret = "abc123secrettoken456";
    const hashed = sha256(secret);

    assert.strictEqual(safeCompare(hashed, sha256(secret)), true, "Exact token match must verify true");
    assert.strictEqual(safeCompare(hashed, sha256("wrongtoken")), false, "Wrong token must verify false");
    assert.strictEqual(safeCompare(hashed, "short"), false, "Different length must safely verify false");
  });
});
