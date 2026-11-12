import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import QRCode from "qrcode";
import { generatePDFTicket } from "@/lib/tickets";
import { getAuthenticatedUser, canManageEventId } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { parseFirestoreDate } from "@/lib/date-utils";
import { enqueueEmail } from "@/lib/email/queue";
import { buildTicketPassEmail } from "@/lib/email/templates/ticket-pass";
import { EmailPriority, EmailType } from "@/lib/email/types";
import { getEmailConfig } from "@/lib/email/config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function getEmailBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://ticketlelo.in";
}

function formatDateDisplay(rawDate) {
  if (!rawDate) return "Date to be announced";
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
  return typeof rawDate === "string" ? rawDate : "Date to be announced";
}

/**
 * Helper: Generate PDF ticket and queue delivery via Resend
 * Can be called internally from server-side handlers or via POST API.
 */
export async function sendTicketDeliveryEmail({
  ticketId,
  isFirstTimeUser = undefined,
  setupToken = undefined,
}) {
  if (!ticketId || !adminDb) {
    throw new Error("ticketId is required");
  }

  const ticketSnapshot = await adminDb.collection("tickets").doc(ticketId).get();
  const registrationSnapshot = await adminDb
    .collection("registrations")
    .where("ticketId", "==", ticketId)
    .limit(1)
    .get();

  if (!ticketSnapshot.exists && registrationSnapshot.empty) {
    throw new Error("Ticket not found");
  }

  const persistedTicket = ticketSnapshot.exists ? ticketSnapshot.data() : null;
  const registration = registrationSnapshot.empty
    ? persistedTicket
    : { id: registrationSnapshot.docs[0].id, ...registrationSnapshot.docs[0].data() };

  const ownerUid = registration.userId || persistedTicket?.userId;
  const ownerEmail = String(
    registration.email || registration.buyerEmail || persistedTicket?.buyerEmail || "",
  ).toLowerCase().trim();

  if (!ownerEmail) {
    throw new Error("Recipient email address not found on ticket record");
  }

  if (
    ownerEmail === "superadmin@ticketlelo.com" ||
    ownerEmail === "superadin@ticketlelo.com"
  ) {
    return {
      success: true,
      message: "Email delivery skipped for superadmin address",
    };
  }

  const emailConfig = getEmailConfig();
  if (!emailConfig.hasApiKey && !emailConfig.isMockEnabled && !process.env.SMTP_EMAIL) {
    throw new Error("Ticket email delivery is not configured");
  }

  const eventSnapshot = await adminDb.collection("events").doc(registration.eventId).get();
  const event = eventSnapshot.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : null;
  if (!event) {
    throw new Error("Event not found");
  }

  const eventTitle = event.name || event.title || registration.eventName || "Event Pass";
  const guestName = registration.fullName || registration.buyerName || "Attendee";
  const venue = event.venue || event.location || registration.venue || "Venue to be announced";
  const formattedDate = formatDateDisplay(event.date || event.startDate || registration.eventDate);
  const formattedTime = event.time || event.startTime || registration.eventTime || "";
  const tierName = registration.tierName || registration.subEventName || registration.ticketTier || "General";
  const isPaid = Boolean(event.isPaid || registration.price || registration.amount);
  const priceValue = registration.price || registration.amount || event.price || 0;
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

  if (
    typeof scannablePayload !== "string" ||
    scannablePayload.startsWith("data:") ||
    scannablePayload.length > 500
  ) {
    scannablePayload = ticketId;
  }

  let qrBuffer = null;
  let qrDataUrl = "";

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

  // Determine whether this user is a first-time user or returning user
  let effectiveFirstTime = isFirstTimeUser;
  if (effectiveFirstTime === undefined) {
    effectiveFirstTime = true;
    if (adminDb) {
      try {
        let userDoc = null;
        if (ownerUid) {
          userDoc = await adminDb.collection("users").doc(ownerUid).get();
        }
        if ((!userDoc || !userDoc.exists) && ownerEmail) {
          const q = await adminDb
            .collection("users")
            .where("email", "==", ownerEmail)
            .limit(1)
            .get();
          if (!q.empty) {
            userDoc = q.docs[0];
          }
        }
        if (userDoc && userDoc.exists) {
          const userData = userDoc.data();
          if (userData.hasSetPassword === true || userData.isFirstTimeUser === false) {
            effectiveFirstTime = false;
          }
        }
      } catch (userCheckErr) {
        console.warn("[send-ticket-email] User check error:", userCheckErr?.message);
      }
    }
  }

  let finalSetupToken = setupToken;
  let setupPasswordUrl = "";
  if (effectiveFirstTime) {
    if (!finalSetupToken && adminDb && ownerEmail) {
      try {
        const existingTokenDoc = await adminDb.collection("accountSetupTokens").doc(ownerEmail).get();
        if (
          existingTokenDoc.exists &&
          existingTokenDoc.data().used !== true &&
          Number(existingTokenDoc.data().expiresAt) > Date.now()
        ) {
          finalSetupToken = existingTokenDoc.data().token;
        }
      } catch {}
    }

    if (!finalSetupToken) {
      finalSetupToken = crypto.randomBytes(24).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(finalSetupToken).digest("hex");
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days validity
      if (adminDb && ownerEmail) {
        try {
          await adminDb.collection("accountSetupTokens").doc(ownerEmail).set(
            {
              token: finalSetupToken,
              tokenHash,
              email: ownerEmail,
              ticketId,
              userId: ownerUid || null,
              createdAt: Date.now(),
              expiresAt,
              used: false,
            },
            { merge: true },
          );
        } catch (tokenErr) {
          console.warn("[send-ticket-email] Could not persist setup token:", tokenErr?.message);
        }
      }
    }

    setupPasswordUrl = `${emailBaseUrl}/setup-password?email=${encodeURIComponent(
      ownerEmail,
    )}&token=${finalSetupToken}&ticketId=${encodeURIComponent(ticketId)}`;
  }

  const loginUrl = `${emailBaseUrl}/login?email=${encodeURIComponent(
    ownerEmail,
  )}&redirect=/dashboard`;

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
    isFirstTimeUser: effectiveFirstTime,
    setupPasswordUrl,
    loginUrl,
    email: ownerEmail,
  });

  const emailSubject = effectiveFirstTime
    ? `You're Registered! Your Ticket Is Ready on TicketLelo`
    : `You're Registered! Your Ticket for ${eventTitle} is Ready`;

  // Enqueue job with Critical P0 priority and deduplicating idempotency key
  const enqueueResult = await enqueueEmail({
    to: ownerEmail,
    subject: emailSubject,
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

  return {
    success: true,
    message: "Ticket email queued for delivery",
    jobId: enqueueResult.jobId,
    isDuplicate: Boolean(enqueueResult.isDuplicate),
    isFirstTimeUser: effectiveFirstTime,
  };
}

/**
 * API Route: Resend PDF ticket and queue delivery via Resend
 * POST /api/send-ticket-email
 * Body: { ticketId }
 *
 * Requirements:
 * - SEC-7: Must require authenticated ownership or authorized organizer/admin to prevent anonymous email bombing.
 * - SEC-3 / R82: Rate limiting on resend requests.
 */
export async function POST(request) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = checkRateLimit({
      key: `resend_email_ip:${clientIp}`,
      limit: 6,
      windowMs: 5 * 60 * 1000, // 6 requests per 5 minutes per IP
    });
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many email requests from this network. Please try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const { ticketId } = body;
    if (!ticketId || typeof ticketId !== "string" || !adminDb) {
      return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
    }

    // Require authentication (SEC-7)
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required to request ticket email delivery." },
        { status: 401 }
      );
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
    ).toLowerCase().trim();
    const callerEmail = String(caller.email || "").toLowerCase().trim();
    const callerEmailVerified = caller.decodedToken?.email_verified === true;

    const isOwner =
      Boolean(ownerUid && ownerUid === caller.uid) ||
      Boolean(callerEmailVerified && ownerEmail && ownerEmail === callerEmail);

    const isSuperAdmin = caller.role === "superAdmin";
    let isOrganiser = false;
    const eventId = registration.eventId || persistedTicket?.eventId;
    if (!isOwner && !isSuperAdmin && eventId) {
      isOrganiser = await canManageEventId(caller, eventId);
    }

    if (!isOwner && !isOrganiser && !isSuperAdmin) {
      return NextResponse.json({ error: "Ticket access denied" }, { status: 403 });
    }

    const result = await sendTicketDeliveryEmail({ ticketId });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[send-ticket-email] Delivery queueing failed:", error);
    return NextResponse.json(
      { error: "Could not send ticket email: " + (error?.message || "Queueing failed") },
      { status: 502 },
    );
  }
}
