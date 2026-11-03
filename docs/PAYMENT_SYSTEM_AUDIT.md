# TicketLelo Marketplace Payment System Audit (Phase 0)

## Executive Summary
This document provides a comprehensive technical audit of the TicketLelo event ticketing codebase prior to implementing the multi-organizer marketplace payment management system (Razorpay Route). The audit evaluates existing backend services, database schemas, payment integrations, authentication, security controls, and potential regression risks.

---

## 1. Overall Monorepo & Application Architecture

| Dimension | Specification | Notes |
| :--- | :--- | :--- |
| **Framework** | Next.js 14+ (App Router) | Hybrid Server Components & Client Components |
| **Language** | JavaScript (ESM / Node.js 20+) | Native `node:crypto`, `node --test` runner |
| **Primary Database** | Google Cloud Firestore | Firebase Client SDK (`lib/firebase.js`) & Admin SDK (`lib/firebase-admin.js`) |
| **State Management** | React Context (`context/auth-context.js`) | SWR / Sonner Toast / Firestore real-time listeners |
| **UI Design System** | TailwindCSS + Radix UI | Dark canvas (`#131517`), Surface (`#1A1C1F`), Ticket Orange (`#FE760B`) |
| **Authentication** | Firebase Auth + JWT Server Verification | Custom claims and Firestore `users` collection lookup |

---

## 2. Existing Database Models & Relationships

### Core Collections in Firestore
1. **`users`**:
   - Fields: `uid`, `email`, `fullName`, `role` (`"user"`, `"organiser"`, `"superAdmin"`), `createdAt`, `updatedAt`.
   - Access: Read/write governed by Firebase Security Rules & Server Admin SDK (`lib/auth-server.js`).

2. **`events`**:
   - Fields: `id`, `name`/`title`, `slug`, `organiserId`/`organizerId`, `price`, `ticketPrice`, `capacity`, `status` (`"live"`, `"draft"`), `startDate`, `themeColor`, `ticketDesign`.
   - Relation: Belongs to an organizer; has many tickets, combos, and sub-events.

3. **`orders`**:
   - Fields: `id` (maps to `razorpayOrderId`), `eventId`, `ticketConfig`, `quantity`, `pricing` (`finalPayablePaise`, `finalPayable`, `platformFee`, `organizerSettlement`), `reservationId`, `registrationData`, `userId`, `status` (`"pending"`, `"paid"`, `"failed"`, `"refunded"`, `"partially_refunded"`), `paymentId`, `ticketId`.

4. **`tickets`**:
   - Fields: `id`, `ticketId` (`TKT-...`), `orderId`, `paymentId`, `userId`, `eventId`, `buyerEmail`, `amountPaid`, `qrPayload`, `qrCodeUrl`, `status` (`"Valid"`, `"Used"`, `"Revoked"`).

5. **`registrations`**:
   - Fields: `id`, `ticketId`, `orderId`, `userId`, `eventId`, `fullName`, `email`, `whatsappPhone`, `status` (`"Unused"`, `"Used"`), `paymentStatus` (`"paid"`, `"pending"`).

6. **`reservations`**:
   - Fields: `id`, `parentEventId`, `ticketConfig`, `quantity`, `buyerEmail`, `status` (`"reserved"`, `"finalized"`, `"released"`), `expiresAt`.

7. **`paymentRefunds`**:
   - Fields: `id`, `orderId`, `paymentId`, `amountPaise`, `createdAt`.

8. **`webhookEvents`**:
   - Fields: `id` (Razorpay event ID), `eventType`, `orderId`, `processedAt`, `status`.

9. **`commissions`** (Ambassador Program):
   - Fields: `id`, `ambassadorId`, `programId`, `parentEventId`, `orderId`, `commissionAmount`, `status` (`"held"`, `"approved"`, `"reversed"`, `"paid"`).

---

## 3. Current Payment Integration Assessment

### What Works Well:
1. **Server-Authoritative Pricing (`lib/pricing.js`)**:
   - Calculates base price, coupon deductions, 18% GST, and 2.5% convenience fee.
   - Decomposes into `finalPayablePaise` and `organizerSettlement`.
2. **Server-Side Signature Verification (`lib/payment-security.js`)**:
   - Cryptographic HMAC-SHA256 signature verification prevents client tampering.
3. **Capacity Reservation System (`lib/capacity-reservation.js`)**:
   - Prevents overselling during the checkout window.
4. **Webhook Deduplication (`src/app/api/webhooks/razorpay/route.js`)**:
   - Idempotently logs incoming event IDs and releases expired reservations on payment failure.

### Critical Gaps for Marketplace Compliance:
1. **No Connected Account Infrastructure**:
   - All funds currently settle into TicketLelo's master bank account. Organizers have no connected account references (`acc_...`).
2. **Missing Razorpay Route Splits / Transfers**:
   - Order creation does not specify Route `transfers`, nor does capture trigger transfers to linked accounts.
3. **No Marketplace Commission Engine**:
   - Platform fee is fixed at 2.5% in `lib/pricing.js`. There is no tier, organizer, or event override capability.
4. **No Double-Entry Financial Ledger**:
   - Only raw `orders` records exist. There is no balancing ledger of debits/credits for platform revenue, organizer payable, tax, gateway fee, or reversals.
5. **No Route Transfer Reversal Handling on Refunds**:
   - Refunding currently does not reverse linked account transfers, creating severe financial liability for the platform.
6. **No Creator Onboarding / KYC Interface**:
   - Organizers cannot initiate or monitor Razorpay Route linked account verification.
7. **No Financial Dashboard for Organizers**:
   - Organizers cannot inspect net earnings, transfers, or settlements.

---

## 4. Potential Conflicts & Regression Risks

1. **Free Event Registrations**:
   - `/api/register-free` must never require an active payment account or Route transfer.
2. **Ambassador Commissions (`lib/commissions.js`)**:
   - The ambassador referral program uses a `commissions` collection. Our marketplace platform commission engine must be distinct (`marketplaceCommissions` / `commissionConfigurations`) to prevent schema collisions.
3. **Deterministic Ticket IDs**:
   - Existing ticket issuance in `verify-payment` uses deterministic hashes derived from `orderId`. This logic must be preserved.
4. **Capacity Reservations**:
   - Capacity locks must be released if Route order creation or transfer validation fails.

---

## 5. Audit Conclusion & Recommendations
The platform possesses strong foundational primitives (server-side HMAC verification, capacity locks, and webhook deduplication). Implementing Razorpay Route requires:
1. Building a clean **Payment Provider Interface** to decouple payment gateways.
2. Adding **Connected Account Management** and an **Organizer Onboarding Workflow**.
3. Implementing a **Marketplace Commission Engine** operating in pure integer paise.
4. Adding **Route Transfer Execution** on payment capture.
5. Building an **Immutable Double-Entry Financial Ledger**.
6. Implementing **Transfer Reversal** logic during refunds.
7. Adding **Organizer & Admin Financial Dashboards**.
