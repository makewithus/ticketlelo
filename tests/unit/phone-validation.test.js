import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validatePhoneNumber, formatPhoneDisplay } from "../../lib/phone-validation.js";

describe("Phone Number Validation & Formatting Suite", () => {
  test("Valid 10-digit Indian numbers are normalized to E.164 and international format", () => {
    const res = validatePhoneNumber("9876543210");
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.e164, "+919876543210");
    assert.strictEqual(res.international, "+91 98765 43210");
    assert.strictEqual(res.country, "IN");
  });

  test("Valid +91 numbers with formatting are accepted", () => {
    const res = validatePhoneNumber("+91 98765 43210");
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.e164, "+919876543210");
  });

  test("Valid international numbers (e.g. US, UK) are parsed correctly", () => {
    const usRes = validatePhoneNumber("+1 415 555 2671");
    assert.strictEqual(usRes.isValid, true);
    assert.strictEqual(usRes.e164, "+14155552671");
    assert.strictEqual(usRes.country, "US");

    const ukRes = validatePhoneNumber("+44 20 7183 8750");
    assert.strictEqual(ukRes.isValid, true);
    assert.strictEqual(ukRes.country, "GB");
  });

  test("Invalid arbitrary length numbers (12-digit, 14-digit non-standard) are rejected", () => {
    // 14-digit fake number like 74413131646131
    const res14 = validatePhoneNumber("74413131646131");
    assert.strictEqual(res14.isValid, false);
    assert.ok(res14.error);

    // 13-digit fake number like 4646461616166
    const res13 = validatePhoneNumber("4646461616166");
    assert.strictEqual(res13.isValid, false);
  });

  test("Alphabetic characters and arbitrary text are rejected", () => {
    const res = validatePhoneNumber("98765abcde");
    assert.strictEqual(res.isValid, false);
    assert.ok(res.error.includes("alphabetic"));
  });

  test("Empty values are accepted when optional, rejected when required", () => {
    const optRes = validatePhoneNumber("", { required: false });
    assert.strictEqual(optRes.isValid, true);
    assert.strictEqual(optRes.isProvided, false);
    assert.strictEqual(optRes.e164, null);

    const reqRes = validatePhoneNumber("", { required: true });
    assert.strictEqual(reqRes.isValid, false);
    assert.ok(reqRes.error.includes("required"));
  });

  test("formatPhoneDisplay formats valid numbers and safely handles legacy malformed records", () => {
    assert.strictEqual(formatPhoneDisplay("+919876543210"), "+91 98765 43210");
    assert.strictEqual(formatPhoneDisplay("9876543210"), "+91 98765 43210");
    assert.strictEqual(formatPhoneDisplay(""), "—");
    assert.strictEqual(formatPhoneDisplay(null), "—");

    // Historical 14-digit malformed record returns without throwing
    assert.strictEqual(formatPhoneDisplay("74413131646131"), "74413131646131");
  });
});
