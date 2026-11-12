import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sanitizeForFirestore } from "../../lib/firestore.js";
import { sanitizeAndOffloadImages, MAX_FIRESTORE_DOC_BYTES, SAFE_DOC_BYTE_BUDGET } from "../../lib/server-image-storage.js";

describe("Instant Event Creation Optimization Suite", () => {
  it("sanitizeForFirestore correctly strips undefined fields while preserving dates and values", () => {
    const testDate = new Date();
    const rawData = {
      name: "Super Fast Tech Summit",
      capacity: 100,
      undefinedField: undefined,
      nested: {
        validKey: "ticket",
        badKey: undefined,
      },
      date: testDate,
      tags: ["tech", "summit", undefined],
    };

    const clean = sanitizeForFirestore(rawData);
    assert.equal(clean.name, "Super Fast Tech Summit");
    assert.equal(clean.capacity, 100);
    assert.equal(clean.undefinedField, undefined);
    assert.ok(!("undefinedField" in clean), "clean object must not contain undefined keys");
    assert.equal(clean.nested.validKey, "ticket");
    assert.ok(!("badKey" in clean.nested), "nested undefined key must be stripped");
    assert.equal(clean.date, testDate, "Date object must be preserved untouched");
    assert.deepEqual(clean.tags, ["tech", "summit"], "Array with undefined elements must have undefined removed");
  });

  it("lib/firestore.js implements non-blocking user stats update and fast timeout race", () => {
    const firestoreLibPath = path.resolve(process.cwd(), "lib/firestore.js");
    const content = fs.readFileSync(firestoreLibPath, "utf-8");

    // Extract createEvent implementation block
    const createEventBlock = content.slice(content.indexOf("export const createEvent"), content.indexOf("export const getEvent"));

    // Non-blocking increment
    assert.match(createEventBlock, /increment\(1\)/, "createEvent must use increment(1) for atomic user stats");
    assert.match(createEventBlock, /eventsCreated:\s*increment\(1\)/, "createEvent must increment eventsCreated");
    assert.doesNotMatch(createEventBlock, /await\s+getDoc\(userRef\)/, "createEvent must NOT await getDoc for user stats");

    // Client write timeout race
    assert.match(createEventBlock, /Promise\.race/, "createEvent must race client write with a timeout");
    assert.match(createEventBlock, /Firestore client write timeout/, "Timeout message must indicate client write timeout");

    // Sanitization
    assert.match(createEventBlock, /sanitizeForFirestore/, "createEvent must use sanitizeForFirestore");
  });

  it("API /api/events/create executes concurrent Firestore writes and supports client ID reuse", () => {
    const apiRoutePath = path.resolve(process.cwd(), "src/app/api/events/create/route.js");
    const content = fs.readFileSync(apiRoutePath, "utf-8");

    // Parallel execution with Promise.all
    assert.match(content, /Promise\.all\(writes\)/, "API must run document set and counter increment concurrently via Promise.all");
    assert.match(content, /admin\.firestore\.FieldValue\.increment\(1\)/, "API must atomically increment eventsCreated via FieldValue");

    // Support client ID reuse
    assert.match(content, /adminDb\.collection\("events"\)\.doc\(sanitized\.id\)/, "API must reuse client-generated document id when available");

    // Creator aliases
    assert.match(content, /createdBy:\s*creatorId/, "Must set createdBy");
    assert.match(content, /userId:\s*creatorId/, "Must set userId");
    assert.match(content, /organiserId:\s*creatorId/, "Must set organiserId");
    assert.match(content, /organizerId:\s*creatorId/, "Must set organizerId");
  });

  it("event-create-studio includes client-side canvas image compression and instant prefetching", () => {
    const studioPath = path.resolve(process.cwd(), "components/admin/event-create-studio.jsx");
    const content = fs.readFileSync(studioPath, "utf-8");

    // Canvas compression
    assert.match(content, /compressImageFile/, "Studio must include compressImageFile helper");
    assert.match(content, /toDataURL\("image\/webp"/, "Compression should prefer modern WebP format");
    assert.match(content, /router\.prefetch\("\/admin\/overview"\)/, "Must prefetch /admin/overview for 0ms transitions");
    assert.match(content, /admin_last_created_event/, "Must cache newly created event in sessionStorage for 0ms overview hydration");
    assert.match(content, /admin_cached_event_/, "Must cache newly created event in localStorage");
  });

  it("admin/overview page supports 0ms optimistic cache hydration on new event creation", () => {
    const overviewPath = path.resolve(process.cwd(), "src/app/(app)/admin/overview/page.jsx");
    const content = fs.readFileSync(overviewPath, "utf-8");

    assert.match(content, /admin_last_created_event/, "Overview must check admin_last_created_event for instant hydration");
    assert.match(content, /admin_cached_event_/, "Overview must check admin_cached_event_ for instant hydration");
    assert.match(content, /setLoading\(false\)/, "Overview must bypass loading state when cached event is found");
  });

  it("prevents creating events with dates that have already passed (client & server)", () => {
    const studioPath = path.resolve(process.cwd(), "components/admin/event-create-studio.jsx");
    const studioContent = fs.readFileSync(studioPath, "utf-8");

    const firestoreLibPath = path.resolve(process.cwd(), "lib/firestore.js");
    const libContent = fs.readFileSync(firestoreLibPath, "utf-8");

    const apiRoutePath = path.resolve(process.cwd(), "src/app/api/events/create/route.js");
    const apiContent = fs.readFileSync(apiRoutePath, "utf-8");

    // Studio calendar and submit validation
    assert.match(studioContent, /minDate=\{getTodayStr\(\)\}/, "Start calendar must enforce minDate as today");
    assert.match(studioContent, /minDate=\{formData\.startDate/, "End calendar must enforce minDate as startDate");
    assert.match(studioContent, /formData\.startDate < todayStr/, "handleFormSubmit must reject past start dates");
    assert.match(studioContent, /formData\.endDate < formData\.startDate/, "handleFormSubmit must reject end dates before start dates");
    assert.match(studioContent, /Event date cannot be in the past/, "Must display clear toast error for past dates");
    assert.doesNotMatch(studioContent, /startDate:\s*"2026-11-02"/, "Must NOT default to past date 2026-11-02");

    // lib/firestore.js createEvent validation
    assert.match(libContent, /startStr < todayStr/, "lib/firestore.js createEvent must validate against past dates");
    assert.match(libContent, /Event date cannot be in the past/, "lib/firestore.js must throw meaningful error on past dates");

    // Server API route validation
    assert.match(apiContent, /startStr < todayStr/, "Server API must reject past dates");
    assert.match(apiContent, /status:\s*400/, "Server API must return 400 for past dates");
    assert.match(apiContent, /Event date cannot be in the past/, "Server API must return clear error message for past dates");
  });

  it("prevents Firestore 1MB document limit error (1,048,576 bytes) via image offloading and size sanitization", async () => {
    // 1. Simulate a large 1.8MB payload (as shown in production error screenshot: 1,827,972 bytes)
    const giantBase64 = "data:image/jpeg;base64," + "A".repeat(900000);
    const oversizedPayload = {
      name: "Megaball 2026 Concert",
      slug: "megaball-2026-concert",
      coverImage: giantBase64,
      ticketBgUrl: giantBase64,
      ticketBackground: giantBase64,
      description: "Huge concert event with high resolution graphics",
      capacity: 500,
    };

    const rawSize = JSON.stringify(oversizedPayload).length;
    assert.ok(rawSize > MAX_FIRESTORE_DOC_BYTES, `Simulated raw payload size (${rawSize}) must exceed 1MB limit`);

    // Sanitize and offload
    const safePayload = await sanitizeAndOffloadImages(oversizedPayload, "test-event-123");
    const sanitizedSize = JSON.stringify(safePayload).length;

    assert.ok(
      sanitizedSize <= MAX_FIRESTORE_DOC_BYTES,
      `Sanitized document size (${sanitizedSize}) must be under 1MB Firestore limit (${MAX_FIRESTORE_DOC_BYTES})`
    );
    assert.ok(
      sanitizedSize <= SAFE_DOC_BYTE_BUDGET,
      `Sanitized document size (${sanitizedSize}) should be under safe budget (${SAFE_DOC_BYTE_BUDGET})`
    );

    // Verify duplicate ticketBackground is not stored when base64 is present
    assert.ok(
      !safePayload.ticketBackground || safePayload.ticketBackground.startsWith("http"),
      "ticketBackground must not duplicate giant base64"
    );

    // 2. Verify lib/firestore.js routes base64 images to server to avoid client 1MB limit
    const firestoreLibPath = path.resolve(process.cwd(), "lib/firestore.js");
    const libContent = fs.readFileSync(firestoreLibPath, "utf-8");
    assert.match(libContent, /hasInlineBase64Image/, "firestore.js must detect inline base64 images");
    assert.match(libContent, /!hasInlineBase64Image/, "firestore.js must bypass client setDoc when inline base64 is present");

    // 3. Verify server API routes call sanitizeAndOffloadImages
    const apiRoutePath = path.resolve(process.cwd(), "src/app/api/events/create/route.js");
    const apiContent = fs.readFileSync(apiRoutePath, "utf-8");
    assert.match(apiContent, /sanitizeAndOffloadImages/, "API /api/events/create must call sanitizeAndOffloadImages");

    const patchRoutePath = path.resolve(process.cwd(), "src/app/api/events/[eventId]/route.js");
    const patchContent = fs.readFileSync(patchRoutePath, "utf-8");
    assert.match(patchContent, /sanitizeAndOffloadImages/, "API /api/events/[eventId] must call sanitizeAndOffloadImages");

    // 4. Verify event-create-studio enforces max characters on compression
    const studioPath = path.resolve(process.cwd(), "components/admin/event-create-studio.jsx");
    const studioContent = fs.readFileSync(studioPath, "utf-8");
    assert.match(studioContent, /MAX_ALLOWED_CHARS/, "Studio must set MAX_ALLOWED_CHARS for image budget");
    assert.match(studioContent, /ticketBackground:\s*formData\.ticketBgUrl\?\.startsWith\("data:"\)/, "Studio must avoid base64 duplication in ticketBackground");
  });
});
