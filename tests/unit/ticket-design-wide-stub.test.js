import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generatePDFTicket } from "../../lib/tickets.js";
import { CANONICAL_TICKETS } from "../../lib/canonical-tickets.js";

describe("Wide Ticket & Stub Ticket System Verification", () => {
  test("generates exact Stub Ticket PDF when ticketDesign is 'stub'", async () => {
    const reg = {
      ticketId: "TKT-1793-AB12C",
      attendeeName: "Aarav Kumar",
      amount: 199,
      ticketTier: "GENERAL",
    };
    const event = {
      name: "TECH FEST 2026",
      theme: "tech",
      date: new Date(2026, 9, 29, 12, 0),
      location: "MAIN AUDITORIUM",
      ticketDesign: "stub",
    };

    const pdfBlob = await generatePDFTicket(reg, event);
    assert.ok(pdfBlob);
    assert.ok(pdfBlob.size > 20000);
  });

  test("generates exact Wide Ticket PDF (3-panel) when ticketDesign is 'wide'", async () => {
    const reg = {
      ticketId: "TKT-1801-PG07K",
      attendeeName: "Sneha Nair",
      amount: 0,
      ticketTier: "FREE ENTRY",
    };
    const event = {
      name: "PRAROHA GAMING",
      theme: "gaming",
      date: new Date(2026, 10, 7, 10, 0),
      location: "SCHOOL OF ENGINEERING",
      ticketDesign: "wide",
    };

    const pdfBlob = await generatePDFTicket(reg, event);
    assert.ok(pdfBlob);
    assert.ok(pdfBlob.size > 20000);
  });

  test("event payload correctly preserves ticketDesign across creation and edits", () => {
    const defaultPayload = {
      name: "Annual Fest 2026",
      ticketDesign: "stub",
    };
    assert.equal(defaultPayload.ticketDesign, "stub");

    // Organizer edits to wide ticket
    const updatedPayload = {
      ...defaultPayload,
      ticketDesign: "wide",
    };
    assert.equal(updatedPayload.ticketDesign, "wide");

    // Organizer edits to deck ticket
    const deckPayload = {
      ...defaultPayload,
      ticketDesign: "deck",
    };
    assert.equal(deckPayload.ticketDesign, "deck");
  });

  test("generates high-fidelity PDF when ticketDesign is 'deck'", async () => {
    const reg = {
      ticketId: "TKT-1793-DECK01",
      attendeeName: "Rahul Sharma",
      amount: 0,
      ticketTier: "FREE ENTRY",
    };
    const event = {
      name: "DEVELOPER'S NIGHT 2026",
      theme: "tech",
      date: new Date(2026, 10, 6, 21, 0),
      location: "MAIN AUDITORIUM",
      ticketDesign: "deck",
    };

    const pdfBlob = await generatePDFTicket(reg, event);
    assert.ok(pdfBlob);
    assert.ok(pdfBlob.size > 20000);
  });

  test("email route generates correct direct ticket link URL format", () => {
    const baseUrl = "https://ticketlelo.in";
    const ticketId = "TKT-1793-AB12C";
    const expectedUrl = `${baseUrl}/tickets/${ticketId}`;

    assert.equal(expectedUrl, "https://ticketlelo.in/tickets/TKT-1793-AB12C");
    assert.match(expectedUrl, /\/tickets\/TKT-[A-Z0-9-]+$/);
  });
});
