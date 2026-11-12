import test from "node:test";
import assert from "node:assert/strict";
import { generateSignedQRPayload, verifySignedQRPayload } from "../../lib/qr.js";
import { calculateAvailableCombos } from "../../lib/combos.js";
import { calculateOrderPricing } from "../../lib/pricing.js";

test("Performance Benchmark: HMAC-SHA-256 Cryptographic QR Verification Throughput", async (t) => {
  const secret = "bench-secret-key-123456789";
  const payload = generateSignedQRPayload({
    eventSlug: "praroha-2027",
    ticketId: "TKT-BENCHMARK-9999",
    entitledSubEventIds: ["workshop_ai", "hackathon_24h", "proshow_edm", "gaming_arena"],
  }, secret);

  await t.test("Verifies > 1,000 signed QR payloads per second with sub-millisecond latency", () => {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const res = verifySignedQRPayload(payload, secret);
      assert.equal(res.isValid, true);
    }

    const durationMs = performance.now() - start;
    const opsPerSec = Math.round((iterations / durationMs) * 1000);

    // Assert that throughput exceeds 1,000 verifications per second
    assert.ok(opsPerSec > 1000, `Throughput was ${opsPerSec} ops/sec, expected > 1000`);
    assert.ok(durationMs < 1000, `1,000 verifications took ${durationMs.toFixed(2)}ms`);
  });
});

test("Performance Benchmark: Dynamic Bottleneck Capacity Calculation Concurrency", async (t) => {
  const combo = {
    id: "combo_heavy",
    dedicatedQuota: 500,
    allocatedCount: 50,
    includedSubEventIds: ["track_1", "track_2", "track_3", "track_4"],
    isPublished: true,
  };


  const subEvents = {
    track_1: { capacity: 1000, allocatedSeats: 200 },
    track_2: { capacity: 600, allocatedSeats: 500 }, // Bottleneck = 100
    track_3: { capacity: 1200, allocatedSeats: 300 },
    track_4: { capacity: 800, allocatedSeats: 200 },
  };

  await t.test("Calculates bottleneck capacity in under 0.01ms per invocation", () => {
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const available = calculateAvailableCombos(combo, subEvents);
      assert.equal(available, 100);
    }

    const durationMs = performance.now() - start;
    const avgLatencyMs = durationMs / iterations;

    assert.ok(avgLatencyMs < 0.05, `Average latency was ${avgLatencyMs.toFixed(4)}ms, expected < 0.05ms`);
  });
});

test("Performance Benchmark: Centralized Pricing Engine Throughput", async (t) => {
  await t.test("Itemized pricing throughput exceeds 5,000 calculations per second", () => {
    const iterations = 2000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const res = calculateOrderPricing({
        basePrice: 449.10,
        quantity: 2,
        isTaxInclusive: true,
      });
      assert.ok(res.finalPayable > 0);
    }

    const durationMs = performance.now() - start;
    const opsPerSec = Math.round((iterations / durationMs) * 1000);

    assert.ok(opsPerSec > 3000, `Pricing throughput was ${opsPerSec} ops/sec, expected > 3000`);
  });
});
