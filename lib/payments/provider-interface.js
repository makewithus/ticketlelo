/**
 * TicketLelo Marketplace Payment Management System — Provider Abstract Interface
 * All payment providers (Razorpay Route, Cashfree Easy Split, etc.) must implement
 * this abstract interface to ensure complete provider independence.
 */

export class PaymentProvider {
  constructor(providerName) {
    if (new.target === PaymentProvider) {
      throw new TypeError('Cannot construct PaymentProvider instances directly');
    }
    this.name = providerName;
  }

  /**
   * Onboard creator/organizer to provider marketplace
   * @param {Object} params
   * @param {string} params.organizerId - Internal TicketLelo organizer ID
   * @param {string} params.email - Organizer business email
   * @param {string} params.legalBusinessName - Business/individual legal name
   * @param {string} params.businessType - "individual" | "partnership" | "proprietorship" | "private_limited" | "public_limited" | "llp" | "ngo"
   * @param {string} [params.phone] - Contact phone number
   * @param {Object} [params.bankAccount] - Optional bank account details if direct API provisioned
   * @returns {Promise<{ providerAccountId: string, onboardingUrl?: string, status: string, raw: Object }>}
   */
  async onboardCreator(_params) {
    throw new Error(`[${this.name}] onboardCreator() not implemented`);
  }

  /**
   * Fetch connected account details from provider
   * @param {string} _providerAccountId
   * @returns {Promise<{ providerAccountId: string, status: string, capabilities: Object, raw: Object }>}
   */
  async getConnectedAccount(_providerAccountId) {
    throw new Error(`[${this.name}] getConnectedAccount() not implemented`);
  }

  /**
   * Check KYC / settlement capability status
   * @param {string} _providerAccountId
   * @returns {Promise<{ isReadyForTransfers: boolean, isReadyForSettlement: boolean, status: string, requirements?: Array }>}
   */
  async getAccountStatus(_providerAccountId) {
    throw new Error(`[${this.name}] getAccountStatus() not implemented`);
  }

  /**
   * Create an order on the gateway
   * @param {Object} orderData
   * @param {number} orderData.amountPaise - Total amount in integer paise
   * @param {string} orderData.currency - "INR"
   * @param {string} orderData.receipt - Internal order/booking reference
   * @param {Object} [orderData.transfers] - Optional Route transfer split payloads
   * @param {Object} [orderData.notes] - Custom metadata
   * @returns {Promise<{ providerOrderId: string, amountPaise: number, currency: string, raw: Object }>}
   */
  async createPaymentOrder(_orderData) {
    throw new Error(`[${this.name}] createPaymentOrder() not implemented`);
  }

  /**
   * Verify server-side payment signature
   * @param {Object} paymentData
   * @param {string} paymentData.providerOrderId
   * @param {string} paymentData.providerPaymentId
   * @param {string} paymentData.signature
   * @returns {Promise<boolean>}
   */
  async verifyPaymentSignature(_paymentData) {
    throw new Error(`[${this.name}] verifyPaymentSignature() not implemented`);
  }

  /**
   * Execute transfer/split to organizer's connected account
   * @param {string} _providerPaymentId
   * @param {Array<{ accountId: string, amountPaise: number, currency: string, notes?: Object }>} _splits
   * @returns {Promise<Array<{ transferId: string, accountId: string, amountPaise: number, status: string, raw: Object }>>}
   */
  async createTransferOrSplit(_providerPaymentId, _splits) {
    throw new Error(`[${this.name}] createTransferOrSplit() not implemented`);
  }

  /**
   * Get status of a previously dispatched transfer
   * @param {string} _transferId
   * @returns {Promise<{ transferId: string, status: string, amountPaise: number, raw: Object }>}
   */
  async getTransferStatus(_transferId) {
    throw new Error(`[${this.name}] getTransferStatus() not implemented`);
  }

  /**
   * Initiate full or partial refund
   * @param {string} _providerPaymentId
   * @param {Object} _refundOptions
   * @param {number} _refundOptions.amountPaise - Amount in integer paise
   * @param {boolean} [_refundOptions.reverseAllTransfers] - If true, reverses organizer transfer proportion
   * @param {Array} [_refundOptions.transferReversals] - Specific transfer reversals
   * @param {Object} [_refundOptions.notes]
   * @returns {Promise<{ providerRefundId: string, amountPaise: number, status: string, raw: Object }>}
   */
  async refundPayment(_providerPaymentId, _refundOptions) {
    throw new Error(`[${this.name}] refundPayment() not implemented`);
  }

  /**
   * Reverse an existing transfer back to platform
   * @param {string} _transferId
   * @param {Object} _reversalOptions
   * @param {number} _reversalOptions.amountPaise
   * @param {Object} [_reversalOptions.notes]
   * @returns {Promise<{ reversalId: string, transferId: string, amountPaise: number, status: string, raw: Object }>}
   */
  async reverseTransfer(_transferId, _reversalOptions) {
    throw new Error(`[${this.name}] reverseTransfer() not implemented`);
  }

  /**
   * Check status of a settlement to organizer's linked bank account
   * @param {string} _settlementId
   * @returns {Promise<{ settlementId: string, status: string, amountPaise: number, raw: Object }>}
   */
  async getSettlementStatus(_settlementId) {
    throw new Error(`[${this.name}] getSettlementStatus() not implemented`);
  }

  /**
   * Fetch provider payment transaction for reconciliation
   * @param {string} _providerPaymentId
   * @returns {Promise<{ providerPaymentId: string, amountPaise: number, status: string, transfers: Array, feePaise: number, taxPaise: number, raw: Object }>}
   */
  async reconcileTransaction(_providerPaymentId) {
    throw new Error(`[${this.name}] reconcileTransaction() not implemented`);
  }
}
