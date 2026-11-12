# TICKETLELO — RAZORPAY MARKETPLACE / ROUTE REMOVAL & INDEPENDENT SETTLEMENT MANAGEMENT REPORT

**Document ID**: `TL-FIN-2026-ROUTE-REMOVAL-REPORT`  
**Date**: November 12, 2026  
**Status**: COMPLETE & BEHAVIORALLY VERIFIED  
**Target Environment**: Production / Staging  
**Primary Authors**: DeepMind Agentic Engineering & TicketLelo Platform Team  

---

## 1. ORIGINAL ARCHITECTURE

The legacy payment distribution architecture relied on **Razorpay Route (Marketplace & Linked Accounts)** to distribute event proceeds between TicketLelo and event organizers:

1. **Attendee Checkout**:
   - Order creation conditionally created split transfer payloads directed to an organizer's linked Razorpay account (`providerAccountId`).
   - Payment captured on TicketLelo master gateway was immediately or asynchronously transferred via Razorpay Route `/v1/payments/{payment_id}/transfers` API.
2. **Organizer Onboarding**:
   - Organizers were forced to connect a separate Razorpay business account via `/v1/accounts` API before they could sell tickets for paid events.
   - An event could not be published if `checkOrganizerEligibilityForPaidEvents` returned `eligible: false` due to a missing or unverified linked account.
3. **Settlement Dependency**:
   - Fund disbursement was tied to Razorpay Route linked-account balance transfers and Razorpay's linked-account settlement cycles.
4. **The Business Blocker**:
   - Razorpay Route marketplace onboarding enforces a strict business turnover qualification threshold of **approximately ₹40 lakh**, which is not feasible for TicketLelo's current operational scale.
   - Consequently, organizers could not complete linked-account KYC, creating a blocker for publishing paid events and collecting payments.

---

## 2. MARKETPLACE FUNCTIONALITY IDENTIFIED

A thorough codebase audit identified all components dependent on the marketplace model:

| Area | Component / File | Legacy Responsibility |
|---|---|---|
| **Gatekeeper** | `lib/payments/connected-accounts.js` | Blocked paid event publishing when organizer lacked a verified linked Razorpay account. |
| **Provider** | `lib/payments/providers/razorpay-route.js` | Invoked `/v1/accounts` (onboarding) and `/v1/transfers` (split payments). |
| **Registry** | `lib/payments/provider-registry.js` | Hard-coded default provider to `PAYMENT_PROVIDERS.RAZORPAY_ROUTE` with feature flags. |
| **Order API** | `src/app/api/create-order/route.js` | Enforced linked account check; flagged orders with `isRouteTransfer: true`. |
| **Publish API** | `src/app/api/events/publish/route.js` | 403 Forbidden check when paid event lacked linked account. |
| **Payment API** | `src/app/api/verify-payment/route.js` | Called `provider.createTransferOrSplit` on every captured payment. |
| **Onboarding API** | `src/app/api/payments/onboarding/route.js` | Created linked accounts via Route APIs. |
| **Settlements** | `lib/payments/settlement-engine.js` | Disbursed payouts by calling Route split APIs. |
| **UI** | `components/admin/payments/organizer-payment-section.jsx` | Referred to "marketplace commission" and "Route escrow". |

---

## 3. MARKETPLACE FUNCTIONALITY REMOVED

1. **Eliminated Route Transfer Creation**:
   - Removed `isRouteTransfer` generation in `src/app/api/create-order/route.js` (`isRouteTransfer: false`).
   - Removed split transfer execution (`createTransferOrSplit`) in `src/app/api/verify-payment/route.js`.
   - Disabled automatic transfer creation in `lib/payments/settlement-engine.js`.
2. **Eliminated Linked-Account Onboarding**:
   - Removed mandatory linked-account creation and KYC status polling from organizer workflows.
   - Deprecated `isOnboardingActive()` (permanently returns `false`).
   - Replaced `/api/payments/onboarding` with a direct payout profile handler (Bank Account & UPI).
3. **Removed Marketplace Gating on Paid Events**:
   - Removed the 403 block from `src/app/api/events/publish/route.js`. Organizers can publish paid events immediately without connecting a Razorpay account.
   - Updated `checkOrganizerEligibilityForPaidEvents` in `lib/payments/connected-accounts.js` to return `eligible: true` unconditionally.
