/**
 * RFC 5545 iCalendar (.ics) Generator
 * Generates standards-compliant iCalendar files for event and sub-event calendar exports (P10, CAL-001).
 */

function formatICSDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICSText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generates an RFC 5545 compliant VCALENDAR string
 * @param {Object} event
 * @param {string} event.title - Event or sub-event title
 * @param {string} event.description - Description
 * @param {string} event.location - Physical venue or virtual link
 * @param {Date|string|number} event.startDate - Start time
 * @param {Date|string|number} [event.endDate] - End time (defaults to start + 3 hours)
 * @param {string} [event.url] - URL link
 * @param {string} [event.uid] - Unique ID
 * @returns {string} iCalendar file contents
 */
export function generateICS(event) {
  const start = formatICSDate(event.startDate || new Date());
  let end = formatICSDate(event.endDate);

  if (!end && event.startDate) {
    const defaultEnd = new Date(new Date(event.startDate).getTime() + 3 * 60 * 60 * 1000);
    end = formatICSDate(defaultEnd);
  }

  const now = formatICSDate(new Date());
  const uid = event.uid || `tktlelo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@ticketlelo.com`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TicketLelo//Event Operating Platform//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICSText(event.title || "Event")}`,
    `DESCRIPTION:${escapeICSText(event.description || "")}`,
    `LOCATION:${escapeICSText(event.location || "")}`,
    event.url ? `URL:${event.url}` : null,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return icsLines.join("\r\n");
}
