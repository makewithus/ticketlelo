# TicketLelo Refund & Event Cancellation Flow

## 1. Overview
The TicketLelo refund engine (`lib/payments/refunds.js`) coordinates payment gateway refunds with Razorpay Route transfer reversals, ticket status updates, and double-entry ledger balancing.

---

## 2. Full Refund Sequence

```mermaid
sequenceDiagram
    autonumber
    actor AdminOrOrg as Organizer or Superadmin
    participant API as POST /api/payments/refund
    participant Engine as Refunds Engine (lib/payments/refunds.js)
    participant Provider as Razorpay Route Provider
    participant DB as Firestore (orders, tickets, ledgerEntries)

    AdminOrOrg->>API: Initiates refund for orderId
    API->>Engine: processMarketplaceRefund(orderId, amountPaise, reason)
    Engine->>DB: Validates order existence, status, & refundable balance
    Engine->>Provider: refundPayment(providerPaymentId, { reverseAllTransfers: true })
    Provider-->>Engine: Returns providerRefundId (rfnd_xxxxxx)
    Engine->>DB: Updates order (refundedAmountPaise, paymentStatus: 'REFUNDED')
    Engine->>DB: Marks tickets (status: 'cancelled_refunded', invalidatedAt)
    Engine->>DB: Writes balanced double-entry ledger entries
    Engine-->>API: Returns success confirmation
    API-->>AdminOrOrg: Displays refund receipt & updated balance
```

---

## 3. Partial Refunds
- The engine validates that `targetRefundPaise <= (grossPaise - previouslyRefundedPaise)`.
- Calculates proportional deduction between organizer payable and platform commission.
- Invokes provider refund.
- Updates order `paymentStatus` to `PARTIALLY_REFUNDED`.
- Cumulative refund amounts are preserved to prevent over-refunding across multiple attempts.

---

## 4. Bulk Event Cancellation Processor
When an organizer or administrator cancels an event:
1. `processEventCancellationRefunds(eventId, reason)` queries all paid orders for the event.
2. Loops through each order and executes an automated refund with Route transfer reversal.
3. Automatically revokes all issued tickets in Firestore.
4. Returns batch metrics: `{ totalOrders, successfulRefunds, failedRefunds, errors }`.
