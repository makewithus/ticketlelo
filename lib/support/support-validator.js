import { z } from 'zod';
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES, SUPPORT_PRIORITIES } from './types.js';

// International / Indian phone regex requiring +country code and 7-15 digits
const phoneRegex = /^\+[1-9]\d{0,3}[-.\s]?(\(?\d{1,4}\)?[-.\s]?)?[\d\s.-]{7,15}$/;

const CATEGORY_ALIASES = {
  SETTLEMENT_PAYOUT: "Settlements and Payouts",
  PAYMENT_CHECKOUT: "Payments and Razorpay",
  REFUND_CANCELLATION: "Refunds and Cancellations",
  EVENT_CREATION: "Event Management",
  REGISTRATION_ATTENDEE: "Registrations and Ticketing",
  TICKET_QR_SCANNING: "QR Check-in",
  ACCOUNT_PROFILE: "Account and Verification",
  TECHNICAL_BUG: "Technical Issues",
  GENERAL_INQUIRY: "Other",
  BILLING_SUBSCRIPTION: "Other",
};

export function normalizeCategory(cat) {
  if (!cat || typeof cat !== 'string') return "Other";
  if (SUPPORT_CATEGORIES.includes(cat)) return cat;
  if (CATEGORY_ALIASES[cat]) return CATEGORY_ALIASES[cat];
  const found = SUPPORT_CATEGORIES.find(c => c.toLowerCase() === cat.toLowerCase());
  return found || cat;
}

export const createTicketSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  email: z
    .string()
    .trim()
    .email("A valid email address is required")
    .toLowerCase(),
  phone: z
    .string()
    .trim()
    .min(8, "Phone number must be at least 8 digits")
    .max(20, "Phone number cannot exceed 20 characters")
    .regex(phoneRegex, "Invalid phone number format. Please include country code with + (e.g. +91 9876543210)."),
  category: z
    .string()
    .transform((val) => normalizeCategory(val))
    .refine((val) => SUPPORT_CATEGORIES.includes(val), {
      message: `Category must be one of: ${SUPPORT_CATEGORIES.join(", ")}`,
    }),
  subject: z
    .string()
    .trim()
    .min(5, "Subject must be at least 5 characters")
    .max(150, "Subject cannot exceed 150 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Please provide a detailed issue description (at least 10 characters)")
    .max(5000, "Description cannot exceed 5000 characters"),
  priority: z
    .enum([SUPPORT_PRIORITIES.LOW, SUPPORT_PRIORITIES.MEDIUM, SUPPORT_PRIORITIES.HIGH, SUPPORT_PRIORITIES.URGENT])
    .optional()
    .default(SUPPORT_PRIORITIES.MEDIUM),
  relatedEntity: z
    .object({
      type: z.enum(["settlement", "order", "refund", "event"]),
      id: z.string().optional(),
      orderId: z.string().optional(),
      settlementId: z.string().optional(),
      referenceId: z.string().optional().nullable(),
      amountPaise: z.number().int().optional().nullable(),
      status: z.string().optional().nullable(),
    })
    .transform((entity) => {
      if (!entity) return null;
      return {
        ...entity,
        id: entity.id || entity.settlementId || entity.orderId || entity.referenceId || "unknown",
      };
    })
    .optional()
    .nullable(),
  attachments: z
    .array(
      z.object({
        name: z.string().max(255),
        url: z.string().url(),
        size: z.number().max(15 * 1024 * 1024, "File size cannot exceed 15MB").optional(),
        mimeType: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

export const createMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message content cannot be empty")
    .max(5000, "Message cannot exceed 5000 characters"),
  isInternalNote: z.boolean().optional().default(false),
  attachments: z
    .array(
      z.object({
        name: z.string().max(255),
        url: z.string().url(),
        size: z.number().max(15 * 1024 * 1024).optional(),
        mimeType: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

export function validateTicketPayload(data) {
  return createTicketSchema.parse(data);
}

export function validateMessagePayload(data) {
  return createMessageSchema.parse(data);
}
