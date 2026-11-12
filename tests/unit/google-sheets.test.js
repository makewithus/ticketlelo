import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeCSVCell,
  generateFormResponsesCSV,
  mapRegistrationToSheetRow,
  syncRegistrationToGoogleSheet,
  isGoogleSheetsConfigured,
} from "../../lib/google-sheets.js";

test("Google Sheets & CSV Export Engine", async (t) => {
  await t.test("Sanitizes CSV cells to prevent formula injection attacks", () => {
    assert.equal(sanitizeCSVCell("=cmd|'/C calc'!A0"), "'=cmd|'/C calc'!A0");
    assert.equal(sanitizeCSVCell("+12345"), "'+12345");
    assert.equal(sanitizeCSVCell("-999"), "'-999");
    assert.equal(sanitizeCSVCell("@SUM(A1:A10)"), "'@SUM(A1:A10)");
    assert.equal(sanitizeCSVCell("Standard Text Value"), "Standard Text Value");
  });

  await t.test("Generates RFC 4180 compliant CSV with proper escaping and UTF-8 BOM", () => {
    const registrations = [
      {
        registrationId: "REG-001",
        orderId: "ORD-001",
        fullName: 'Sharma, "Rahul"',
        email: "rahul@pict.edu",
        whatsappPhone: "9876543210",
        ticketTier: "Tech Combo",
        amountPaid: 449.10,
        paymentStatus: "Paid",
        referralCode: "ADIL26",
        createdAt: "2027-03-01T10:00:00Z",
        responses: { github_url: "https://github.com/rahul", t_shirt_size: "L" },
      },
    ];

    const formFields = [
      { id: "github_url", label: "GitHub Profile URL" },
      { id: "t_shirt_size", label: "T-Shirt Size" },
    ];

    const csv = generateFormResponsesCSV(registrations, formFields);

    // Verify BOM
    assert.ok(csv.startsWith("\uFEFF"));
    // Verify Escaped Quotes
    assert.ok(csv.includes('"Sharma, ""Rahul"""'));
    // Verify custom fields
    assert.ok(csv.includes('"https://github.com/rahul"'));
    assert.ok(csv.includes('"L"'));
  });

  await t.test("Maps registration to structured Google Sheet row array", () => {
    const reg = {
      id: "REG-100",
      orderId: "ORD-500",
      fullName: "Ananya Roy",
      email: "ananya@college.edu",
      whatsappPhone: "9123456789",
      ticketType: "All-Access Pass",
      amountPaid: 999,
      paymentStatus: "Paid",
      referralCode: "DIRECT",
      responses: { college_year: "3rd Year" },
    };

    const formFields = [{ id: "college_year", label: "Year of Study" }];

    const row = mapRegistrationToSheetRow(reg, formFields);
    assert.equal(row[0], "REG-100");
    assert.equal(row[2], "Ananya Roy");
    assert.equal(row[3], "ananya@college.edu");
    assert.equal(row[6], 999);
    assert.equal(row[10], "3rd Year");
  });

  await t.test("Gracefully handles missing Google credentials without throwing", async () => {
    const reg = { id: "REG-TEST", fullName: "Test User" };
    // Call without env vars
    const res = await syncRegistrationToGoogleSheet(reg, [], {
      spreadsheetId: "",
      clientEmail: "",
      privateKey: "",
    });

    assert.equal(res.synced, false);
    assert.equal(res.requiresCredentials, true);
    assert.ok(res.message.includes("Google Sheets synchronization is paused"));
  });

  await t.test("Reports unimplemented API append even when credentials are provided", async () => {
    const reg = { id: "REG-SUCCESS", fullName: "Verified Attendee" };
    const res = await syncRegistrationToGoogleSheet(reg, [], {
      spreadsheetId: "test-sheet-id-12345",
      clientEmail: "service-account@gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----",
    });

    assert.equal(res.synced, false);
    assert.equal(res.requiresImplementation, true);
    assert.equal(res.requiresCredentials, false);
    assert.equal(res.spreadsheetId, "test-sheet-id-12345");
  });
});
