# TicketLelo Payment Testing Strategy & Verification Guide

## 1. Testing Strategy
Payment reliability is guaranteed through automated unit tests, integration tests, and invariant validation:
- **Unit Tests**: Pure integer paise commission math, ledger balance invariant, refund calculations.
- **Provider Tests**: Timing-safe HMAC verification, status mapping, provider interface adherence.
- **Security Tests**: Tampered signatures, cross-tenant access rejection, unauthorized refund attempts.
- **Regression Tests**: Verified zero breakage across event creation, ticket design, QR signing, capacity reservation, and existing user journeys.

---

## 2. Test Execution
Execute the automated test suite using Node's native test runner:
```bash
npm test
```
To run specifically the marketplace payments test suite:
```bash
npm test -- -t "Marketplace Payments"
```

---

## 3. Verified Test Assertions

### Commission Engine
- 3% platform commission allocates ₹30.00 platform and ₹970.00 organizer on ₹1,000 gross.
- Fixed fee rules allocate exact flat fees.
- Compound commission (`percentage_plus_fixed`) calculates both parts accurately.
- Enforces minimum and maximum commission caps strictly.
- Zero ticket price yields zero commission.
- Rejects negative, non-integer, or floating point amounts with `TypeError`.

### Double-Entry Financial Ledger
- Balanced double-entry transactions ($\sum \text{Debits} = \sum \text{Credits}$) pass validation.
- Unbalanced transactions throw invariant violation errors.
- Empty ledger batches throw errors.
- Simultaneous debit and credit on a single account entry is rejected.

### Provider Security & Webhooks
- Verifies valid payment HMAC-SHA256 signature using `timingSafeEqual`.
- Rejects tampered signatures.
- Maps Razorpay account statuses (`created`, `activated`, `under_review`, `restricted`, `suspended`) to canonical enums.
- Verifies raw webhook signatures and rejects tampered payloads.