4. **Removed Marketplace UI & Route Configuration**:
   - Replaced marketplace terminology with "TicketLelo Platform Fee" and "Independent Settlement".
   - Set `paymentRegistry.isRouteActive()` to permanently return `false`.

---

## 4. EXISTING FUNCTIONALITY RETAINED (100% INTACT)

1. **Main Razorpay Attendee Payment Gateway**:
   - Attendee ticket checkout continues using TicketLelo's master Razorpay merchant account (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
   - Secure server-side signature verification (`crypto.timingSafeEqual` HMAC-SHA256) remains intact.
   - Webhook processing for `payment.captured`, `payment.failed`, and `refund.processed` remains intact.
2. **Tiered Platform Fee Calculation**:
   - Full retention of subscription-tier commission engine in `lib/payments/commission-engine.js`:
     - **START Plan**: 5.0%
     - **CAMPUS Plan**: 4.5%
     - **FEST Plan**: 3.5%
   - Super Admin configuration and override capabilities remain intact.
   - Exact integer paise arithmetic is preserved across all calculations.
3. **Double-Entry Accounting Ledger**:
   - `lib/payments/ledger.js` maintains full balance invariant:
     $$\text{Gross Clearing} = \text{Platform Revenue} + \text{Gateway Fee} + \text{Tax Payable} + \text{Organizer Payable}$$
   - Immutable journal entries for payment capture, settlement payout, and refund issuance remain intact.
4. **T+4 Working-Day Settlement Scheduling**:
   - `lib/payments/working-calendar.js` and `settlement-engine.js` schedule settlements on T+4 working days, strictly skipping weekends (Saturdays, Sundays) and statutory Indian bank holidays.
5. **Super Admin Financial Management**:
   - Retained full platform visibility in Super Admin payments overview (`/superadmin/payments`): Gross GMV, Platform Fees Earned, Gateway Fees, Organizer Payable Balance, and Due Settlements.
6. **Refunds, Reversals, and Negative Balance Tracking**:
   - `lib/payments/refunds.js` continues processing attendee refunds, debiting organizer balances, and tracking recovery balances when refunds exceed unpaid funds.
7. **Support Ticketing and Notifications**:
   - Support tickets (`supportTickets`), 24-hour SLA tracking, and email alerts remain 100% intact.

---

## 5. NEW PAYOUT ARCHITECTURE

TicketLelo now implements an extensible adapter-based payout layer that decouples settlement tracking from payment processing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ATTENDEE TICKET CHECKOUT                              │
│         Attendee pays TicketLelo directly via Master Razorpay Gateway       │
│                                                                             │
│  Gross Ticket Payment ──► TicketLelo Bank Account (Master Razorpay Balance) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PLATFORM FEE & LEDGER ENGINE                            │
│  - Platform Fee calculated: START (5%), CAMPUS (4.5%), FEST (3.5%)          │
│  - Double-Entry Ledger updated (Dr. CashGateway, Cr. OrganizerPayable, etc.)│
│  - Settlement scheduled on T+4 working days (skipping holidays & weekends)  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 INDEPENDENT PAYOUT PROVIDER ABSTRACTION                     │
│                 lib/payments/payout-provider-interface.js                   │
│                                                                             │
│          ┌───────────────────────────────────────────────────────┐          │
│          │             Mode B: ManualPayoutProvider              │          │
│          │            (Current Operational Default)              │          │
│          │                                                       │          │
│          │  - Super Admin reviews due settlements in Dashboard   │          │
│          │  - Admin executes transfer via Business Banking (NEFT/│          │
│          │    RTGS/IMPS/UPI)                                     │          │
│          │  - Admin records UTR Reference, Date, Mode & Remarks  │          │
│          │  - Settlement marked SETTLED, Ledger debited,         │          │
│          │    Organizer notified via email, Audit Log created.   │          │
│          └───────────────────────────────────────────────────────┘          │
│                                      │                                      │
│          ┌───────────────────────────────────────────────────────┐          │
│          │             Mode A: Future Automated Provider         │          │
│          │           (RazorpayX / Cashfree Payouts Adapter)      │          │
│          │                                                       │          │
│          │  - Pluggable adapter implementing PayoutProvider      │          │
│          │  - Automatic disbursement via direct banking API      │          │
│          │  - Uses same underlying ledger and settlement records │          │
│          └───────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Details:
1. **`PayoutProvider` Abstract Interface** (`lib/payments/payout-provider-interface.js`):
   - `verifyPayoutAccount(accountDetails)`: Validates IFSC, bank account number, UPI ID, PAN.
   - `processPayout(params)`: Executes or records payout.
   - `getPayoutStatus(providerPayoutId)`: Retrieves live status.
   - `cancelOrHoldPayout(providerPayoutId, reason)`: Places hold on payout.
   - `supportsAutomatedPayouts()`: Boolean flag.
