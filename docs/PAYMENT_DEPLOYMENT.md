# TicketLelo Payment Deployment & Production Activation Checklist

## 1. Environment Configuration Checklist
Ensure the following variables are configured in the deployment environment (e.g. Vercel / Cloud Run / VPS):

| Variable | Staging / Test | Production | Purpose |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | `rzp_test_xxxxxx` | `rzp_live_xxxxxx` | Razorpay API Key ID |
| `RAZORPAY_KEY_SECRET` | `xxxxxx` (Test secret) | `xxxxxx` (Live secret) | Strictly server-only key secret |
| `RAZORPAY_WEBHOOK_SECRET` | `whsec_test_xxxxxx` | `whsec_live_xxxxxx` | Webhook HMAC signing secret |
| `RAZORPAY_ROUTE_ENABLED` | `true` | `false` (until approved) | Enables Route splits and gatekeeping |
| `RAZORPAY_ACCOUNT_ONBOARDING_ENABLED` | `true` | `false` (until approved) | Enables creator live onboarding |
| `RAZORPAY_ENVIRONMENT` | `test` | `production` | Environment indicator |
| `CASHFREE_EASY_SPLIT_ENABLED` | `false` | `false` | Future provider flag |

---

## 2. Production Activation Steps
1. **Commercial Approval**: Verify that TicketLelo's Razorpay Route marketplace feature is activated on the production merchant dashboard.
2. **KYC Document Checklist**: Ensure TicketLelo's platform aggregator KYC documentation is approved by Razorpay Risk Operations.
3. **Webhook Setup**:
   - URL: `https://ticketlelo.in/api/webhooks/razorpay`
   - Secret: Generated high-entropy secret matching `RAZORPAY_WEBHOOK_SECRET`
   - Active Events:
     - `payment.captured`
     - `payment.failed`
     - `transfer.processed`
     - `transfer.failed`
     - `account.activated`
     - `account.under_review`
     - `account.suspended`
     - `settlement.processed`
     - `refund.processed`
4. **Feature Flag Flip**: Once provider activation is verified, update `RAZORPAY_ROUTE_ENABLED=true` and `RAZORPAY_ACCOUNT_ONBOARDING_ENABLED=true`.
5. **Initial Pilot**: Test with a closed beta organizer before general public enablement.
