# TicketLelo Marketplace Payment System — Implementation Plan

## 1. Executive Summary & Objectives
This document specifies the engineering plan for implementing a production-grade multi-organizer marketplace payment management system on TicketLelo. The system enables independent event organizers to link verified payment accounts (via **Razorpay Route** linked accounts) to receive their net ticket revenues automatically, while TicketLelo automatically collects its configured platform commission per transaction.

The architecture is strictly provider-agnostic, allowing seamless addition of alternative payment providers (such as Cashfree Easy Split) without touching ticketing business logic.

---

## 2. Phase Breakdown & Execution Sequence

### Phase 1: Provider Abstraction & Core Payment Types (`lib/payments/`)
- **`types.js`**: Enums for payment states (`CREATED`, `PENDING`, `AUTHORIZED`, `CAPTURED`, `TRANSFER_PENDING`, `PARTIALLY_TRANSFERRED`, `TRANSFERRED`, `FAILED`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `DISPUTED`, `REVERSED`), account verification statuses (`NOT_CONNECTED`, `ONBOARDING_PENDING`, `KYC_PENDING`, `UNDER_REVIEW`, `ACTIVE`, `RESTRICTED`, `REJECTED`, `SUSPENDED`), and settlement statuses.
- **`provider-interface.js`**: Base `PaymentProvider` class defining strict async signatures:
  - `onboardCreator(organizerData)`
  - `getConnectedAccount(accountId)`
  - `getAccountStatus(accountId)`
  - `createPaymentOrder(orderData)`
  - `verifyPaymentSignature(paymentData)`
  - `createTransferOrSplit(paymentId, splits)`
  - `getTransferStatus(transferId)`
  - `refundPayment(paymentId, refundOptions)`
  - `reverseTransfer(transferId, amountPaise)`
  - `getSettlementStatus(settlementId)`
  - `reconcileTransaction(providerPaymentId)`
- **`providers/razorpay-route.js`**: Production-ready implementation integrating Razorpay REST APIs for Route:
  - Linked Account creation (`/v1/accounts`) & onboarding link generation
  - Payment Orders with Route Transfers configuration
  - Server-side signature verification (`HMAC-SHA256`)
  - Direct transfers on captured payments (`/v1/payments/:id/transfers`)
  - Full & partial refunds with transfer reversals (`reverse_all: 1` or targeted reversal)

### Phase 2: Commission Engine (`lib/payments/commission-engine.js`)
- Integer-paise calculations: No floating-point math anywhere in monetary paths.
- Hierarchical commission resolution:
  1. Event-specific commission override
  2. Organizer-specific commission tier
  3. Global platform default commission (default: 3.00% + ₹0 fixed fee)
- Supports:
  - Percentage commission (`percentage`)
  - Fixed commission per ticket (`fixed`)
  - Compound (`percentage_plus_fixed`)
  - Minimum and maximum commission caps
  - Dedicated gateway fee allocation and GST representation
- Versioned and immutable: Snapshot stored with each payment record.

### Phase 3: Connected Accounts & Paid Event Gatekeeping (`lib/payments/connected-accounts.js`)
- Organizer onboarding state management in Firestore (`connectedAccounts` collection).
- Capability checking (`transfers_active`, `settlements_active`).
- Gatekeeper function `assertOrganizerPaidEventEligible(organizerId)`:
  - Allows free events without payment setup.
  - Blocks publishing or ticket sales for paid events if organizer has no active, verified connected account.
  - Re-evaluates on checkout to prevent race conditions (e.g., account suspended post-publishing).

### Phase 4: Financial Double-Entry Ledger (`lib/payments/ledger.js`)
- Immutable accounting entries (`ledgerEntries` collection).
- Balanced transaction rule: $\sum \text{Debits} = \sum \text{Credits}$ must hold for every financial mutation.
- Chart of Accounts:
  - `CASH_GATEWAY_CLEARING` (Asset)
  - `ORGANIZER_PAYABLE` (Liability)
  - `PLATFORM_REVENUE_COMMISSION` (Equity / Revenue)
  - `GATEWAY_FEE_EXPENSE` (Expense)
  - `TAX_GST_PAYABLE` (Liability)
  - `REFUND_CLEARING` (Contra-revenue / Liability)
- Transactional atomicity: Ledger entries created alongside payment verification or refund completion.

### Phase 5: Secure Webhook Engine & Idempotency (`lib/payments/webhook-processor.js`)
- Signature validation with raw body buffer and `RAZORPAY_WEBHOOK_SECRET`.
- Database-backed deduplication using `webhookEvents` collection:
  - Checks if event was already processed (`PROCESSED`, `IGNORED`).
  - Records execution status, retry count, and errors.
- Handled Route events:
  - `payment.captured`
  - `payment.failed`
  - `transfer.processed`
  - `transfer.failed`
  - `account.under_review`, `account.active`, `account.suspended`
  - `refund.processed`, `refund.failed`
  - `settlement.processed`

