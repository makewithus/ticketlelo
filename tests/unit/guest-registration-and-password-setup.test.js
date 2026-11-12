import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildTicketPassEmail } from "../../lib/email/templates/ticket-pass.js";

describe("Guest Registration & First-Time Password Setup Flow", () => {
  test("First-time guest user email includes 'SET YOUR PASSWORD & VIEW TICKET' CTA and no password reset phrasing", () => {
    const setupUrl = "https://ticketlelo.in/setup-password?email=rohit%40example.com&token=abc123token&ticketId=TKT-W3S-001";
    const loginUrl = "https://ticketlelo.in/login?email=rohit%40example.com&redirect=/dashboard";

    const { html, text } = buildTicketPassEmail({
      eventTitle: "Web3 Summit 2026",
      guestName: "Rohit Sharma",
      ticketId: "TKT-W3S-001",
      venue: "Convention Centre, New Delhi",
      formattedDate: "Sat, 14 Nov 2026",
      formattedTime: "09:00 AM - 06:00 PM IST",
      tierName: "General Access",
      priceDisplay: "Free",
      isFirstTimeUser: true,
      setupPasswordUrl: setupUrl,
      loginUrl: loginUrl,
      email: "rohit@example.com",
    });

    // Subject/preheader & greeting checks
    assert.ok(html.includes("You're Successfully Registered!"), "Includes heading");
    assert.ok(html.includes("Rohit"), "Greets first name");
    assert.ok(html.includes("Web3 Summit 2026"), "Includes event title");
    assert.ok(html.includes("TKT-W3S-001"), "Includes ticket ID");

    // First time setup CTA check
    assert.ok(html.includes("SET YOUR PASSWORD &amp; VIEW TICKET"), "Has primary first-time CTA button");
    assert.ok(html.includes(setupUrl), "Points to dedicated setup password link");
    assert.ok(html.includes("Since this is your first time using TicketLelo, you'll need to set up your password"), "Explains first-time context");

    // Negative check: Must NOT contain reset password terminology
    assert.strictEqual(html.toLowerCase().includes("reset your password"), false, "Must not mention reset your password");
    assert.strictEqual(text.toLowerCase().includes("reset your password"), false, "Plaintext must not mention reset your password");

    // Supporting message for returning user fallback
    assert.ok(html.includes("Already have a TicketLelo password?"), "Includes secondary login alternative");
  });

  test("Returning user email includes 'LOG IN TO VIEW YOUR TICKET' CTA", () => {
    const loginUrl = "https://ticketlelo.in/login?email=priya%40example.com&redirect=/dashboard";

    const { html, text } = buildTicketPassEmail({
      eventTitle: "AI Conference 2026",
      guestName: "Priya Patel",
      ticketId: "TKT-AIC-002",
      venue: "Tech Park Auditorium, Bengaluru",
      formattedDate: "Sun, 15 Nov 2026",
      formattedTime: "10:00 AM - 05:00 PM IST",
      tierName: "VIP Pass",
      priceDisplay: "₹999",
      isFirstTimeUser: false,
      loginUrl: loginUrl,
      email: "priya@example.com",
    });

    assert.ok(html.includes("VIEW DASHBOARD") || html.includes("LOG IN TO VIEW YOUR TICKET"), "Has returning user login button");
    assert.ok(html.includes(loginUrl), "Points to login with redirect to dashboard");
    assert.strictEqual(html.includes("SET YOUR PASSWORD &amp; VIEW TICKET"), false, "Does not ask returning user to set password for first time");
  });
});