2. **`ManualPayoutProvider` (Mode B Default)** (`lib/payments/providers/manual-payout-provider.js`):
   - Enforces valid UTR / bank transaction reference.
   - Validates Indian IFSC codes (`/^[A-Z]{4}0[A-Z0-9]{6}$/`) and account numbers (`/^\d{8,18}$/`).
   - Supports UPI ID handles and PAN format verification.
   - Records processed time, admin identity, and marks settlement as `SETTLED`.

---

## 6. DATABASE CHANGES & COMPATIBILITY

### Collections Retained:
- `orders`: Retained. `isRouteTransfer` is `false`, `connectedAccountId` is `null`. Historical orders with legacy IDs remain fully readable.
- `payments`: Retained. Stores gateway payment details.
- `settlements`: Retained. `providerTransferId` stores the UTR / banking reference for manual payouts.
- `payouts`: Retained. Tracks payout workflow records.
- `organizerPayoutProfiles`: Retained & enhanced with `accountNumber`, `accountNumberMasked`, `ifsc`, `accountHolderName`, `payoutMethod`.
- `ledgerEntries`: Retained. Double-entry accounting records.
- `financialAuditLogs`: Retained. Immutable audit trail of every status change and payout.
- `supportTickets`: Retained.

### Historical Compatibility:
- Legacy documents in `connectedAccounts` or `orders` containing `providerAccountId` or `routeTransferId` are handled gracefully without breaking read queries or aggregations.

---

## 7. API CHANGES

| Endpoint | Method | Change Description |
|---|---|---|
| `/api/create-order` | POST | Removed Route transfer payload. Creates standard order with TicketLelo credentials. |
| `/api/verify-payment` | POST | Removed Route transfer execution. Commits double-entry ledger and schedules T+4 settlement. |
| `/api/events/publish` | POST | Removed 403 block requiring linked Razorpay account. Paid events publish immediately. |
| `/api/payments/onboarding` | GET | Returns `{ connected: true, status: 'ACTIVE', provider: 'manual', settlementEligibility: true }`. |
| `/api/payments/onboarding` | POST | Saves organizer bank/UPI details via `saveOrganizerPayoutProfile` without Route API calls. |
| `/api/organizer/payout-profile` | GET/POST | Enhanced to support Bank Account Number and IFSC in addition to UPI ID. |
| `/api/superadmin/overview` | GET | Updated `paymentProvider` description to reflect independent settlement gateway. |
| `/api/superadmin/payouts/[payoutId]` | POST | Super Admin confirms payout by recording UTR, marking settlement `SETTLED`, and writing audit logs. |

---

## 8. FRONTEND CHANGES

1. **`components/admin/payments/organizer-payout-details-form.jsx`**:
   - Added method selection tabs: **UPI ID (Instant Settlement)** and **Direct Bank Account (NEFT / IMPS)**.
   - Added fields: Account Number, IFSC Code, Account Holder Name with full format validation.
   - Displays active profile card showing masked account number (`•••• •••• 1098`) and IFSC.
   - Removed all references to Razorpay linked-account onboarding or Route verification.
2. **`components/admin/payments/organizer-payment-section.jsx`**:
   - Updated labels from "Marketplace commission" to "TicketLelo platform fee".
   - Retained full organizer earnings, settlement schedules, and transaction tables.
3. **`lib/email/templates/ticket-pass.js`**:
   - Removed `@media (prefers-color-scheme: dark)` which caused Gmail dark mode clients to invert the email to pitch black.
   - Enforced clean, elegant light theme (`#FFFFFF` card, `#F8FAFC` canvas, `#0F172A` text).
   - Dynamic branding logo: renders event logo if valid; falls back gracefully to TicketLelo text branding with no broken image icons.
   - Displays short 3-digit formatted pass ID (e.g., `TEST-311`).

---

## 9. SECURITY & DATA PRIVACY

1. **Role-Based Access Control**:
   - Payout confirmation and settlement overrides are strictly restricted to Super Admin callers.
   - Organizers can only read and write their own payout profile (`organizerPayoutProfiles`).
