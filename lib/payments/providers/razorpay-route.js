import crypto from 'crypto';
import Razorpay from 'razorpay';
import { PaymentProvider } from '../provider-interface.js';
import { PAYMENT_PROVIDERS, CONNECTED_ACCOUNT_STATUSES } from '../types.js';

/**
 * Razorpay Route Payment Provider Implementation
 * Follows official Razorpay Route Linked Accounts and Transfers specifications.
 */
export class RazorpayRouteProvider extends PaymentProvider {
  constructor(options = {}) {
    super(PAYMENT_PROVIDERS.RAZORPAY_ROUTE);

    this.keyId = options.keyId || process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = options.keySecret || process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = options.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '';
    this.isRouteEnabled = (options.routeEnabled !== undefined)
      ? Boolean(options.routeEnabled)
      : process.env.RAZORPAY_ROUTE_ENABLED === 'true';

    this.isOnboardingEnabled = (options.onboardingEnabled !== undefined)
      ? Boolean(options.onboardingEnabled)
      : process.env.RAZORPAY_ACCOUNT_ONBOARDING_ENABLED === 'true';

    this.client = null;
    if (this.keyId && this.keySecret) {
      this.client = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret
      });
    }
  }

  /**
   * Helper to ensure valid client initialization
   */
  _ensureClient() {
    if (!this.client) {
      throw new Error('[RazorpayRoute] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET configuration.');
    }
    return this.client;
  }

  /**
   * Onboard creator by creating a Route linked account in Razorpay
   */
  async onboardCreator(params) {
    const {
      organizerId,
      email,
      legalBusinessName,
      businessType = 'individual',
      contactName,
      phone,
      notes = {}
    } = params;

    if (!organizerId || !email || !legalBusinessName) {
      throw new Error('[RazorpayRoute] organizerId, email, and legalBusinessName are required for onboarding');
    }

    const client = this._ensureClient();

    // Map business type to Razorpay supported types:
    // individual, partnership, proprietorship, public_limited, private_limited, trust, society, etc.
    const normalizedBusinessType = ['individual', 'proprietorship', 'partnership', 'private_limited', 'public_limited', 'llp', 'ngo']
      .includes(businessType?.toLowerCase()) ? businessType.toLowerCase() : 'individual';

    const payload = {
      email,
      phone: phone || '9999999999',
      type: 'route',
      legal_business_name: legalBusinessName,
      business_type: normalizedBusinessType,
      contact_name: contactName || legalBusinessName,
      notes: {
        organizerId: String(organizerId),
        platform: 'TicketLelo',
        ...notes
      }
    };

    try {
      // Create linked account using Razorpay SDK accounts API
      // If accounts API is exposed as client.accounts.create or direct REST call
      let account;
      if (client.accounts && typeof client.accounts.create === 'function') {
        account = await client.accounts.create(payload);
      } else {
        // Fallback to direct Razorpay API request
        const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
        const res = await fetch('https://api.razorpay.com/v1/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authHeader}`
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.description || `Razorpay accounts API returned HTTP ${res.status}`);
        }
        account = await res.json();
      }

      return {
        providerAccountId: account.id,
        status: this._mapAccountStatus(account.status),
        raw: account
      };
    } catch (err) {
      console.error('[RazorpayRoute] onboardCreator error:', err.message);
      throw err;
    }
  }

  /**
   * Fetch connected account details from Razorpay
   */
  async getConnectedAccount(providerAccountId) {
    if (!providerAccountId) {
      throw new Error('[RazorpayRoute] providerAccountId is required');
    }
    const client = this._ensureClient();

    try {
      let account;
      if (client.accounts && typeof client.accounts.fetch === 'function') {
        account = await client.accounts.fetch(providerAccountId);
      } else {
        const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
        const res = await fetch(`https://api.razorpay.com/v1/accounts/${providerAccountId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authHeader}`
          }
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.description || `Razorpay fetch account returned HTTP ${res.status}`);
        }
        account = await res.json();
      }

      return {
        providerAccountId: account.id,
        status: this._mapAccountStatus(account.status),
        capabilities: account.capabilities || {},
        raw: account
      };
    } catch (err) {
      console.error('[RazorpayRoute] getConnectedAccount error:', err.message);
      throw err;
    }
  }

  /**
   * Check KYC / transfer readiness of connected account
   */
  async getAccountStatus(providerAccountId) {
    const { status, raw, capabilities } = await this.getConnectedAccount(providerAccountId);

    const isReadyForTransfers = status === CONNECTED_ACCOUNT_STATUSES.ACTIVE ||
      Boolean(capabilities?.transfers === 'active' || raw?.live === true || raw?.status === 'activated');

    const isReadyForSettlement = status === CONNECTED_ACCOUNT_STATUSES.ACTIVE ||
      Boolean(capabilities?.settlements === 'active' || raw?.status === 'activated');

    return {
      providerAccountId,
      status,
      isReadyForTransfers,
      isReadyForSettlement,
      requirements: raw?.requirements || []
    };
  }

  /**
   * Create an Order with Razorpay
   */
  async createPaymentOrder(orderData) {
    const { amountPaise, currency = 'INR', receipt, notes = {} } = orderData;
    if (!amountPaise || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
      throw new Error('[RazorpayRoute] Valid integer amountPaise is required');
    }

    const client = this._ensureClient();

    const options = {
      amount: amountPaise,
      currency,
      receipt: String(receipt || `tl_ord_${Date.now()}`),
      notes: {
        platform: 'TicketLelo',
        ...notes
      }
    };

    const order = await client.orders.create(options);
    return {
      providerOrderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      status: order.status,
      raw: order
    };
  }

  /**
   * Server-side signature verification (HMAC-SHA256)
   */
  async verifyPaymentSignature(paymentData) {
    const { providerOrderId, providerPaymentId, signature } = paymentData;
    if (!providerOrderId || !providerPaymentId || !signature) {
      return false;
    }

    const payload = `${providerOrderId}|${providerPaymentId}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const signatureBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  /**
   * Verify Webhook Signature (HMAC-SHA256)
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!rawBody || !signature || !this.webhookSecret) {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const signatureBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  /**
   * Transfer organizer share to connected account via Route
   */
  async createTransferOrSplit(providerPaymentId, splits) {
    if (!providerPaymentId) {
      throw new Error('[RazorpayRoute] providerPaymentId is required for transfer');
    }
    if (!Array.isArray(splits) || splits.length === 0) {
      throw new Error('[RazorpayRoute] At least one transfer split is required');
    }

    const client = this._ensureClient();

    const transfersPayload = {
      transfers: splits.map(s => {
        if (!s.accountId || !s.amountPaise || s.amountPaise <= 0 || !Number.isInteger(s.amountPaise)) {
          throw new Error(`[RazorpayRoute] Invalid split payload: ${JSON.stringify(s)}`);
        }
        return {
          account: s.accountId,
          amount: s.amountPaise,
          currency: s.currency || 'INR',
          notes: s.notes || {}
        };
      })
    };

    try {
      let result;
      if (client.payments && typeof client.payments.transfer === 'function') {
        result = await client.payments.transfer(providerPaymentId, transfersPayload);
      } else {
        const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
        const res = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}/transfers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authHeader}`
          },
          body: JSON.stringify(transfersPayload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.description || `Razorpay payment transfer returned HTTP ${res.status}`);
        }
        result = await res.json();
      }

      const items = result.items || (Array.isArray(result) ? result : [result]);
      return items.map(item => ({
        transferId: item.id,
        accountId: item.recipient || item.account,
        amountPaise: item.amount,
        currency: item.currency,
        status: item.status?.toUpperCase() || 'PROCESSED',
        raw: item
      }));
    } catch (err) {
      console.error('[RazorpayRoute] createTransferOrSplit error:', err.message);
      throw err;
    }
  }

  /**
   * Get status of a transfer
   */
  async getTransferStatus(transferId) {
    if (!transferId) throw new Error('[RazorpayRoute] transferId is required');
    const client = this._ensureClient();

    let transfer;
    if (client.transfers && typeof client.transfers.fetch === 'function') {
      transfer = await client.transfers.fetch(transferId);
    } else {
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const res = await fetch(`https://api.razorpay.com/v1/transfers/${transferId}`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.description || `Razorpay fetch transfer returned HTTP ${res.status}`);
      }
      transfer = await res.json();
    }

    return {
      transferId: transfer.id,
      status: transfer.status?.toUpperCase() || 'PROCESSED',
      amountPaise: transfer.amount,
      raw: transfer
    };
  }

  /**
   * Refund payment with automatic transfer reversal option
   */
  async refundPayment(providerPaymentId, refundOptions = {}) {
    if (!providerPaymentId) throw new Error('[RazorpayRoute] providerPaymentId is required for refund');
    const { amountPaise, reverseAllTransfers = true, notes = {} } = refundOptions;

    const client = this._ensureClient();
    const payload = {
      notes
    };

    if (amountPaise && Number.isInteger(amountPaise)) {
      payload.amount = amountPaise;
    }

    if (reverseAllTransfers) {
      // In Razorpay Route, passing reverse_all: 1 reverses all transfers proportionally
      payload.reverse_all = 1;
    }

    let refund;
    if (client.payments && typeof client.payments.refund === 'function') {
      refund = await client.payments.refund(providerPaymentId, payload);
    } else {
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const res = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authHeader}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.description || `Razorpay refund returned HTTP ${res.status}`);
      }
      refund = await res.json();
    }

    return {
      providerRefundId: refund.id,
      amountPaise: refund.amount,
      status: refund.status?.toUpperCase() || 'PROCESSED',
      raw: refund
    };
  }

  /**
   * Reverse an existing Route transfer
   */
  async reverseTransfer(transferId, reversalOptions = {}) {
    if (!transferId) throw new Error('[RazorpayRoute] transferId is required');
    const { amountPaise, notes = {} } = reversalOptions;

    const payload = { notes };
    if (amountPaise && Number.isInteger(amountPaise)) {
      payload.amount = amountPaise;
    }

    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/transfers/${transferId}/reversals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.description || `Razorpay transfer reversal returned HTTP ${res.status}`);
    }

    const reversal = await res.json();
    return {
      reversalId: reversal.id,
      transferId: reversal.transfer_id,
      amountPaise: reversal.amount,
      status: reversal.status?.toUpperCase() || 'PROCESSED',
      raw: reversal
    };
  }

  /**
   * Fetch settlement status
   */
  async getSettlementStatus(settlementId) {
    if (!settlementId) throw new Error('[RazorpayRoute] settlementId is required');
    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/settlements/${settlementId}`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.description || `Razorpay settlement status returned HTTP ${res.status}`);
    }
    const settlement = await res.json();
    return {
      settlementId: settlement.id,
      status: settlement.status?.toUpperCase() || 'PROCESSED',
      amountPaise: settlement.amount,
      raw: settlement
    };
  }

  /**
   * Reconcile single transaction with Razorpay
   */
  async reconcileTransaction(providerPaymentId) {
    if (!providerPaymentId) throw new Error('[RazorpayRoute] providerPaymentId is required');
    const client = this._ensureClient();
    const payment = await client.payments.fetch(providerPaymentId);

    // Fetch associated transfers if Route payment
    let transfers = [];
    try {
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const tRes = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}/transfers`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      if (tRes.ok) {
        const tData = await tRes.json();
        transfers = tData.items || [];
      }
    } catch (_ignore) {
      // Direct payment might have no transfers
    }

    return {
      providerPaymentId: payment.id,
      amountPaise: payment.amount,
      currency: payment.currency,
      status: payment.status?.toUpperCase(),
      feePaise: payment.fee || 0,
      taxPaise: payment.tax || 0,
      transfers: transfers.map(t => ({
        transferId: t.id,
        accountId: t.recipient || t.account,
        amountPaise: t.amount,
        status: t.status?.toUpperCase()
      })),
      raw: payment
    };
  }

  /**
   * Internal mapper for provider status to TicketLelo status enum
   */
  _mapAccountStatus(providerStatus) {
    if (!providerStatus) return CONNECTED_ACCOUNT_STATUSES.NOT_CONNECTED;
    switch (providerStatus.toLowerCase()) {
      case 'created':
      case 'onboarding_pending':
        return CONNECTED_ACCOUNT_STATUSES.ONBOARDING_PENDING;
      case 'under_review':
      case 'submitted':
        return CONNECTED_ACCOUNT_STATUSES.UNDER_REVIEW;
      case 'need_more_data':
      case 'kyc_pending':
        return CONNECTED_ACCOUNT_STATUSES.KYC_PENDING;
      case 'activated':
      case 'active':
        return CONNECTED_ACCOUNT_STATUSES.ACTIVE;
      case 'restricted':
        return CONNECTED_ACCOUNT_STATUSES.RESTRICTED;
      case 'rejected':
        return CONNECTED_ACCOUNT_STATUSES.REJECTED;
      case 'suspended':
        return CONNECTED_ACCOUNT_STATUSES.SUSPENDED;
      default:
        return CONNECTED_ACCOUNT_STATUSES.UNDER_REVIEW;
    }
  }
}
