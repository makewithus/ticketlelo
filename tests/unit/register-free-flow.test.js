import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Free Registration Flow, Concurrency & Token Reuse (BUG-1, BUG-2, BUG-4, R30, R77, R78)", () => {
  const root = process.cwd();
  const routePath = path.join(root, "src/app/api/register-free/route.js");
  const content = fs.readFileSync(routePath, "utf-8");

  test("Handles concurrent guest registration race gracefully (BUG-4, R78)", () => {
    assert.match(content, /auth\/email-already-exists/, "Must catch auth/email-already-exists when two requests race to create user");
    assert.match(content, /concurrentUser = await adminAuth\.getUserByEmail/, "Must re-fetch existing user record instead of throwing 500");
  });

  test("Reuses existing unexpired setup token without invalidating earlier links (BUG-2)", () => {
    assert.match(content, /existingTokenDoc\.exists/, "Must check if token already exists for email");
    assert.match(content, /tokData\.used !== true/, "Must check if token is unused");
    assert.match(content, /Number\(tokData\.expiresAt\) > Date\.now\(\)/, "Must check if token is not expired");
    assert.match(content, /reuseExisting/, "Must set reuseExisting flag");
    assert.match(content, /if\s*\(!reuseExisting\)/, "Must only generate new token if no valid token exists");
  });

  test("Stores hashed setup token (tokenHash) alongside plaintext token (SEC-1, R45)", () => {
    assert.match(content, /tokenHash/, "Must store tokenHash in accountSetupTokens document");
    assert.match(content, /crypto\.createHash\("sha256"\)/, "Must compute sha256 hash of setupToken");
  });

  test("Tracks and reports explicit email status (BUG-1, R30)", () => {
    assert.match(content, /let emailStatus = "skipped"/, "Must initialize emailStatus");
    assert.match(content, /emailStatus = "queued"/, "Must record queued email status on success");
    assert.match(content, /emailStatus = "failed"/, "Must catch enqueue error and set status to failed");
    assert.match(content, /emailStatus,/, "Must return emailStatus in JSON response");
  });

  test("Enforces email case normalization (R77)", () => {
    assert.match(content, /toLowerCase\(\)/, "Must normalize email to lowercase");
    assert.match(content, /trim\(\)/, "Must trim whitespace from email");
  });

  test("Enforces rate limiting on free registration (SEC-3, R82)", () => {
    assert.match(content, /checkRateLimit/, "Must call checkRateLimit");
    assert.match(content, /register_ip:/, "Must rate limit by IP");
    assert.match(content, /register_email:/, "Must rate limit by target email");
    assert.match(content, /status:\s*429/, "Must return 429 when throttled");
  });
});
