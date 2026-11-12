import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildTicketPassEmail } from "../../lib/email/templates/ticket-pass.js";

describe("Email URLs & Ticket Deck Proportions Verification", () => {
  const root = process.cwd();

  test("Ticket Pass Email template guarantees canonical https://ticketlelo.in links even if localhost is passed as base URL", () => {
    const { html, text } = buildTicketPassEmail({
      eventTitle: "Praroha Gaming",
      guestName: "Adil Khan",
      ticketId: "TKT-PRAROHA-001",
      venue: "Main Campus Arena",
      formattedDate: "Sat, 20 Nov 2026",
      formattedTime: "11:00 AM IST",
      tierName: "Gaming Pass",
      priceDisplay: "₹199",
      isFirstTimeUser: false,
      email: "adil4ticketlelo@gmail.com",
      emailBaseUrl: "http://localhost:3000",
      loginUrl: "http://localhost:3000/login?email=adil4ticketlelo%40gmail.com&redirect=/dashboard",
      setupPasswordUrl: "http://localhost:3000/setup-password?email=adil4ticketlelo%40gmail.com&token=abc",
    });

    // Zero localhost occurrences in the rendered HTML or text
    assert.strictEqual(html.includes("localhost"), false, "HTML must NOT contain any localhost URL");
    assert.strictEqual(text.includes("localhost"), false, "Plain text must NOT contain any localhost URL");

    // Must contain canonical ticketlelo.in links
    assert.ok(html.includes("https://ticketlelo.in/login?email=adil4ticketlelo%40gmail.com&redirect=/dashboard"));
    assert.ok(html.includes("https://ticketlelo.in/tickets/TKT-PRAROHA-001"));
  });

  test("Returning user who already has dashboard receives 'VIEW DASHBOARD' CTA", () => {
    const { html } = buildTicketPassEmail({
      eventTitle: "Praroha Gaming",
      guestName: "Adil Khan",
      ticketId: "TKT-PRAROHA-001",
      venue: "Main Campus Arena",
      formattedDate: "Sat, 20 Nov 2026",
      formattedTime: "11:00 AM IST",
      tierName: "Gaming Pass",
      priceDisplay: "₹199",
      isFirstTimeUser: false,
      email: "adil4ticketlelo@gmail.com",
    });

    assert.ok(html.includes("VIEW DASHBOARD"), "Must present VIEW DASHBOARD button to users who already have account");
    assert.ok(html.includes("/login?email=adil4ticketlelo%40gmail.com&redirect=/dashboard"), "Redirects to dashboard via login");
  });

  test("First-time guest user receives 'SET YOUR PASSWORD & VIEW TICKET' CTA", () => {
    const { html } = buildTicketPassEmail({
      eventTitle: "Praroha Gaming",
      guestName: "Guest Attendee",
      ticketId: "TKT-PRAROHA-002",
      venue: "Main Campus Arena",
      formattedDate: "Sat, 20 Nov 2026",
      formattedTime: "11:00 AM IST",
      tierName: "General",
      priceDisplay: "Free",
      isFirstTimeUser: true,
      email: "guest@example.com",
      setupPasswordUrl: "https://ticketlelo.in/setup-password?email=guest%40example.com&token=secure123",
    });

    assert.ok(html.includes("SET YOUR PASSWORD &amp; VIEW TICKET"), "Must present setup password button for first-time guests");
    assert.ok(html.includes("https://ticketlelo.in/setup-password?email=guest%40example.com&token=secure123"));
  });

  test("TicketDeckView uses calibrated compact spacing (68px default, max 72px on desktop) to prevent oversized zooming", () => {
    const deckViewPath = path.join(root, "components/tickets/ticket-deck-view.jsx");
    const deckContent = fs.readFileSync(deckViewPath, "utf-8");

    assert.ok(
      deckContent.includes("setSpacing(72)") || deckContent.includes("setSpacing(compact ? 22 : 68)"),
      "Spacing must be calibrated between 68px and 72px on desktop to match reference image"
    );
    assert.strictEqual(
      deckContent.includes("setSpacing(170)"),
      false,
      "Must not use oversized 170px spacing that blows out the viewport"
    );
  });

  test("TicketGraphic dimensions for deck view are calibrated to 460px-520px max width to fit comfortably on screen", () => {
    const graphicPath = path.join(root, "components/tickets/ticket-graphic.jsx");
    const graphicContent = fs.readFileSync(graphicPath, "utf-8");

    assert.ok(
      graphicContent.includes("xl:w-[500px]") || graphicContent.includes("lg:w-[480px]"),
      "Deck ticket must not exceed 520px in width on desktop"
    );
    assert.strictEqual(
      graphicContent.includes("xl:w-[780px]"),
      false,
      "Must not use oversized 780px width for non-horizontal deck view"
    );
  });

  test("Login page supports creating account with Full Name, Email, Password & Confirm Password when arriving from email", () => {
    const loginPagePath = path.join(root, "src/app/(app)/(public)/login/page.jsx");
    const loginContent = fs.readFileSync(loginPagePath, "utf-8");

    assert.ok(loginContent.includes("signup-confirm-password"), "Includes confirm password field in signup flow");
    assert.ok(loginContent.includes("Create Account & Go to Dashboard"), "Includes explicit dashboard creation CTA");
    assert.ok(loginContent.includes("isUserNotFound && initialEmail"), "Auto-transitions to signup if account does not exist");
  });
});
