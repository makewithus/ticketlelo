# TicketLelo Double-Entry Financial Ledger

## 1. Accounting Framework
TicketLelo implements an immutable double-entry financial ledger (`lib/payments/ledger.js`) stored in the `ledgerEntries` collection.

### Fundamental Accounting Equation
$$\sum \text{Debits} = \sum \text{Credits}$$
Every financial mutation (payment, transfer, refund, reversal) produces balanced entries. The ledger engine validates this invariant before persisting any transaction.

---

## 2. Chart of Accounts

| Account Code | Type | Normal Balance | Purpose |
|---|---|---|---|
| `CASH_GATEWAY_CLEARING` | Asset | Debit | Gross funds captured and held by Razorpay clearing account |
| `ORGANIZER_PAYABLE` | Liability | Credit | Net ticket revenues owed / routed to organizer linked accounts |
| `PLATFORM_COMMISSION_REVENUE` | Revenue | Credit | TicketLelo platform service margin |
| `GATEWAY_FEE_EXPENSE` | Expense | Debit | Payment gateway processing charges |
| `GST_TAX_PAYABLE` | Liability | Credit | Applicable GST liability on platform service fees |
| `REFUND_CLEARING` | Liability | Credit | Temporary clearing account for attendee refund flows |

---

## 3. Double-Entry Transaction Workflows

### 3.1 Ticket Payment Capture (e.g. ₹1,000 ticket with 3% commission)
- **DEBIT**: `CASH_GATEWAY_CLEARING` — ₹1,000 (100,000 paise)
- **CREDIT**: `ORGANIZER_PAYABLE` — ₹970 (97,000 paise)
- **CREDIT**: `PLATFORM_COMMISSION_REVENUE` — ₹30 (3,000 paise)
$$\text{Total Debits: } 100,000 = \text{Total Credits: } 100,000 \quad \checkmark$$

### 3.2 Full Refund Issuance (e.g. ₹1,000 refund)
- **DEBIT**: `ORGANIZER_PAYABLE` — ₹970 (97,000 paise) [Clawed back via Route reversal]
- **DEBIT**: `PLATFORM_COMMISSION_REVENUE` — ₹30 (3,000 paise) [Platform commission returned]
- **CREDIT**: `CASH_GATEWAY_CLEARING` — ₹1,000 (100,000 paise) [Cash returned to attendee]
$$\text{Total Debits: } 100,000 = \text{Total Credits: } 100,000 \quad \checkmark$$

### 3.3 Partial Refund (e.g. ₹500 partial refund on ₹1,000 ticket)
Proportionally split based on original order allocation:
- **DEBIT**: `ORGANIZER_PAYABLE` — ₹485 (48,500 paise)
- **DEBIT**: `PLATFORM_COMMISSION_REVENUE` — ₹15 (1,500 paise)
- **CREDIT**: `CASH_GATEWAY_CLEARING` — ₹500 (50,000 paise)
$$\text{Total Debits: } 50,000 = \text{Total Credits: } 50,000 \quad \checkmark$$

---

## 4. Ledger Immutability
- Finalized ledger entries cannot be modified or deleted.
- Adjustments must be recorded as new offsetting journal entries (`entryType: 'DISPUTE_ADJUSTMENT'`).
- Provides a verifiable audit trail for accounting compliance and statutory audits.
