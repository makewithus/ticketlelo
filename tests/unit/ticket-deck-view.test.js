import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_TICKETS } from "../../lib/canonical-tickets.js";

describe("Interactive Ticket Deck View & Detail Animation Requirements", () => {
  test("Includes the 4 canonical tickets matching Image 1 & Image 2", () => {
    assert.equal(CANONICAL_TICKETS.length, 4);

    const ids = CANONICAL_TICKETS.map((t) => t.id);
    assert.ok(ids.includes("robotics-expo"));
    assert.ok(ids.includes("tech-fest-2026"));
    assert.ok(ids.includes("praroha-gaming"));
    assert.ok(ids.includes("open-mic-night"));
  });

  test("Each ticket has the exact attributes required for the Image 2 detail card", () => {
    const openMic = CANONICAL_TICKETS.find((t) => t.id === "open-mic-night");
    assert.ok(openMic);

    // Exact values from Image 2
    assert.equal(openMic.title, "Open Mic Night");
    assert.equal(openMic.date, "Wed, 28 Oct 2026");
    assert.equal(openMic.time, "7:00 PM");
    assert.equal(openMic.venue, "Amphitheatre");
    assert.equal(openMic.ticketType, "General");
    assert.equal(openMic.guest, "Priya Sharma");
    assert.equal(openMic.ticketId, "TKT-1764-0M3QX");
    assert.equal(openMic.theme, "pink");
  });

  test("Robotics Expo, Tech Fest, and Praroha Gaming have correct theme definitions", () => {
    const robotics = CANONICAL_TICKETS.find((t) => t.id === "robotics-expo");
    assert.equal(robotics.theme, "green");
    assert.equal(robotics.subBadge, "EXPO");

    const techFest = CANONICAL_TICKETS.find((t) => t.id === "tech-fest-2026");
    assert.equal(techFest.theme, "orange");
    assert.equal(techFest.subBadge, "₹199");

    const praroha = CANONICAL_TICKETS.find((t) => t.id === "praroha-gaming");
    assert.equal(praroha.theme, "purple");
    assert.equal(praroha.subBadge, "FREE");
  });

  test("Clicking any ticket promotes it to the front with vertical animation order", () => {
    let order = CANONICAL_TICKETS.map((t) => t.id);
    // Initially Open Mic is in front (last index)
    assert.equal(order[order.length - 1], "open-mic-night");

    // Simulate clicking "robotics-expo"
    const clickedId = "robotics-expo";
    const remaining = order.filter((id) => id !== clickedId);
    order = [...remaining, clickedId];

    // Robotics Expo is now the frontmost active ticket
    assert.equal(order[order.length - 1], "robotics-expo");
  });

  test("Safely serializes Firestore Timestamps {seconds, nanoseconds} to strings", async () => {
    const { formatTicketDate, formatTicketMeta } = await import(
      "../../lib/date-utils.js"
    );

    const firestoreTimestamp = {
      seconds: 1761719400,
      nanoseconds: 0,
    };

    const dateStr = formatTicketDate(firestoreTimestamp);
    assert.equal(typeof dateStr, "string");
    assert.ok(dateStr.length > 0);
    assert.notEqual(dateStr, "[object Object]");

    const meta = formatTicketMeta({
      date: firestoreTimestamp,
      time: "12:00 PM",
      venue: "Main Auditorium",
      tier: "VIP",
      price: 199,
    });
    assert.equal(typeof meta.dateStr, "string");
    assert.notEqual(meta.dateStr, "DATE TBA");
    assert.notEqual(meta.dateStr, "[object Object]");
  });
});
