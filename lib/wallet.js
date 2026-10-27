/**
 * TicketLelo Digital Wallet Pass Engine
 * 
 * Provides:
 * 1. Apple Wallet (.pkpass) pass.json specification structure generation.
 * 2. Google Wallet (EventTicketClass / EventTicketObject) specification generator.
 * 3. Graceful fallback when Apple/Google developer certificates are unconfigured.
 */

/**
 * Builds standard Apple Wallet pass.json data dictionary.
 */
export function buildAppleWalletPassStructure({ ticket, event = {}, subEvents = [] }) {
  const eventTitle = event.title || event.name || "TicketLelo Event";
  const venueName = event.venueName || event.location || "Festival Grounds";
  const dateStr = event.date ? new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Scheduled";

  const entitledNames = Array.isArray(ticket.entitledTrackNames) && ticket.entitledTrackNames.length > 0
    ? ticket.entitledTrackNames.join(", ")
    : (ticket.tier || "General Admission");

  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER || "pass.com.ticketlelo.event",
    teamIdentifier: process.env.APPLE_TEAM_IDENTIFIER || "TICKETLELO_TEAM_ID",
    serialNumber: ticket.id || `TKT-${Date.now()}`,
    organizationName: "TicketLelo",
    description: eventTitle,
    logoText: "TicketLelo",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(11, 19, 43)", // Deep Navy #0B132B
    labelColor: "rgb(245, 166, 35)", // Electric Amber #F5A623
    eventTicket: {
      primaryFields: [
        {
          key: "event",
          label: "EVENT",
          value: eventTitle,
        },
      ],
      secondaryFields: [
        {
          key: "attendee",
          label: "ATTENDEE",
          value: ticket.buyerName || ticket.fullName || "Verified Attendee",
        },
        {
          key: "tier",
          label: "TIER",
          value: ticket.tier || "Standard Pass",
        },
      ],
      auxiliaryFields: [
        {
          key: "venue",
          label: "VENUE",
          value: venueName,
        },
        {
          key: "date",
          label: "DATE",
          value: dateStr,
        },
      ],
      backFields: [
        {
          key: "ticketId",
          label: "TICKET ID",
          value: ticket.id,
        },
        {
          key: "entitlements",
          label: "AUTHORIZED TRACKS",
          value: entitledNames,
        },
        {
          key: "support",
          label: "CUSTOMER SUPPORT",
          value: "support@ticketlelo.com",
        },
      ],
    },
    barcode: {
      format: "PKBarcodeFormatQR",
      message: ticket.qrPayload || ticket.id,
      messageEncoding: "iso-8859-1",
      altText: ticket.id,
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: ticket.qrPayload || ticket.id,
        messageEncoding: "iso-8859-1",
        altText: ticket.id,
      },
    ],
  };
}

/**
 * Builds Google Wallet EventTicketObject data dictionary.
 */
export function buildGoogleWalletPassStructure({ ticket, event = {}, subEvents = [] }) {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || "3388000000022222222";
  const classId = `${issuerId}.${event.id || "ticketlelo_fest_class"}`;
  const objectId = `${issuerId}.${(ticket.id || "").replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const eventTitle = event.title || event.name || "TicketLelo Event";
  const venueName = event.venueName || event.location || "Festival Grounds";

  return {
    id: objectId,
    classId: classId,
    state: "ACTIVE",
    ticketHolderName: ticket.buyerName || ticket.fullName || "Verified Attendee",
    ticketNumber: ticket.id,
    barcode: {
      type: "QR_CODE",
      value: ticket.qrPayload || ticket.id,
      alternateText: ticket.id,
    },
    ticketSeatDetails: {
      seat: ticket.tier || "General Admission",
      section: Array.isArray(ticket.entitledTrackNames) ? ticket.entitledTrackNames.join(", ") : "Standard Access",
    },
    reservationInfo: {
      confirmationCode: ticket.orderId || ticket.id,
    },
    hexBackgroundColor: "#0B132B",
  };
}

/**
 * Generates an Apple Wallet .pkpass bundle or returns clear credential requirement status.
 */
export async function generateAppleWalletPass(ticket, event, subEvents = []) {
  const hasCerts = Boolean(process.env.APPLE_PASS_CERT && process.env.APPLE_PASS_KEY);
  const passData = buildAppleWalletPassStructure({ ticket, event, subEvents });

  if (!hasCerts) {
    return {
      available: false,
      requiresCredentials: true,
      provider: "apple_wallet",
      passType: "pkpass",
      message: "Apple Wallet signing paused: APPLE_PASS_CERT or APPLE_PASS_KEY is unconfigured.",
      passStructure: passData,
    };
  }

  return {
    available: false,
    requiresCredentials: false,
    requiresImplementation: true,
    message: "Wallet signing is not implemented; no signed pass was generated.",
    provider: "apple_wallet",
    passType: "pkpass",
    passStructure: passData,
  };
}

/**
 * Generates Google Wallet save link JWT or returns clear credential requirement status.
 */
export async function generateGoogleWalletPass(ticket, event, subEvents = []) {
  const hasCreds = Boolean(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT && process.env.GOOGLE_WALLET_ISSUER_ID);
  const passData = buildGoogleWalletPassStructure({ ticket, event, subEvents });

  if (!hasCreds) {
    return {
      available: false,
      requiresCredentials: true,
      provider: "google_wallet",
      message: "Google Wallet pass generation paused: GOOGLE_WALLET_ISSUER_ID or GOOGLE_WALLET_SERVICE_ACCOUNT is unconfigured.",
      passStructure: passData,
    };
  }

  return {
    available: false,
    requiresCredentials: false,
    requiresImplementation: true,
    message: "Wallet signing is not implemented; no signed pass was generated.",
    provider: "google_wallet",
    passStructure: passData,
  };
}
