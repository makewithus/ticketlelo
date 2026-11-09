/**
 * TicketLelo Help & Support Ticketing System — Domain Enums & Constants
 */

export const SUPPORT_CATEGORIES = Object.freeze([
  "Payments and Razorpay",
  "Settlements and Payouts",
  "Refunds and Cancellations",
  "Event Management",
  "Registrations and Ticketing",
  "QR Check-in",
  "Account and Verification",
  "Technical Issues",
  "Other",
]);

export const SUPPORT_STATUSES = Object.freeze({
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_FOR_ORGANIZER: "WAITING_FOR_ORGANIZER",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
});

export const SUPPORT_STATUS_LIST = Object.freeze(Object.values(SUPPORT_STATUSES));

export const SUPPORT_PRIORITIES = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
});

export const SUPPORT_PRIORITY_LIST = Object.freeze(Object.values(SUPPORT_PRIORITIES));

export const SUPPORT_ROLES = Object.freeze({
  ORGANIZER: "organizer",
  SUPERADMIN: "superadmin",
  SUPPORT_AGENT: "support_agent",
});

/**
 * Valid allowed status transitions to preserve resolution workflow integrity
 */
export const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  OPEN: ["IN_PROGRESS", "WAITING_FOR_ORGANIZER", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["WAITING_FOR_ORGANIZER", "RESOLVED", "CLOSED"],
  WAITING_FOR_ORGANIZER: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["IN_PROGRESS"], // Reopened by admin or customer reply
});

