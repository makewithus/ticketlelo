import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildTicketPassEmail } from "../../lib/email/templates/ticket-pass.js";

describe("Email Template Security, Escaping & Cross-Client Compatibility (SEC-6, GAP-1, GAP-3, R19, R21, R34)", () => {
  test("Escapes all dynamic organizer and user inputs to prevent XSS (SEC-6, R34)", () => {
    const maliciousInput = {
      eventTitle: 'Hack Fest <script>alert("xss")</script>',
      guestName: 'Jane <img src=x onerror=alert(1)> Doe',
      ticketId: 'TKT-<marquee>test</marquee>',
      venue: 'Auditorium <b onmouseover="evil()">Hall</b>',
      formattedDate: '2026-12-01 <script>',
      formattedTime: '10:00 AM <svg/onload=alert(1)>',
      tierName: 'VIP <iframe src="javascript:alert(1)">',
      priceDisplay: '₹500 <img src=x>',
      isFirstTimeUser: true,
      setupPasswordUrl: "https://ticketlelo.in/setup-password?email=test%40example.com&token=abc",
      loginUrl: "https://ticketlelo.in/login?email=test%40example.com",
      email: "test@example.com",
    };

    const { html } = buildTicketPassEmail(maliciousInput);

    // Negative assertions: Unescaped tags must NOT be present
    assert.strictEqual(html.includes("<script>alert"), false, "Script tags must be escaped");
    assert.strictEqual(html.includes("<img src=x onerror"), false, "Image error handlers must be escaped");
    assert.strictEqual(html.includes("<marquee>"), false, "Marquee tags must be escaped");
    assert.strictEqual(html.includes('<b onmouseover="evil()">'), false, "Event handlers must be escaped");
    assert.strictEqual(html.includes("<svg/onload"), false, "SVG onload must be escaped");
    assert.strictEqual(html.includes("<iframe"), false, "Iframe tags must be escaped");

    // Positive assertions: Escaped entities must be present
    assert.ok(html.includes("&lt;script&gt;"), "Escapes <script>");
    assert.ok(html.includes("&lt;img"), "Escapes <img");
    assert.ok(html.includes("&lt;svg/onload"), "Escapes <svg");
  });

  test("Removes hardcoded fake demo defaults when data is missing (GAP-3, R25)", () => {
    const emptyData = {
      eventTitle: "",
      guestName: "",
      ticketId: "TKT-TEST-001",
      venue: "",
      formattedDate: "",
      formattedTime: "",
      isFirstTimeUser: true,
    };

    const { html, text } = buildTicketPassEmail(emptyData);

    // Must NOT have false event dates or venues
    assert.strictEqual(html.includes("Thu, 29 Oct 2026"), false, "Must not fabricate default fake event date");
    assert.strictEqual(html.includes("Main Auditorium, School of Engineering"), false, "Must not fabricate default fake venue");
    assert.strictEqual(text.includes("Thu, 29 Oct 2026"), false, "Plaintext must not fabricate default fake event date");

    // Must show truthful fallback text
    assert.ok(html.includes("Date to be announced") || html.includes("Venue details to be announced"), "Shows neutral fallback");
  });

  test("Includes MSO conditional comments for Outlook desktop client compatibility (GAP-1, R21)", () => {
    const { html } = buildTicketPassEmail({
      eventTitle: "Design Conference",
      guestName: "Alice",
      ticketId: "TKT-DC-01",
    });

    assert.ok(html.includes("<!--[if mso]>"), "Must include MSO conditional block");
    assert.ok(html.includes("xmlns:o=\"urn:schemas-microsoft-com:office:office\""), "Must include Office XML namespace");
    assert.ok(html.includes("<![endif]-->"), "Must close MSO conditional block");
  });

  test("Includes mobile responsive CSS media queries (GAP-1, R19)", () => {
    const { html } = buildTicketPassEmail({
      eventTitle: "Design Conference",
      guestName: "Alice",
      ticketId: "TKT-DC-01",
    });

    assert.ok(html.includes("@media screen and (max-width: 600px)"), "Must include mobile media query");
    assert.ok(html.includes(".email-container"), "Must style container fluidly on small screens");
  });
});
