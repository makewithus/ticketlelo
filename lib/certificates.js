import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { jsPDF } from "jspdf";

/**
 * Dual-Level Certificate Engine (P10, CERT-001–015)
 * Issues authentic, verifiable parent-event and sub-event certificates ONLY to verified attendees.
 */

/**
 * Verify attendance eligibility for certificate generation
 * @param {Object} ticket - Ticket document
 * @param {string} [subEventId] - Specific sub-event track ID, or null/undefined for parent event
 * @returns {{ eligible: boolean, reason?: string }}
 */
export function checkCertificateEligibility(ticket, subEventId = null) {
  if (!ticket) {
    return { eligible: false, reason: "Ticket record not found." };
  }

  if (ticket.status === "Revoked") {
    return { eligible: false, reason: "Ticket has been revoked." };
  }

  const checkIns = ticket.checkIns || {};
  const isUsedOverall = ticket.status === "Used" || Object.keys(checkIns).length > 0;

  if (subEventId) {
    // Sub-event specific certificate: requires verified gate scan at that track
    const trackEntitled =
      Array.isArray(ticket.entitledSubEventIds) &&
      ticket.entitledSubEventIds.includes(subEventId);

    if (!trackEntitled) {
      return {
        eligible: false,
        reason: "Ticket does not contain entitlement for this sub-event track.",
      };
    }

    const hasTrackCheckIn = Boolean(checkIns[subEventId]);
    if (!hasTrackCheckIn) {
      return {
        eligible: false,
        reason: "Verified attendance at this sub-event track is required before certificate issuance.",
      };
    }

    return { eligible: true };
  }

  // Parent-event festival certificate: requires at least one gate admission
  if (!isUsedOverall) {
    return {
      eligible: false,
      reason: "Verified gate check-in at the festival is required before certificate issuance.",
    };
  }

  return { eligible: true };
}

/**
 * Issue or retrieve existing certificate
 * @param {Object} params
 * @param {string} params.ticketId
 * @param {string} [params.subEventId]
 * @param {string} [params.subEventTitle]
 * @param {string} [params.issuerName]
 * @returns {Promise<Object>} Certificate record
 */
export async function issueCertificate({
  ticketId,
  subEventId = null,
  subEventTitle = null,
  issuerName = "TicketLelo Academic & Fest Operations",
}) {
  if (!ticketId) throw new Error("Ticket ID required");

  // Fetch ticket
  const ticketRef = doc(db, "tickets", ticketId);
  const ticketSnap = await getDoc(ticketRef);

  let ticket = null;
  if (ticketSnap.exists()) {
    ticket = { id: ticketSnap.id, ...ticketSnap.data() };
  } else {
    // Check registrations collection
    const regQuery = query(collection(db, "registrations"), where("ticketId", "==", ticketId));
    const regSnap = await getDocs(regQuery);
    if (!regSnap.empty) {
      const reg = regSnap.docs[0].data();
      ticket = {
        id: ticketId,
        buyerName: reg.fullName,
        buyerEmail: reg.email,
        eventId: reg.eventId,
        eventTitle: reg.eventName || "Festival Event",
        status: reg.status,
        checkIns: reg.checkIns || (reg.status === "Used" ? { main_gate: { time: reg.usedAt } } : {}),
        entitledSubEventIds: reg.entitledSubEventIds || [],
      };
    }
  }

  if (!ticket) {
    throw new Error("Ticket record not found.");
  }

  // 1. Verify Attendance Eligibility
  const eligibility = checkCertificateEligibility(ticket, subEventId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Attendee is not eligible for this certificate.");
  }

  // 2. Check for Existing Certificate (Idempotency)
  const certsRef = collection(db, "certificates");
  const certType = subEventId ? `subevent_${subEventId}` : "parent_event";

  const existingQ = query(
    certsRef,
    where("ticketId", "==", ticketId),
    where("certificateType", "==", certType)
  );
  const existingSnap = await getDocs(existingQ);

  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0];
    return { id: existingDoc.id, ...existingDoc.data() };
  }

  // 3. Generate Unique Certificate ID (Canonical format: TL-CERT-YYYY-XXXX as per Master Specification Page 11)
  const eventSlug = String(ticket.eventSlug || ticket.eventId || "").toLowerCase();
  let year = new Date().getFullYear();
  const yearMatch = eventSlug.match(/(20\d{2})/);
  if (yearMatch) {
    year = yearMatch[1];
  } else if (ticket.eventDate) {
    year = new Date(ticket.eventDate).getFullYear();
  }
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = `TL-CERT-${year}-${randomSuffix}`;

  const certificateRecord = {
    id: certId,
    certificateId: certId,
    ticketId,
    buyerName: ticket.buyerName || "Attendee",
    buyerEmail: ticket.buyerEmail || "",
    eventId: ticket.eventId,
    eventTitle: ticket.eventTitle || "Festival Event",
    subEventId: subEventId || null,
    subEventTitle: subEventTitle || (subEventId ? "Specialized Track" : "Full Festival"),
    certificateType: certType,
    issuedAt: Timestamp.now(),
    issuerName,
    status: "valid", // "valid" | "revoked"
  };

  await setDoc(doc(db, "certificates", certId), certificateRecord);
  return certificateRecord;
}

