/**
 * TicketLelo Indian Banking & Working Day Calendar Engine
 *
 * Implements calendar-aware settlement calculation for CTO compliance:
 * - Excludes Saturdays and Sundays (standard banking weekends).
 * - Excludes Reserve Bank of India (RBI) / Indian National Negotiable Instruments Act holidays.
 * - Computes T+2 (Gateway settlement) and T+4 (Organizer settlement eligibility).
 */

/**
 * Standard recurring Indian National and Major Banking Holidays (MM-DD format)
 */
const FIXED_ANNUAL_HOLIDAYS = [
  "01-26", // Republic Day
  "04-01", // Annual Bank Account Closing
  "05-01", // Maharashtra Day / May Day
  "08-15", // Independence Day
  "10-02", // Mahatma Gandhi Jayanti
  "12-25", // Christmas Day
];

/**
 * Known Gazetted / RBI Banking Holidays by Year (YYYY-MM-DD)
 * Covers movable festivals (Holi, Eid, Diwali, etc.)
 */
const MOVABLE_BANK_HOLIDAYS = new Set([
  // 2025
  "2025-02-26", // Maha Shivratri
  "2025-03-14", // Holi
  "2025-03-31", // Id-ul-Fitr
  "2025-04-10", // Mahavir Jayanti
  "2025-04-18", // Good Friday
  "2025-06-07", // Id-ul-Zuha (Bakrid)
  "2025-08-27", // Ganesh Chaturthi
  "2025-10-02", // Gandhi Jayanti / Dussehra
  "2025-10-20", // Diwali
  "2025-10-21", // Govardhan Puja
  "2025-11-05", // Guru Nanak Jayanti

  // 2026
  "2026-01-26", // Republic Day
  "2026-02-15", // Maha Shivratri
  "2026-03-03", // Holi
  "2026-03-20", // Id-ul-Fitr
  "2026-04-01", // Annual Bank Closing
  "2026-04-03", // Good Friday
  "2026-04-14", // Dr. Ambedkar Jayanti
  "2026-05-27", // Bakrid / Eid-ul-Adha
  "2026-08-15", // Independence Day
  "2026-09-14", // Ganesh Chaturthi
  "2026-10-02", // Mahatma Gandhi Jayanti
  "2026-10-20", // Dussehra (Vijaya Dashami)
  "2026-11-08", // Diwali (Lakshmi Puja)
  "2026-11-09", // Diwali Balipratipada
  "2026-11-24", // Guru Nanak Jayanti
  "2026-12-25", // Christmas Day

  // 2027
  "2027-01-26", // Republic Day
  "2027-03-06", // Maha Shivratri
  "2027-03-23", // Holi
  "2027-04-01", // Annual Bank Closing
  "2027-04-14", // Ambedkar Jayanti
  "2027-08-15", // Independence Day
  "2027-10-02", // Gandhi Jayanti
  "2027-10-28", // Diwali
  "2027-12-25", // Christmas Day
]);

/**
 * Checks if a given date string or Date object is a weekend (Saturday or Sunday).
 * @param {Date|string|number} dateInput
 * @returns {boolean}
 */
export function isWeekend(dateInput) {
  const d = new Date(dateInput);
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/**
 * Checks if a given date is a statutory Indian Bank Holiday.
 * @param {Date|string|number} dateInput
 * @returns {boolean}
 */
export function isBankHoliday(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const mmDd = `${mm}-${dd}`;
  const yyyyMmDd = `${yyyy}-${mm}-${dd}`;

  if (FIXED_ANNUAL_HOLIDAYS.includes(mmDd)) {
    return true;
  }

  return MOVABLE_BANK_HOLIDAYS.has(yyyyMmDd);
}

/**
 * Checks if a date is a normal working day (neither weekend nor bank holiday).
 * @param {Date|string|number} dateInput
 * @returns {boolean}
 */
export function isWorkingDay(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  return !isWeekend(d) && !isBankHoliday(d);
}

/**
 * Adds a specific number of WORKING days to a starting date, skipping weekends and holidays.
 *
 * @param {Date|string|number} startDateInput - Starting timestamp
 * @param {number} workingDaysToAdd - Number of working days to advance (e.g., 2 or 4)
 * @returns {Date} Date object of the matured working day (at 18:00:00 IST / end of banking day)
 */
export function addWorkingDays(startDateInput, workingDaysToAdd) {
  const current = new Date(startDateInput);
  if (isNaN(current.getTime())) {
    throw new TypeError(`[WorkingCalendar] Invalid startDate: ${startDateInput}`);
  }
  if (!Number.isInteger(workingDaysToAdd) || workingDaysToAdd < 0) {
    throw new TypeError(`[WorkingCalendar] workingDaysToAdd must be non-negative integer. Got: ${workingDaysToAdd}`);
  }

  let remaining = workingDaysToAdd;

  while (remaining > 0) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current)) {
      remaining -= 1;
    }
  }

  // Normalize settlement eligibility to 18:00 IST (12:30 UTC) on the target working day
  current.setUTCHours(12, 30, 0, 0);
  return current;
}

/**
 * Computes complete settlement schedule for an authorized payment capture.
 *
 * @param {Date|string|number} captureTimestamp - Timestamp of successful payment capture
 * @returns {Object} Comprehensive settlement schedule breakdown
 */
export function calculateSettlementDates(captureTimestamp) {
  const captureDate = new Date(captureTimestamp || Date.now());
  if (isNaN(captureDate.getTime())) {
    throw new TypeError(`[WorkingCalendar] Invalid captureTimestamp: ${captureTimestamp}`);
  }

  const razorpaySettlementDate = addWorkingDays(captureDate, 2); // T+2
  const organizerSettlementDate = addWorkingDays(captureDate, 4); // T+4

  return {
    capturedAt: captureDate.toISOString(),
    tPlus2RazorpayDate: razorpaySettlementDate.toISOString(),
    tPlus4OrganizerDate: organizerSettlementDate.toISOString(),
    isCaptureDayWeekend: isWeekend(captureDate),
    isCaptureDayHoliday: isBankHoliday(captureDate),
    targetSettlementDayFormatted: organizerSettlementDate.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  };
}

