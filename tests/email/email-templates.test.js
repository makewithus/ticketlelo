import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildTicketPassEmail,
  buildApprovalEmail,
  buildRejectionEmail,
  buildHostingConfirmEmail,
  buildPasswordResetEmail,
  buildReminderEmail,
  buildAnnouncementEmail,
} from "../../lib/email/templates/index.js";

describe("Phase 5: Email Design & Brand Preservation Verification", () => {
  test("Ticket Pass Template preserves light theme, QR placement, and action links", () => {
    const { html, text } = buildTicketPassEmail({
      eventTitle: "PRAROHA 2027 Tech Fest",
      guestName: "Aarav Kumar",
      ticketId: "TKT-1793-TECHFEST",
      venue: "Auditorium Hall 1",
      formattedDate: "Fri, 30 Oct 2026",
      formattedTime: "10:00 AM - 4:00 PM IST",
      tierName: "VIP Pass",
      priceDisplay: "₹499",
      hasLogo: true,
      emailBaseUrl: "https://ticketlelo.in",
      mapsUrl: "https://maps.google.com/?q=Auditorium",
      calendarUrl: "https://calendar.google.com/render",
    });

    // Visual Branding Assertions (Light Theme per user specification)
    assert.ok(html.includes("#F1F5F9") || html.includes("#FFFFFF"), "Preserves clean light background canvas");
    assert.ok(html.includes("#FFFFFF"), "Preserves surface container #FFFFFF");
    assert.ok(html.includes("#FE760B"), "Preserves Ticket Orange accent #FE760B");
    assert.ok(html.includes("PRAROHA 2027 Tech Fest"), "Includes exact event title");
    assert.ok(html.includes("Aarav"), "Includes personalized greeting");
    assert.ok(html.includes("TKT-1793-TECHFEST"), "Includes pass ID");
    assert.ok(html.includes("ticketQr") || html.includes("qrserver.com") || html.includes("cid:ticketQrCode"), "Embeds scannable QR code image");
    assert.ok(html.includes("TicketLelo"), "Embeds branded TicketLelo logo or title");
    assert.ok(html.includes("https://ticketlelo.in/tickets/TKT-1793-TECHFEST"), "Direct pass browser URL");
    assert.ok(html.includes("https://maps.google.com/?q=Auditorium"), "Google Maps link");
    assert.ok(html.includes("https://calendar.google.com/render"), "Add to Calendar link");

    // Plain text alternative
    assert.ok(text.includes("TICKETLELO - YOUR TICKET"));
    assert.ok(text.includes("TKT-1793-TECHFEST"));
  });

  test("Approval Template preserves organizer access, green status pill, and dashboard CTA", () => {
    const { html, text } = buildApprovalEmail({
      name: "Adil Khan",
      recipientEmail: "adil@college.edu",
      eventTitle: "Inter-College Robotics 2026",
      hasLogo: true,
      emailBaseUrl: "https://ticketlelo.in",
    });

    assert.ok(html.includes("ORGANISER ACCESS"), "Includes Organiser Access badge");
    assert.ok(html.includes("Hosting request approved"), "Includes green approved status pill");
    assert.ok(html.includes("You&#39;re approved, Adil."), "Includes personalized title");
    assert.ok(html.includes("Inter-College Robotics 2026"), "Includes approved event name");
    assert.ok(html.includes("adil@college.edu"), "Includes sign-in email");
    assert.ok(html.includes("Access your organiser dashboard"), "Includes primary CTA copy");
    assert.ok(html.includes("/login?redirect="), "Links to login with redirect to dashboard");

    assert.ok(text.includes("You're approved, Adil."));
    assert.ok(text.includes("https://ticketlelo.in"));
  });

  test("Rejection Template preserves dark brown reason box and submit new request CTA", () => {
    const { html, text } = buildRejectionEmail({
      name: "Rohan Sharma",
      eventTitle: "Music Night 2026",
      rejectionReason: "Incomplete event schedule and missing faculty advisor authorization.",
      numberOfTickets: "500",
      college: "Engineering College",
      appUrl: "https://ticketlelo.in",
      hasLogo: true,
    });

    assert.ok(html.includes("REQUEST UPDATE"), "Includes Request Update headline");
    assert.ok(html.includes("#351E27"), "Preserves dark brown decline box #351E27");
    assert.ok(html.includes("#FFD60A"), "Preserves yellow header font #FFD60A");
    assert.ok(html.includes("Incomplete event schedule"), "Includes rejection reason");
    assert.ok(html.includes("SUBMIT NEW REQUEST"), "Includes CTA button");

    assert.ok(text.includes("REQUEST UPDATE - TicketLelo"));
    assert.ok(text.includes("Incomplete event schedule"));
  });

  test("Hosting Confirmation Template preserves review notification and event summary", () => {
    const { html, text } = buildHostingConfirmEmail({
      name: "Priya Patel",
      eventTitle: "Designathon 2026",
      college: "National Institute of Design",
      parsedTickets: "250",
      email: "priya@nid.edu",
      hasLogo: true,
    });

    assert.ok(html.includes("Hosting request received"), "Includes received pill");
    assert.ok(html.includes("Designathon 2026"), "Includes event title");
    assert.ok(html.includes("National Institute of Design"), "Includes college");
    assert.ok(html.includes("WHAT HAPPENS NEXT?"), "Includes next steps");

    assert.ok(text.includes("We've received your request, Priya."));
  });

  test("Password Reset Template preserves reset link button and security text", () => {
    const { html, text } = buildPasswordResetEmail({
      name: "Organizer",
      email: "organizer@ticketlelo.in",
      eventTitle: "Hackathon 2026",
      resetLink: "https://ticketlelo.in/reset-password?token=secure123",
    });

    assert.ok(html.includes("Reset your password"));
    assert.ok(html.includes("https://ticketlelo.in/reset-password?token=secure123"));
    assert.ok(html.includes("#FE760B"));

    assert.ok(text.includes("Reset your password here:"));
  });

  test("Reminder Template preserves urgency label and colors", () => {
    const { html: tomorrowHtml } = buildReminderEmail({
      recipientName: "Vikram",
      eventName: "Startup Summit",
      eventDate: "Tomorrow",
      eventTime: "9:00 AM",
      eventLocation: "Main Convention Center",
      ticketId: "TKT-SUMMIT-01",
      reminderLabel: "Tomorrow",
      urgencyColor: "#FF6A00",
    });

    assert.ok(tomorrowHtml.includes("Tomorrow"));
    assert.ok(tomorrowHtml.includes("#FF6A00"));

    const { html: twoHoursHtml } = buildReminderEmail({
      recipientName: "Vikram",
      eventName: "Startup Summit",
      eventDate: "Today",
      eventTime: "2:00 PM",
      eventLocation: "Main Convention Center",
      ticketId: "TKT-SUMMIT-01",
      reminderLabel: "In 2 Hours",
      urgencyColor: "#e53e3e",
    });

    assert.ok(twoHoursHtml.includes("In 2 Hours"));
    assert.ok(twoHoursHtml.includes("#e53e3e"));
  });

  test("Announcement Template preserves gradient header and content formatting", () => {
    const { html, text } = buildAnnouncementEmail({
      recipientName: "Sneha",
      title: "Venue Hall Update",
      content: "Please note that the workshop has moved to Room 402.",
      eventName: "AI Workshop",
    });

    assert.ok(html.includes("Venue Hall Update"));
    assert.ok(html.includes("Please note that the workshop has moved to Room 402."));
    assert.ok(text.includes("Venue Hall Update"));
  });
});