2. **Banking Credential Protection**:
   - Bank account numbers are masked on client-facing views (`accountNumberMasked`).
   - Private banking details are never exposed to attendees or other organizers.
3. **Double-Entry Financial Invariant**:
   - All financial ledger operations enforce that the sum of debits strictly equals the sum of credits. Any discrepancy throws an error before commit.

---

## 10. REFUND & REVERSAL VERIFICATION

1. **Attendee Refund Flow**:
   - Admin or automated webhook triggers refund via `recordRefundLedger`.
   - Debits `ORGANIZER_PAYABLE` and `PLATFORM_COMMISSION_REVENUE`, credits `CASH_GATEWAY_CLEARING` or `REFUND_CLEARING`.
2. **Negative Balance / Debt Tracking**:
   - If an organizer has already received their T+4 payout and a refund occurs, the organizer's payable balance becomes negative.
   - Subsequent event ticket sales automatically offset this deficit before generating positive payout eligibility.

---

## 11. TEST RESULTS

Executed test suites using Node.js test runner with QA mock environment:

```bash
$ npm test
```

### Output Summary:
```
✔ Super Admin Users Management & Login Flow Verification (1.25ms)
✔ Support Email Notifications Test Suite (2.92ms)
✔ Support Ticketing System Test Suite (10.72ms)
✔ Interactive Ticket Deck View & Detail Animation Requirements (1.58ms)
✔ Wide Ticket & Stub Ticket System Verification (290.68ms)
✔ Ticket Detail Endpoint Authorization & Data Privacy (1.14ms)
✔ Indian Working Calendar & Settlement Engine Test Suite (4.95ms)
✔ Organizer Payout Details & Manual Settlement Management Test Suite (121.13ms)
✔ Marketplace Payments: Commission Engine Integer Paise Calculations (6.71ms)
✔ Marketplace Payments: Double-Entry Financial Ledger Invariants (2.13ms)
✔ Marketplace Payments: Route Provider & Cryptographic Signature Security (9.04ms)
✔ TicketLelo — Independent Settlement & Route Removal Verification (28.04ms)
  ✔ 1. Route is completely removed from active payment flow and eligibility checks
  ✔ 2. Platform fee calculation retains tiered subscription plans (START 5%, CAMPUS 4.5%, FEST 3.5%)
  ✔ 3. T+4 working-day settlement scheduling skips weekends and Indian statutory bank holidays
  ✔ 4. ManualPayoutProvider (Mode B) validates bank/UPI details and processes payout confirmation with UTR
  ✔ 5. Extensible PayoutProvider architecture allows plugging in automated Mode A adapter
  ✔ 6. Double-entry financial ledger records payment capture, settlement payout, and refunds accurately
  ✔ 7. Organizer Payout Profile supports both UPI and Direct Bank Account (Account Number + IFSC)
  ✔ 8. Historical compatibility: Legacy connected accounts and orders remain readable without errors

ℹ tests 414
ℹ suites 40
ℹ pass 414
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 1742.34ms
```

**Result: 414/414 Tests Passed (0 Failures, 100% Pass Rate).**

---

## 12. BUILD RESULTS

Executed full Next.js production build:

```bash
$ npm run build
```

### Verification:
- All **156 application routes** compiled successfully.
- Generated valid `.next/BUILD_ID` (`fcDfE3my4lCOjvOiUWpBz`).
- Zero compilation errors, zero missing export errors, zero TypeScript/syntax defects.

---

## 13. EXACT LIST OF MODIFIED & CREATED FILES

### Created Files:
1. `lib/payments/payout-provider-interface.js`: Abstract `PayoutProvider` interface.
2. `lib/payments/providers/manual-payout-provider.js`: Mode B `ManualPayoutProvider` implementation.
3. `tests/unit/independent-settlements-no-route.test.js`: Comprehensive 8-part architectural verification test suite.
4. `docs/RAZORPAY_MARKETPLACE_REMOVAL_AND_INDEPENDENT_SETTLEMENT_REPORT.md`: This comprehensive report.