/**
 * Fetch certificate by ID for public verification
 */
export async function getCertificate(certificateId) {
  if (!certificateId) return null;
  const cleanId = String(certificateId).trim();
  const certDoc = await getDoc(doc(db, "certificates", cleanId));
  if (certDoc.exists()) return { id: certDoc.id, ...certDoc.data() };

  try {
    const q = query(collection(db, "certificates"), where("certificateId", "==", cleanId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    }
  } catch (err) {
    console.warn("[certificates] Query by certificateId failed:", err.message);
  }

  return null;
}

/**
 * Generate PDF buffer for Certificate of Participation / Achievement
 * @param {Object} cert - Certificate record
 * @returns {Blob} PDF blob
 */
export function generateCertificatePDF(cert) {
  const pdf = new jsPDF("landscape", "mm", [297, 210]); // A4 Landscape
  const W = 297;
  const H = 210;

  // Background
  pdf.setFillColor(250, 250, 252);
  pdf.rect(0, 0, W, H, "F");

  // Outer Border
  pdf.setDrawColor(37, 99, 235); // Ticket Blue #2563EB
  pdf.setLineWidth(2.5);
  pdf.rect(12, 12, W - 24, H - 24);

  // Inner Accent Border
  pdf.setDrawColor(245, 158, 11); // Amber / Gold
  pdf.setLineWidth(0.8);
  pdf.rect(16, 16, W - 32, H - 32);

  // Header Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(100, 116, 139);
  pdf.text("TICKETLELO VERIFIED CREDENTIALS", W / 2, 35, { align: "center" });

  pdf.setFontSize(28);
  pdf.setTextColor(15, 23, 42);
  pdf.text("CERTIFICATE OF PARTICIPATION", W / 2, 48, { align: "center" });

  // Subtitle
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(100, 116, 139);
  pdf.text("This is proudly presented to", W / 2, 65, { align: "center" });

  // Attendee Name
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(26);
  pdf.setTextColor(37, 99, 235);
  pdf.text(cert.buyerName || "Attendee", W / 2, 80, { align: "center" });

  // Certificate Description
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.setTextColor(51, 65, 85);

  const eventText = cert.subEventTitle
    ? `for active participation in ${cert.subEventTitle} during ${cert.eventTitle}`
    : `for verified participation and attendance at ${cert.eventTitle}`;

  pdf.text(eventText, W / 2, 98, { align: "center" });

  // Verification Seal Box
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(W / 2 - 60, 120, 120, 28, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text("OFFICIALLY VERIFIED & ADMITTED", W / 2, 129, { align: "center" });
  pdf.setFont("courier", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(37, 99, 235);
  pdf.text(cert.certificateId || cert.id, W / 2, 137, { align: "center" });

  // Footer / Signatures
  pdf.setDrawColor(203, 213, 225);
  pdf.line(40, 175, 100, 175);
  pdf.line(W - 100, 175, W - 40, 175);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text("Authorized Event Signatory", 70, 182, { align: "center" });
  pdf.text("TicketLelo Platform Verification", W - 70, 182, { align: "center" });

  const dateStr = cert.issuedAt?.toDate
    ? cert.issuedAt.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  pdf.setFontSize(9);
  pdf.text(`Issued on: ${dateStr}`, W / 2, 192, { align: "center" });

  return pdf.output("blob");
}
