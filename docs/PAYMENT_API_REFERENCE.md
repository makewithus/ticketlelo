# TicketLelo Payment API Reference

## 1. Creator Onboarding API

### `POST /api/payments/onboarding`
Initiates Route linked account creation for an organizer.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "organizerId": "org_12345",
  "legalBusinessName": "Acme Events Pvt Ltd",
  "businessType": "private_limited",
  "email": "finance@acmeevents.com",
  "phone": "9876543210"
}
```
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Connected account onboarding initiated",
  "account": {
    "organizerId": "org_12345",
    "provider": "razorpay_route",
    "providerAccountId": "acc_xxxxxx",
    "verificationStatus": "UNDER_REVIEW",
    "settlementEligibility": false
  }
}
```

### `GET /api/payments/onboarding`
Retrieves the sanitized account status and capabilities for the organizer.
- **Query Params**: `organizerId` (optional, defaults to caller's org), `sync=true` (forces live sync with Razorpay).
- **Response**: `200 OK`

---

## 2. Commission Engine API

### `GET /api/payments/commission`
Resolves effective commission rule for an event or organizer.
- **Query Params**: `eventId`, `organizerId`.
- **Response**: `200 OK`
```json
{
  "success": true,
  "rule": {
    "version": 1,
    "targetType": "global",
    "targetId": "platform_default",
    "commissionType": "percentage",
    "ratePercent": 3.0,
    "fixedFeePaise": 0,
    "minCommissionPaise": 0,
    "currency": "INR",
    "active": true
  }
}
```

### `POST /api/payments/commission`
Superadmin endpoint to publish a versioned commission rule.
- **Role Required**: `superadmin` | `admin`
- **Request Body**:
```json
{
  "targetType": "global",
  "targetId": "platform_default",
  "commissionType": "percentage",
  "ratePercent": 3.5,
  "fixedFeePaise": 0
}
```

---

## 3. Refunds API

### `POST /api/payments/refund`
Processes full or partial refund with Route transfer reversals.
- **Request Body**:
```json
{
  "orderId": "order_xxxxxx",
  "amountPaise": 100000,
  "reason": "Customer cancellation"
}
```
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Full refund completed",
  "refund": {
    "refundId": "ref_1740000000000",
    "orderId": "order_xxxxxx",
    "amountPaise": 100000,
    "organizerRefundSharePaise": 97000,
    "platformRefundCommissionPaise": 3000,
    "providerRefundId": "rfnd_xxxxxx",
    "status": "PROCESSED"
  }
}
```

---

## 4. Reconciliation API

### `POST /api/payments/reconcile`
Superadmin endpoint to run an automated three-way financial reconciliation audit.
- **Request Body**: `{ "limit": 100 }`
- **Response**: `200 OK` Returns report summary and discrepancy details.

### `GET /api/payments/reconcile`
Fetches the 10 most recent reconciliation audit reports.

---

## 5. Summary & Rollup API

### `GET /api/payments/summary`
Fetches double-entry ledger totals and transaction history for organizer dashboard.
- **Query Params**: `organizerId`, `eventId`, `limit`.
- **Response**: `200 OK`
```json
{
  "success": true,
  "summary": {
    "grossSalesPaise": 1000000,
    "organizerNetPaise": 970000,
    "platformCommissionPaise": 30000,
    "refundedPaise": 0
  },
  "transactions": [ ... ]
}
```
