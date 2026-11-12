import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Send Ticket Email Endpoint Security (SEC-7, SEC-3, R31, BUG-2)", () => {
  const root = process.cwd();
  const routePath = path.join(root, "src/app/api/send-ticket-email/route.js");
  const content = fs.readFileSync(routePath, "utf-8");

  test("Endpoint requires authentication for client resends (SEC-7)", () => {
    assert.match(content, /const caller = await getAuthenticatedUser\(request\)/, "Must extract authenticated caller");
    assert.match(content, /if\s*\(!caller\)/, "Must check for missing caller");
    assert.match(content, /status:\s*401/, "Must return 401 when anonymous user requests resend");
  });

  test("Endpoint enforces rate limiting on resend requests (SEC-3, R82)", () => {
    assert.match(content, /checkRateLimit/, "Must call checkRateLimit");
    assert.match(content, /resend_email_ip:/, "Must scope rate limit by IP");
    assert.match(content, /status:\s*429/, "Must return 429 when throttled");
  });

  test("Endpoint verifies ticket ownership or organizer/admin role (SEC-7)", () => {
    assert.match(content, /isOwner/, "Must verify caller is owner");
    assert.match(content, /canManageEventId/, "Must check if organizer can manage event");
    assert.match(content, /caller\.role === "superAdmin"/, "Must permit superAdmin");
    assert.match(content, /status:\s*403/, "Must return 403 on unauthorized resend attempt");
  });

  test("Helper reuses existing unexpired setup token without overwriting (BUG-2, R31)", () => {
    assert.match(content, /existingTokenDoc\.exists/, "Must check for existing setup token");
    assert.match(content, /existingTokenDoc\.data\(\)\.used !== true/, "Must check that existing token is not used");
    assert.match(content, /Number\(existingTokenDoc\.data\(\)\.expiresAt\) > Date\.now\(\)/, "Must check that token is unexpired");
    assert.match(content, /finalSetupToken = existingTokenDoc\.data\(\)\.token/, "Must reuse token value without rotating");
  });

  test("Removes hardcoded fake demo fallbacks (GAP-3)", () => {
    assert.strictEqual(
      content.includes('"Tech Fest 2026"'),
      false,
      "Must not fall back to 'Tech Fest 2026'"
    );
    assert.strictEqual(
      content.includes('"Main Auditorium, School of Engineering"'),
      false,
      "Must not fall back to 'Main Auditorium, School of Engineering'"
    );
    assert.strictEqual(
      content.includes('"Thu, 29 Oct 2026"'),
      false,
      "Must not fall back to 'Thu, 29 Oct 2026'"
    );
  });
});
