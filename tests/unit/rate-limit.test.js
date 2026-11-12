import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimit, getClientIp } from "../../lib/rate-limit.js";

describe("Rate Limiting & Abuse Prevention (SEC-3, R82)", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  test("getClientIp correctly extracts leftmost IP from x-forwarded-for header", () => {
    const req = {
      headers: new Headers({
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      }),
    };
    const ip = getClientIp(req);
    assert.strictEqual(ip, "203.0.113.195");
  });

  test("getClientIp falls back to x-real-ip or 127.0.0.1", () => {
    const reqWithReal = {
      headers: new Headers({
        "x-real-ip": "198.51.100.22",
      }),
    };
    assert.strictEqual(getClientIp(reqWithReal), "198.51.100.22");

    const reqEmpty = { headers: new Headers() };
    assert.strictEqual(getClientIp(reqEmpty), "127.0.0.1");
  });

  test("Allows requests within limit and decrements remaining", () => {
    const key = "test:user:1";
    const res1 = checkRateLimit({ key, limit: 3, windowMs: 10000 });
    assert.strictEqual(res1.allowed, true);
    assert.strictEqual(res1.remaining, 2);
    assert.strictEqual(res1.count, 1);

    const res2 = checkRateLimit({ key, limit: 3, windowMs: 10000 });
    assert.strictEqual(res2.allowed, true);
    assert.strictEqual(res2.remaining, 1);
    assert.strictEqual(res2.count, 2);

    const res3 = checkRateLimit({ key, limit: 3, windowMs: 10000 });
    assert.strictEqual(res3.allowed, true);
    assert.strictEqual(res3.remaining, 0);
    assert.strictEqual(res3.count, 3);
  });

  test("Rejects request when limit is exceeded and provides retryAfterSeconds", () => {
    const key = "test:user:2";
    for (let i = 0; i < 5; i++) {
      checkRateLimit({ key, limit: 5, windowMs: 60000 });
    }

    const blocked = checkRateLimit({ key, limit: 5, windowMs: 60000 });
    assert.strictEqual(blocked.allowed, false);
    assert.strictEqual(blocked.remaining, 0);
    assert.ok(blocked.retryAfterSeconds > 0, "Provides positive retry delay");
  });

  test("Keys are isolated across different identifiers", () => {
    const resA = checkRateLimit({ key: "ip:1.1.1.1", limit: 1, windowMs: 10000 });
    assert.strictEqual(resA.allowed, true);

    const resABlocked = checkRateLimit({ key: "ip:1.1.1.1", limit: 1, windowMs: 10000 });
    assert.strictEqual(resABlocked.allowed, false);

    const resB = checkRateLimit({ key: "ip:2.2.2.2", limit: 1, windowMs: 10000 });
    assert.strictEqual(resB.allowed, true, "Different IP is allowed independently");
  });
});