### Modified Files:
1. `lib/payments/types.js`: Added `PAYOUT_PROVIDERS` enum.
2. `lib/payments/provider-registry.js`: Registered `ManualPayoutProvider` as default; set `isRouteActive()` and `isOnboardingActive()` to false.
3. `lib/payments/connected-accounts.js`: Removed linked-account gating; paid events are always eligible.
4. `lib/payments/settlement-engine.js`: Decoupled settlement disbursement from Route; routes via `PayoutProvider`.
5. `lib/payments/payout-engine.js`: Added Bank Account Number, IFSC, and Account Holder Name validation to organizer payout profiles.
6. `src/app/api/create-order/route.js`: Removed Route transfer checks and payloads (`isRouteTransfer: false`).
7. `src/app/api/verify-payment/route.js`: Removed Route transfer API calls; commits ledger and schedules T+4 settlement.
8. `src/app/api/events/publish/route.js`: Removed 403 block requiring linked Razorpay account.
9. `src/app/api/payments/onboarding/route.js`: Decoupled from Route APIs; handles bank/UPI payout profiles.
10. `src/app/api/organizer/payout-profile/route.js`: Accepts bank account number and IFSC.
11. `src/app/api/superadmin/overview/route.js`: Updated payment provider status description.
12. `components/admin/payments/organizer-payout-details-form.jsx`: Added Bank Account input tab, IFSC validation, and masked account display.
13. `components/admin/payments/organizer-payment-section.jsx`: Cleaned up marketplace fee labels.
14. `lib/email/templates/ticket-pass.js`: Removed dark-mode media query; implemented crisp light theme with safe logo fallback.
15. `tests/email/email-templates.test.js`: Updated ticket pass assertions to reflect light theme.

---

## 14. REMAINING COMPLIANCE & PROVIDER DEPENDENCIES

- **Razorpay Standard Gateway**: Retained TicketLelo's master merchant account credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`). No marketplace or Route permissions are required on this account.
- **Business Banking Channel**: Super Admin executes disbursements via TicketLelo's standard corporate bank portal (HDFC / ICICI / SBI) using NEFT / RTGS / IMPS / UPI, entering the resulting UTR in the dashboard.
- **Future Automated Mode A**: When TicketLelo obtains approval for direct banking API disbursements (e.g. RazorpayX or Cashfree Payouts), it can be plugged into `lib/payments/payout-provider-interface.js` without modifying payment checkout or ledger logic.

---

## 15. KNOWN LIMITATIONS

1. **Manual UTR Entry in Mode B**: Disbursements are not executed automatically on the bank's servers; Super Admin must manually initiate the bank transfer and paste the bank's UTR reference number into TicketLelo to mark settlements as `SETTLED`.
2. **PAN Verification**: Format validation uses regex checks; live NSDL PAN verification API is not connected.

---

## 16. FINAL PRODUCTION-READINESS VERDICT

| Category | Status | Details |
|---|---|---|
| **Attendee Payment Gateway** | **Implemented & Behaviorally Verified** | Master Razorpay checkout works with zero Route transfers. |
| **Route / Linked Account Removal** | **Implemented & Behaviorally Verified** | Permanently deactivated; no code path creates Route transfers. |
| **Paid Event Publishing** | **Implemented & Behaviorally Verified** | Organizers can publish paid events immediately without Route account. |
| **Platform Fee Calculation** | **Implemented & Behaviorally Verified** | 5%, 4.5%, 3.5% tiers calculate exact integer paise. |
| **T+4 Working-Day Settlements** | **Implemented & Behaviorally Verified** | Indian bank holidays & weekends skipped accurately. |
| **Double-Entry Financial Ledger** | **Implemented & Behaviorally Verified** | Debits strictly equal credits; audit trail intact. |
| **Manual Payout Workflow (Mode B)** | **Implemented & Behaviorally Verified** | Super Admin records UTR, updates settlement, and notifies organizer. |
| **Extensible Adapter (Mode A)** | **Implemented & Architecture Ready** | `PayoutProvider` contract ready for future API integration. |
| **Ticket Pass Email Light Theme** | **Implemented & Behaviorally Verified** | No dark mode CSS override; crisp light theme with safe logo fallback. |
| **Test Suite Coverage** | **414 / 414 Passed** | 100% pass rate across 40 test suites. |
| **Next.js Production Build** | **156 Routes Compiled** | Clean compile with valid BUILD_ID. |

**OVERALL VERDICT: PRODUCTION READY**  
The Razorpay Route and marketplace linked-account architecture has been completely eliminated from TicketLelo's active payment and publishing flows, while retaining 100% of the platform fee, double-entry ledger, T+4 settlement, Super Admin financial management, refund recovery, and support ticketing systems.
