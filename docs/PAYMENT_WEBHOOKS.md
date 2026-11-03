# TicketLelo Secure Webhook Infrastructure

## 1. Overview & Security Principles
Webhooks provide reliable, out-of-band state synchronization between payment gateways and TicketLelo.
Implemented in `lib/payments/webhook-processor.js` and `src/app/api/webhooks/razorpay/route.js`.

### Security Requirements:
1. **Raw Body Cryptographic HMAC-SHA256 Signature Verification**:
   The signature in `x-razorpay-signature` is computed over the raw body buffer and verified against `RAZORPAY_WEBHOOK_SECRET` using `crypto.timingSafeEqual`.
2. **Database-Backed Idempotency**:
   Every incoming event is recorded in the `webhookEvents` collection under its stable `eventId`.
   Retried webhook deliveries for already processed events return `200 OK` immediately without re-executing business logic.
3. **No Duplicate Ticket Issuance**:
   Ticket issuance and Route transfers can only execute once per order.

---

## 2. Handled Event Types

| Event Type | Source Entity | Handler Action |
|---|---|---|
| `payment.captured` | Payment Entity | Updates order payment status to `CAPTURED`, records provider payment ID |
| `transfer.processed` | Transfer Entity | Updates `paymentSplits` record `transferStatus` to `PROCESSED` |
| `transfer.failed` | Transfer Entity | Marks `transferStatus` as `FAILED`, alerts admin for manual review |
| `account.activated` | Account Entity | Sets connected account `verificationStatus` to `ACTIVE`, enables paid event hosting |
| `account.under_review`| Account Entity | Sets connected account `verificationStatus` to `UNDER_REVIEW` |
| `account.suspended` | Account Entity | Sets `verificationStatus` to `SUSPENDED`, automatically blocks paid event sales |
| `settlement.processed`| Settlement Entity| Logs settlement disbursement in `settlements` collection |
| `refund.processed` | Refund Entity | Updates order refund status and revokes associated tickets |

---

## 3. Retries & Error Recovery
If a database error occurs during event processing:
- Event status is updated to `FAILED` with `errorMessage` and incremented `retryCount`.
- Webhook returns HTTP 500, prompting Razorpay to retry delivery with exponential backoff.
