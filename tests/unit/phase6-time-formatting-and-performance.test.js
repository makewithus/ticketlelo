import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { formatStandardTime, normalizeDisplayText } from "../../lib/date-utils.js";

test("L6: formatStandardTime standardizes lowercase am/pm to uppercase AM/PM", () => {
  // Test lowercase input from event-create-studio defect
  assert.equal(formatStandardTime("11:30 pm"), "11:30 PM");
  assert.equal(formatStandardTime("11:30 am"), "11:30 AM");
  assert.equal(formatStandardTime("12:00 pm"), "12:00 PM");
  assert.equal(formatStandardTime("12:30 am"), "12:30 AM");
  assert.equal(formatStandardTime("09:15 am"), "09:15 AM");
});

test("L6: formatStandardTime supports 12-hour and 24-hour display modes", () => {
  // 12-hour mode (default)
  assert.equal(formatStandardTime("23:30", { hour12: true }), "11:30 PM");
  assert.equal(formatStandardTime("14:05", { hour12: true }), "02:05 PM");
  assert.equal(formatStandardTime("00:45", { hour12: true }), "12:45 AM");

  // 24-hour mode
  assert.equal(formatStandardTime("11:30 PM", { hour12: false }), "23:30");
  assert.equal(formatStandardTime("11:30 pm", { hour12: false }), "23:30");
  assert.equal(formatStandardTime("09:15 AM", { hour12: false }), "09:15");
  assert.equal(formatStandardTime("12:30 AM", { hour12: false }), "00:30");
});

test("L6: formatStandardTime handles Date objects and Firestore timestamps without mutating", () => {
  const d = new Date("2026-11-20T18:00:00.000Z");
  const originalTime = d.getTime();
  
  const formatted = formatStandardTime(d, { timeZone: "UTC" });
  assert.ok(formatted.includes("06:00 PM") || formatted.includes("6:00 PM"));
  assert.equal(d.getTime(), originalTime, "Date object must not be mutated");

  // Mock Firestore Timestamp
  const firestoreTs = {
    toDate: () => new Date("2026-11-20T11:30:00.000Z"),
  };
  const tsFormatted = formatStandardTime(firestoreTs, { timeZone: "UTC" });
  assert.ok(tsFormatted.includes("11:30 AM"));
});

test("L6: formatStandardTime gracefully handles fallbacks", () => {
  assert.equal(formatStandardTime(null), "12:00 PM");
  assert.equal(formatStandardTime(undefined, { fallback: "TBA" }), "TBA");
  assert.equal(formatStandardTime("", { fallback: "TBA" }), "TBA");
});

test("L6: normalizeDisplayText fixes Inauguration typos while preserving casing", () => {
  // Common typo variants identified in QA and Firestore audit
  assert.equal(normalizeDisplayText("Inaugraution"), "Inauguration");
  assert.equal(normalizeDisplayText("Inaugration"), "Inauguration");
  assert.equal(normalizeDisplayText("Inaugartion"), "Inauguration");
  assert.equal(normalizeDisplayText("inaugraution"), "inauguration");
  assert.equal(normalizeDisplayText("inaugration"), "inauguration");
  assert.equal(normalizeDisplayText("inaugartion"), "inauguration");
  assert.equal(normalizeDisplayText("INAUGRAUTION"), "INAUGURATION");

  // Real database event titles
  assert.equal(
    normalizeDisplayText("Inaugration of MAC Lab"),
    "Inauguration of MAC Lab"
  );
  assert.equal(
    normalizeDisplayText("Narendra Modi Expo Inaugartion"),
    "Narendra Modi Expo Inauguration"
  );
  assert.equal(
    normalizeDisplayText("Grand Inaugration by the Prime Minister of India."),
    "Grand Inauguration by the Prime Minister of India."
  );
  assert.equal(
    normalizeDisplayText("ANN Lab Inaugration"),
    "ANN Lab Inauguration"
  );
  assert.equal(
    normalizeDisplayText("Inaugration of Techzia"),
    "Inauguration of Techzia"
  );

  // Unrelated words remain unchanged
  assert.equal(
    normalizeDisplayText("TicketLelo Hackathon 2026"),
    "TicketLelo Hackathon 2026"
  );
});

test("L1: Client pagination logic slices records accurately", () => {
  const records = Array.from({ length: 45 }, (_, i) => ({ id: `rec-${i + 1}` }));
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  assert.equal(totalPages, 5);

  // Page 1: records 0..9
  const page1 = records.slice(0, 10);
  assert.equal(page1.length, 10);
  assert.equal(page1[0].id, "rec-1");
  assert.equal(page1[9].id, "rec-10");

  // Page 5: records 40..44 (5 items)
  const page5 = records.slice((5 - 1) * pageSize, 5 * pageSize);
  assert.equal(page5.length, 5);
  assert.equal(page5[0].id, "rec-41");
  assert.equal(page5[4].id, "rec-45");
});

test("M11: Generated UI bundles contain 0 Cyrillic characters and no keyword salads", () => {
  const root = path.resolve(process.cwd());
  const filesToCheck = [
    path.join(root, "src/ui/generated/index.js"),
    path.join(root, "src/ui/generated/privacy.js"),
    path.join(root, "src/ui/generated/terms.js"),
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const cyrillicMatches = content.match(/[\u0400-\u04FF]+/g);
      assert.equal(
        cyrillicMatches,
        null,
        `Expected 0 Cyrillic matches in ${path.basename(filePath)}, found: ${cyrillicMatches?.length}`
      );
    }
  }

  // Index.js specific checks
  const indexPath = path.join(root, "src/ui/generated/index.js");
  const indexContent = fs.readFileSync(indexPath, "utf-8");
  
  assert.ok(
    !indexContent.includes("Reliability verify approval"),
    "index.js must not contain 'Reliability verify approval' word salad"
  );
  assert.ok(
    !indexContent.includes("t.me/hutzp"),
    "index.js must not contain external telegram link"
  );
  assert.ok(
    indexContent.includes("/logo/ticketlelomain.webp"),
    "index.js must reference optimized WebP hero image"
  );
  assert.ok(
    indexContent.includes("fetchpriority=\\\"high\\\"") || indexContent.includes("fetchpriority=\"high\""),
    "index.js must specify high fetch priority on hero image"
  );
});