### Phase 6: Refunds & Event Cancellation Engine (`lib/payments/refunds.js`)
- Full and partial refund support.
- Automatic Route transfer reversals (`reverse_all` or partial organizer clawback).
- Cumulative refund balance checking to prevent over-refunding.
- Invalidation of issued tickets in Firestore.
- Event cancellation batch processor:
  - Iterates all paid bookings for cancelled event.
  - Triggers provider refund + transfer reversal.
  - Records balanced ledger reversals.
  - Updates booking and ticket statuses to `CANCELLED_REFUNDED`.

### Phase 7: Reconciliation Engine (`lib/payments/reconciliation.js`)
- Automated comparison between:
  - Internal orders / payments in Firestore
  - Provider transactions (Razorpay Route)
  - Internal ledger entries
- Discrepancy detector:
  - Missing payments (captured on gateway, not in local DB)
  - Missing transfers (payment captured, but transfer failed or skipped)
  - Amount mismatches (paise discrepancy between order and capture)
  - Unbalanced ledger records
- Report generation for platform superadmins.

### Phase 8: REST APIs (`src/app/api/payments/`)
- `POST /api/payments/onboarding`: Initiate connected account onboarding.
- `GET /api/payments/onboarding/status`: Query onboarding and KYC status.
- `GET /api/payments/commissions`: Get commission configurations.
- `POST /api/payments/commissions`: Admin setup for commission rules.
- `POST /api/payments/refund`: Initiate full or partial refund.
- `POST /api/payments/reconcile`: Trigger automated reconciliation run.
- Integration into existing endpoints:
  - Update `src/app/api/create-order/route.js`: Calculate marketplace splits, check organizer eligibility.
  - Update `src/app/api/verify-payment/route.js`: Execute Route transfer, record ledger entries.
  - Update `src/app/api/webhooks/razorpay/route.js`: Route webhook handling and idempotency.

### Phase 9: Frontend Dashboards
- **Organizer Dashboard (`components/admin/payments/`)**:
  - Connected account status banner (Active, Action Needed, Restricted)
  - Financial overview cards (Total Revenue, Organizer Net, Platform Fees, Refunded, Settled)
  - Transaction history table with search, status filters, and CSV export
  - Event-level revenue breakdown
- **Superadmin Dashboard (`src/app/(app)/superadmin/payments/`)**:
  - Platform-wide GMV, commissions collected, and net settlement pipeline
  - Connected accounts table with KYC review states
  - Commission rate configuration modal
  - Webhook delivery audit logs
  - Reconciliation audit runner and discrepancy inspector

### Phase 10: Testing, Verification & Regression Safety
- Unit test suite: Commission math, ledger balance invariant, refund calculations.
- Integration tests: End-to-end checkout with Route split, webhooks, cancellations.
- Regression suite: Run existing 208 Jest tests to ensure 100% compatibility.

---

## 3. Database Migration & Entity Map

| Entity | Collection Name | Key Attributes | Isolation / Security |
|---|---|---|---|
| Connected Account | `connectedAccounts` | `organizerId`, `provider`, `providerAccountId`, `onboardingStatus`, `verificationStatus`, `capabilities` | Organizer tenant isolated |
| Payment | `marketplacePayments` (or extended `orders`) | `orderId`, `bookingId`, `eventId`, `organizerId`, `providerPaymentId`, `grossAmount`, `status` | Read by owner organizer/attendee |
| Payment Split | `paymentSplits` | `paymentId`, `organizerId`, `grossAmount`, `organizerAmount`, `platformCommission`, `transferStatus`, `providerTransferId` | Read by owner organizer & admin |
| Commission Rule | `marketplaceCommissions` | `targetType`, `targetId`, `ratePercent`, `fixedFeePaise`, `version`, `active` | Admin-only write |
| Ledger Entry | `ledgerEntries` | `transactionId`, `entryType`, `account`, `debitPaise`, `creditPaise`, `reference`, `createdAt` | Immutable, admin-only |
| Webhook Event | `webhookEvents` | `eventId`, `provider`, `eventType`, `payloadHash`, `status`, `receivedAt` | System/admin |
| Refund | `marketplaceRefunds` | `paymentId`, `orderId`, `amountPaise`, `reason`, `transferReversalId`, `status` | Organizer/admin |

---

## 4. Safety, Rollback & Feature Flag Strategy
1. **Feature Flags**:
   - `RAZORPAY_ROUTE_ENABLED=false`: When false, platform runs in standard direct merchant mode (fallback), allowing existing operations to continue unhindered.
   - `RAZORPAY_ACCOUNT_ONBOARDING_ENABLED=false`: Controls whether organizers see the live onboarding flow vs. preview/read-only mode.
2. **Backward Compatibility**:
   - Free event registrations do not touch any payment or connected account logic.
   - Existing orders and tickets maintain their fields without disruption.
   - Existing ambassador commission logic (`lib/commissions.js`) remains completely intact.
