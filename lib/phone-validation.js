import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Validates and normalises a phone number to standard E.164 and readable international formats.
 * Primary supported region: India ('IN', +91) with standard international E.164 support.
 *
 * @param {string|number} phone - Phone number input
 * @param {object} options
 * @param {string} [options.defaultCountry='IN'] - Default ISO 3166-1 alpha-2 country code
 * @param {boolean} [options.required=false] - Whether a non-empty value is mandatory
 * @returns {{
 *   isValid: boolean,
 *   isProvided: boolean,
 *   e164: string|null,
 *   international: string|null,
 *   national: string|null,
 *   country: string|null,
 *   error: string|null
 * }}
 */
export function validatePhoneNumber(phone, options = {}) {
  const { defaultCountry = "IN", required = false } = options;

  if (phone === null || phone === undefined) {
    if (required) {
      return { isValid: false, isProvided: false, error: "Phone number is required" };
    }
    return { isValid: true, isProvided: false, e164: null, international: null, national: null, country: null, error: null };
  }

  const str = String(phone).trim();
  if (!str) {
    if (required) {
      return { isValid: false, isProvided: false, error: "Phone number is required" };
    }
    return { isValid: true, isProvided: false, e164: null, international: null, national: null, country: null, error: null };
  }

  // Reject strings containing alphabetic letters or invalid symbols
  if (/[a-zA-Z]/.test(str)) {
    return {
      isValid: false,
      isProvided: true,
      error: "Phone number cannot contain alphabetic characters.",
    };
  }

  // Reject strings with arbitrary symbol sequences (only leading + and digits/spaces/dashes/parentheses allowed)
  if (!/^\+?[0-9\s\-()]+$/.test(str)) {
    return {
      isValid: false,
      isProvided: true,
      error: "Phone number contains invalid punctuation or characters.",
    };
  }

  const cleanDigits = str.replace(/\D/g, "");
  // Disallow absurdly short or arbitrary long sequences
  if (cleanDigits.length < 7 || cleanDigits.length > 15) {
    return {
      isValid: false,
      isProvided: true,
      error: "Phone number must be between 7 and 15 digits (standard E.164 range).",
    };
  }

  try {
    const parsed = parsePhoneNumberFromString(str, defaultCountry);
    if (!parsed || !parsed.isValid()) {
      return {
        isValid: false,
        isProvided: true,
        error: "Please enter a valid phone number with a valid country code or standard 10-digit national number.",
      };
    }

    return {
      isValid: true,
      isProvided: true,
      e164: parsed.format("E.164"),
      international: parsed.formatInternational(),
      national: parsed.formatNational(),
      country: parsed.country || defaultCountry,
      error: null,
    };
  } catch (err) {
    return {
      isValid: false,
      isProvided: true,
      error: "Unable to parse phone number: " + (err?.message || "Invalid format"),
    };
  }
}

/**
 * Safely format any stored phone value for display in tables and headers without throwing.
 * Handles legacy malformed records gracefully.
 *
 * @param {string|number} phone
 * @param {string} [defaultCountry='IN']
 * @returns {string} Human-readable international phone number or safe fallback
 */
export function formatPhoneDisplay(phone, defaultCountry = "IN") {
  if (!phone) return "—";
  const str = String(phone).trim();
  if (!str || str === "—" || str === "null" || str === "undefined") return "—";

  try {
    const parsed = parsePhoneNumberFromString(str, defaultCountry);
    if (parsed && parsed.isValid()) {
      return parsed.formatInternational();
    }
  } catch {}

  // Safe fallback for historical malformed numbers without crashing
  return str;
}
