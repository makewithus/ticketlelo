import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { generatePDFTicket } from "@/lib/tickets";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { parseFirestoreDate } from "@/lib/date-utils";
import { enqueueEmail } from "@/lib/email/queue";
import { buildTicketPassEmail } from "@/lib/email/templates/ticket-pass";
import { EmailPriority, EmailType } from "@/lib/email/types";
import { getEmailConfig } from "@/lib/email/config";

function getEmailBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://ticketlelo.in";
}

function formatDateDisplay(rawDate) {
  if (!rawDate) return "Thu, 29 Oct 2026";
  const d = parseFirestoreDate(rawDate);
  if (d && !isNaN(d.getTime())) {
    try {
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(rawDate);
    }
  }
  return typeof rawDate === "string" ? rawDate : "Thu, 29 Oct 2026";
}

/**
 * API Route: Generate PDF ticket and queue delivery via Resend
 * POST /api/send-ticket-email
 * Body: { ticketId }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { ticketId } = body;
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!ticketId || !adminDb) {
      return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
    }

    const ticketSnapshot = await adminDb.collection("tickets").doc(ticketId).get();
    const registrationSnapshot = await adminDb
      .collection("registrations")
      .where("ticketId", "==", ticketId)
      .limit(1)
      .get();

    if (!ticketSnapshot.exists && registrationSnapshot.empty) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const persistedTicket = ticketSnapshot.exists ? ticketSnapshot.data() : null;
    const registration = registrationSnapshot.empty
      ? persistedTicket
      : { id: registrationSnapshot.docs[0].id, ...registrationSnapshot.docs[0].data() };

    const ownerUid = registration.userId || persistedTicket?.userId;
    const ownerEmail = String(
      registration.email || registration.buyerEmail || persistedTicket?.buyerEmail || "",
    ).toLowerCase();
    const callerEmail = String(caller.email || "").toLowerCase();

    const isOwner =
      (ownerUid && ownerUid === caller.uid) ||
      (caller.decodedToken?.email_verified === true && ownerEmail && ownerEmail === callerEmail);

    if (!isOwner && caller.role !== "superAdmin") {
      return NextResponse.json({ error: "Ticket access denied" }, { status: 403 });
    }

    const email = ownerEmail;
    if (
      email === "superadmin@ticketlelo.com" ||
      email === "superadin@ticketlelo.com"
    ) {
      return NextResponse.json({
        success: true,
        message: "Email delivery skipped for superadmin address",
      });
    }

    const emailConfig = getEmailConfig();
    if (!emailConfig.hasApiKey && !emailConfig.isMockEnabled && !process.env.SMTP_EMAIL) {
      return NextResponse.json({ error: "Ticket email delivery is not configured" }, { status: 503 });
    }

    const eventSnapshot = await adminDb.collection("events").doc(registration.eventId).get();
    const event = eventSnapshot.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : null;
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventTitle = event.name || event.title || "Tech Fest 2026";
    const guestName = registration.fullName || registration.buyerName || "Aarav Kumar";
    const venue = event.venue || event.location || "Main Auditorium, School of Engineering";
    const formattedDate = formatDateDisplay(event.date || event.startDate);
    const formattedTime = event.time || event.startTime || "12:00 – 5:00 PM IST";
    const tierName = registration.tierName || registration.subEventName || "General";
    const isPaid = Boolean(event.isPaid || registration.price || registration.amount);
    const priceValue = registration.price || registration.amount || event.price || 199;
    const priceDisplay = isPaid ? `₹${priceValue}` : "Free";

    const emailBaseUrl = getEmailBaseUrl();
    const eventPageUrl = `${emailBaseUrl}/e/${event.slug || event.id}`;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${venue} ${event.location || ""}`.trim() || eventTitle,
    )}`;
    const calEventDate = parseFirestoreDate(event.date || event.startDate) || new Date();
    const calDateStr = calEventDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      eventTitle,
    )}&details=${encodeURIComponent(
      `Your entry pass: ${ticketId}. Show your QR at the entrance.`,
    )}&location=${encodeURIComponent(venue)}&dates=${calDateStr}/${calDateStr}`;

    // Extract or generate scannable QR code image and buffer for email embedding and PDF
    const rawQr = registration.qrCode || persistedTicket?.qrCodeUrl || "";
    let scannablePayload =
      registration.qrPayload ||
      persistedTicket?.qrPayload ||
      ticketId ||
      "TICKETLELO";

    // If payload is malformed or excessively long, fallback to ticketId
    if (
      typeof scannablePayload !== "string" ||
      scannablePayload.startsWith("data:") ||
      scannablePayload.length > 500
    ) {
      scannablePayload = ticketId;
    }

    let qrBuffer = null;
    let qrDataUrl = "";

    // If existing QR code is already a data URL (e.g. data:image/png;base64,...), decode directly to Buffer
    if (typeof rawQr === "string" && rawQr.startsWith("data:image/")) {
      try {
        const base64Data = rawQr.replace(/^data:image\/\w+;base64,/, "");
        qrBuffer = Buffer.from(base64Data, "base64");
        qrDataUrl = rawQr;
      } catch (decodeErr) {
        console.warn("[send-ticket-email] Could not decode existing QR data URL, regenerating:", decodeErr);
        qrBuffer = null;
      }
    }

    // If no buffer yet (rawQr was not a data URL or decode failed), generate fresh QR code from payload
    if (!qrBuffer) {
      try {
        qrBuffer = await QRCode.toBuffer(String(scannablePayload), {
          width: 320,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
        qrDataUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`;
      } catch (qrErr) {
        console.warn("[send-ticket-email] QR code generation failed with payload, falling back to ticketId:", qrErr);
        try {
          qrBuffer = await QRCode.toBuffer(String(ticketId), {
            width: 320,
            margin: 1,
            color: { dark: "#000000", light: "#ffffff" },
          });
          qrDataUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`;
        } catch (fatalQrErr) {
          console.error("[send-ticket-email] Fatal QR generation fallback failed:", fatalQrErr);
          qrBuffer = Buffer.alloc(0);
          qrDataUrl = "";
        }
      }
    }

    // Generate PDF ticket attachment
    let pdfBuffer;
    try {
      const pdfBlob = await generatePDFTicket(
        { ...registration, ticketId, qrCode: qrDataUrl },
        event,
        qrDataUrl,
      );
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      pdfBuffer = Buffer.from(pdfArrayBuffer);
    } catch (pdfErr) {
      console.error("[send-ticket-email] Failed to generate PDF ticket:", pdfErr);
      throw new Error(`Failed to generate PDF ticket: ${pdfErr?.message || "Unknown error"}`);
    }

    // Prepare attachments
    const attachments = [
      {
        filename: `${eventTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}-Pass-${ticketId}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
      {
        filename: "ticket-qr.png",
        content: qrBuffer,
        cid: "ticketQrCode",
      },
    ];

    const logoPath = path.join(process.cwd(), "public", "logo", "ticketlelo-logo-nav.png");
    const hasLogo = fs.existsSync(logoPath);
    if (hasLogo) {
      attachments.push({
        filename: "ticketlelo-logo.png",
        path: logoPath,
        cid: "ticketleloLogo",
      });
    }

    // RFC 5322 Message-ID
    const domain = "ticketlelo.in";
    const uniqueId = `tl-tkt-${ticketId.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now()}`;
    const messageId = `<${uniqueId}@${domain}>`;

    const { html: htmlBody, text: textBody } = buildTicketPassEmail({
      eventTitle,
      guestName,
      ticketId,
      venue,
      formattedDate,
      formattedTime,
      tierName,
      priceDisplay,
      hasLogo,
      emailBaseUrl,
      eventPageUrl,
      mapsUrl,
      calendarUrl,
    });

    // Enqueue job with Critical P0 priority and deduplicating idempotency key
    const enqueueResult = await enqueueEmail({
      to: email,
      subject: `Your Ticket for ${eventTitle} — ${ticketId}`,
      html: htmlBody,
      text: textBody,
      priority: EmailPriority.P0,
      emailType: EmailType.TICKET_DELIVERY,
      ticketId,
      eventId: event.id,
      bookingId: registration.orderId || null,
      idempotencyKey: `idemp_ticket_${ticketId.toLowerCase()}`,
      attachments,
      headers: {
        "Message-ID": messageId,
        "Date": new Date().toUTCString(),
        "X-Entity-Ref-ID": messageId,
        "X-Mailer": "TicketLelo Mail Engine 2.0 (Resend)",
        "List-Unsubscribe": `<mailto:support@ticketlelo.in?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "Auto-Submitted": "auto-generated",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Ticket email queued for delivery",
      jobId: enqueueResult.jobId,
      isDuplicate: Boolean(enqueueResult.isDuplicate),
    });
  } catch (error) {
    console.error("[send-ticket-email] Delivery queueing failed:", error);
    return NextResponse.json(
      { error: "Could not send ticket email: " + (error?.message || "Queueing failed") },
      { status: 502 },
    );
  }
}
