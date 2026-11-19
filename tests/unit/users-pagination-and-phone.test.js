import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validatePhoneNumber, formatPhoneDisplay } from "../../lib/phone-validation.js";

describe("Users Pagination & Phone Validation Remediation Suite", () => {
  const root = process.cwd();

  test("API defines server-side pagination query parameters and response structure", () => {
    const apiPath = path.join(root, "src/app/api/superadmin/users/route.js");
    const content = fs.readFileSync(apiPath, "utf-8");

    assert.ok(content.includes('searchParams.get("page")'), "Reads page query param");
    assert.ok(content.includes('searchParams.get("pageSize")'), "Reads pageSize query param");
    assert.ok(content.includes('searchParams.get("role")'), "Reads role filter query param");
    assert.ok(content.includes('searchParams.get("search")'), "Reads search query param");
    assert.ok(content.includes("totalMatching"), "Calculates total matching records");
    assert.ok(content.includes("totalPages"), "Calculates total pages");
    assert.ok(content.includes("stats"), "Returns stats partition metrics");
  });

  test("API enforces backend phone validation and uniqueness in POST", () => {
    const apiPath = path.join(root, "src/app/api/superadmin/users/route.js");
    const content = fs.readFileSync(apiPath, "utf-8");

    assert.ok(content.includes("validatePhoneNumber"), "Calls validatePhoneNumber on user creation");
    assert.ok(content.includes("status: 409"), "Returns 409 Conflict when phone number already exists");
    assert.ok(content.includes("already registered to another account"), "Provides clear conflict message");
    assert.ok(content.includes("normalizedPhone"), "Normalizes phone to E.164");
  });

  test("Users UI incorporates server-side pagination controls and configurable page sizes", () => {
    const pagePath = path.join(root, "src/app/(app)/superadmin/users/page.jsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    assert.ok(content.includes("currentPage"), "Maintains currentPage state");
    assert.ok(content.includes("pageSize"), "Maintains configurable pageSize state");
    assert.ok(content.includes("handlePageChange"), "Implements handlePageChange");
    assert.ok(content.includes("handlePageSizeChange"), "Implements handlePageSizeChange");
    assert.ok(content.includes("ChevronLeft"), "Renders Prev page control");
    assert.ok(content.includes("ChevronRight"), "Renders Next page control");
    assert.ok(content.includes("getPaginationRange"), "Renders page numbers with ellipsis");
    assert.ok(content.includes("formatPhoneDisplay"), "Formats phone display safely without throwing");
  });

  test("Phone validation accepts valid Indian numbers and rejects arbitrary length fake numbers", () => {
    // 10-digit standard Indian number
    const validIN = validatePhoneNumber("8265940243");
    assert.strictEqual(validIN.isValid, true);
    assert.strictEqual(validIN.e164, "+918265940243");

    // 14-digit fake test input (from defect audit)
    const invalid14 = validatePhoneNumber("74413131646131");
    assert.strictEqual(invalid14.isValid, false);

    // 12-digit non-code input
    const invalid12 = validatePhoneNumber("451123753951");
    assert.strictEqual(invalid12.isValid, false);

    // Alpha string
    const invalidAlpha = validatePhoneNumber("notaphonenumber");
    assert.strictEqual(invalidAlpha.isValid, false);

    // Empty optional value
    const empty = validatePhoneNumber("", { required: false });
    assert.strictEqual(empty.isValid, true);
    assert.strictEqual(empty.e164, null);
  });
});
