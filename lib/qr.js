import QRCode from "qrcode";
import crypto from "crypto";

/**
 * Cryptographic QR Ticket Engine
 * Implements HMAC-SHA-256 signed QR payloads with versioned canonical format:
 * TLSEC:sha256:v1|evt=[slug]|tkt=[id]|tiers=[subs]|sig=[hmac]
 * (P08, QR-001–015, SEC-05).
 */

/**
 * Securely retrieves QR HMAC signing secret with fail-closed production safety
 */
export const getQRSecret = (customSecret = null) => {
  if (customSecret) return customSecret;
  const secret = process.env.QR_SIGNING_SECRET || process.env.QR_HMAC_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: QR_SIGNING_SECRET is missing in production environment. Insecure fallback is disabled."
      );
    }
    return "TL_GATE_SECRET_DEV_KEY_2027";
  }
  return secret;
};

/**
 * Generates canonical signed QR payload string.
 */
export const generateSignedQRPayload = (
  {
    eventSlug = "event",
    eventId = null,
    ticketId,
    entitledSubEventIds = [],
  },
  customSecret = null
) => {
  if (!ticketId) throw new Error("ticketId is required to generate signed QR payload");

  const effectiveSlug = eventId || eventSlug || "event";
  const cleanSlug = String(effectiveSlug).toLowerCase().trim();
  const sortedTiers = Array.isArray(entitledSubEventIds)
    ? [...entitledSubEventIds].sort().join(",")
    : "";

  const canonicalData = `evt=${cleanSlug}|tkt=${ticketId}|tiers=${sortedTiers}`;
  const key = getQRSecret(customSecret);
  const signature = crypto
    .createHmac("sha256", key)
    .update(canonicalData)
    .digest("hex");

  return `TLSEC:sha256:v1|${canonicalData}|sig=${signature}`;
};


/**
 * Verifies authenticity of a scanned QR payload.
 */
export const verifySignedQRPayload = (rawPayload, customSecret = null) => {
  if (!rawPayload || typeof rawPayload !== "string") {
    return { isValid: false, error: "Empty or invalid QR code format." };
  }

  const trimmed = rawPayload.trim();

  // 1. Check for signed format: TLSEC:sha256:v1|...
  if (trimmed.startsWith("TLSEC:sha256:v1|")) {
    const parts = trimmed.substring("TLSEC:sha256:v1|".length).split("|");
    const params = {};

    for (const part of parts) {
      const [k, ...v] = part.split("=");
      if (k) params[k] = v.join("=");
    }

    const { evt, tkt, tiers, sig } = params;

    if (!tkt || !sig) {
      return { isValid: false, error: "Tampered QR payload: missing ticket ID or signature." };
    }

    // Reconstruct canonical data and compute expected signature
    const canonicalData = `evt=${evt || ""}|tkt=${tkt}|tiers=${tiers || ""}`;
    const key = getQRSecret(customSecret);
    const expectedSig = crypto
      .createHmac("sha256", key)
      .update(canonicalData)
      .digest("hex");

    if (sig !== expectedSig) {
      return { isValid: false, error: "Cryptographic signature mismatch: Counterfeit QR ticket detected!" };
    }

    const entitledSubEventIds = tiers ? tiers.split(",").filter(Boolean) : [];

    return {
      isValid: true,
      ticketId: tkt,
      eventId: evt,
      eventSlug: evt,
      entitledSubEvents: entitledSubEventIds,
      entitledSubEventIds,
      isSigned: true,
    };
  }

  // 2. Legacy fallback: raw ticketId string
  return {
    isValid: true,
    ticketId: trimmed,
    entitledSubEventIds: [],
    isLegacy: true,
  };
};

/**
 * Generate High-Contrast Data URL QR Code
 */
export const generateQRCode = async (payload) => {
  if (!payload) throw new Error("Payload required for QR code generation");

  return await QRCode.toDataURL(payload, {
    width: 350,
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: "#0B132B",
      light: "#FFFFFF",
    },
  });
};

/**
 * Extract ticketId from scanned QR
 */
export const parseQRData = (rawValue) => {
  const result = verifySignedQRPayload(rawValue);
  if (!result.isValid) {
    throw new Error(result.error || "Invalid QR Code");
  }
  return result.ticketId;
};
