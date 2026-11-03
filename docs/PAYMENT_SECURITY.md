# TicketLelo Payment Security Architecture

## 1. Threat Model & Security Posture
The TicketLelo marketplace payment infrastructure is designed under zero-trust assumptions:
- Client-side code is untrusted. Payment amounts, ticket quantities, and commission percentages are computed strictly server-side.
- Payment gateway secrets are strictly server-only (`process.env.RAZORPAY_KEY_SECRET`, `process.env.RAZORPAY_WEBHOOK_SECRET`).
- Strict tenant isolation guarantees organizers can only inspect and manage their own financial transactions and connected accounts.

---

## 2. Key Security Safeguards

### 2.1 Timing-Safe Cryptographic Signature Verification
All payment callbacks and webhooks use constant-time HMAC-SHA256 signature verification via Node.js `crypto.timingSafeEqual`:
```javascript
const expectedBuf = Buffer.from(expected, 'utf8');
const signatureBuf = Buffer.from(signature, 'utf8');
if (expectedBuf.length !== signatureBuf.length) return false;
return crypto.timingSafeEqual(expectedBuf, signatureBuf);
```
Prevents timing side-channel attacks against HMAC verification.

### 2.2 Server-Side Price & Quantity Validation
Ticket prices and discounts are recomputed server-side in `src/app/api/create-order/route.js`. Any client-supplied price or discount is discarded.

### 2.3 Strict Tenant Isolation & RBAC
- Endpoints (`/api/payments/onboarding`, `/api/payments/summary`) verify that `caller.organizationId === targetOrgId` or `caller.uid === targetOrgId`.
- Superadmin actions (`/api/payments/commission`, `/api/payments/reconcile`) require `caller.role === 'superadmin' || caller.role === 'admin'`.

### 2.4 Prevention of Double Fulfillment & Replays
- Database-backed webhook idempotency using Firestore transactions.
- Ticket capacity reservation system ensures seats cannot be double-booked during concurrent checkout attempts.
- Capacity is automatically released if gateway order creation fails.

### 2.5 Sensitive Financial Data Sanitization
- Bank account numbers, IFSC codes, and raw KYC documents are handled directly by Razorpay's PCI-DSS compliant infrastructure.
- TicketLelo stores only non-sensitive tokens (`providerAccountId`, `verificationStatus`, `capabilities`).
