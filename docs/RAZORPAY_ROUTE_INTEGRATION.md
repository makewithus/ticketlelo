# Razorpay Route Marketplace Integration Guide

## 1. Overview & Business Model
TicketLelo operates as a multi-organizer event ticketing marketplace. Under the **Razorpay Route** marketplace architecture:
1. Attendees make ticket payments to TicketLelo's primary Razorpay platform.
2. Verified event organizers link their Razorpay accounts via the Route Linked Accounts API.
3. Upon server-side payment verification, the attendee's payment is automatically split between TicketLelo (platform commission) and the organizer (net ticket revenue).
4. Razorpay handles the settlement directly to the organizer's linked bank account.
5. TicketLelo never holds organizer funds in its own bank account, adhering to RBI Payment Aggregator compliance guidelines.

---

## 2. Environment Variables & Feature Flags
```env
# Razorpay Platform Credentials
RAZORPAY_KEY_ID=rzp_test_placeholder_key_id
RAZORPAY_KEY_SECRET=rzp_test_placeholder_key_secret
RAZORPAY_WEBHOOK_SECRET=rzp_webhook_secret_placeholder

# Route Marketplace Controls
RAZORPAY_ROUTE_ENABLED=false
RAZORPAY_ACCOUNT_ONBOARDING_ENABLED=false
RAZORPAY_ENVIRONMENT=test
```

- **`RAZORPAY_ROUTE_ENABLED`**: When set to `false`, the platform operates in direct/fallback mode. When `true`, paid events require verified organizer accounts and execute real-time Route splits.
- **`RAZORPAY_ACCOUNT_ONBOARDING_ENABLED`**: Controls whether creators can initiate live onboarding.

---

## 3. Official Razorpay Route API Specifications

### 3.1 Linked Account Creation (`POST /v1/accounts`)
Used in `lib/payments/providers/razorpay-route.js`:
```json
{
  "email": "organizer@example.com",
  "phone": "9999999999",
  "type": "route",
  "legal_business_name": "Acme Event Management Pvt Ltd",
  "business_type": "private_limited",
  "contact_name": "Jane Doe",
  "notes": {
    "organizerId": "org_12345",
    "platform": "TicketLelo"
  }
}
```
**Response:**
Returns `id` (`acc_xxxxxx`), `status` (`created` | `activated` | `under_review`), and `capabilities`.

### 3.2 Payment Transfers / Splits (`POST /v1/payments/{payment_id}/transfers`)
Executed following server-side payment verification in `src/app/api/verify-payment/route.js`:
```json
{
  "transfers": [
    {
      "account": "acc_xxxxxx",
      "amount": 97000,
      "currency": "INR",
      "notes": {
        "orderId": "order_xxxxxx",
        "bookingId": "TKT-xxxxxx",
        "eventId": "event_123"
      }
    }
  ]
}
```
*Note: All amounts in Razorpay Route must be specified in integer paise (e.g. ₹970.00 = 97000 paise).*

### 3.3 Full & Partial Refunds with Transfer Reversals (`POST /v1/payments/{payment_id}/refund`)
When refunding a payment that was split via Route:
```json
{
  "amount": 100000,
  "reverse_all": 1,
  "notes": {
    "reason": "Attendee requested refund"
  }
}
```
Passing `reverse_all: 1` ensures that Razorpay automatically reverses the transferred organizer share proportionally back to the platform account before releasing cash to the attendee.

### 3.4 Direct Transfer Reversals (`POST /v1/transfers/{transfer_id}/reversals`)
Used for manual or specific partial reversals:
```json
{
  "amount": 48500,
  "notes": {
    "reason": "Partial organizer penalty / dispute adjustment"
  }
}
```

---

## 4. Provider Implementation Architecture
The integration is encapsulated in `lib/payments/providers/razorpay-route.js`, which extends `PaymentProvider`:
- Timing-safe HMAC-SHA256 signature verification via `crypto.timingSafeEqual`
- Separation of payment status, transfer status, and settlement status
- Strict integer paise arithmetic for all calculations
