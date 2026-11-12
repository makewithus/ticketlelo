/**
 * TicketLelo Independent Settlement & Payout Management System
 * Payout Provider Abstract Interface (Mode A & Mode B Adapter Pattern)
 *
 * Decouples organizer settlements and bank disbursements completely from Razorpay Route.
 * - Mode A: Automated Payout Provider (Future approved direct banking / payout API)
 * - Mode B: Manual Payout Provider (Super Admin business banking transfer with UTR entry)
 */

export class PayoutProvider {
  /**
   * @param {string} providerName
   */
  constructor(providerName) {
    if (new.target === PayoutProvider) {
      throw new TypeError('Cannot construct PayoutProvider instances directly. Subclass must implement abstract methods.');
    }
    this.name = providerName;
  }

  /**
   * Returns human-readable provider name
   * @returns {string}
   */
  getProviderName() {
    return this.name;
  }

  /**
   * Indicates whether this provider performs automatic API disbursements
   * or requires manual Super Admin confirmation (Mode B).
   * @returns {boolean}
   */
  supportsAutomatedPayouts() {
    return false;
  }

  /**
   * Validates payout destination account details (IFSC, Account Number, UPI ID)
   * @param {Object} accountDetails
   * @param {string} [accountDetails.accountHolderName]
   * @param {string} [accountDetails.accountNumber]
   * @param {string} [accountDetails.ifsc]
   * @param {string} [accountDetails.upiId]
   * @param {string} [accountDetails.bankName]
   * @returns {Promise<{ isValid: boolean, error?: string, normalizedDetails?: Object }>}
   */
  async verifyPayoutAccount(_accountDetails) {
    throw new Error(`[${this.name}] verifyPayoutAccount() not implemented`);
  }

  /**
   * Process or record a settlement payout
   * @param {Object} params
   * @param {string} params.payoutId
   * @param {string} params.settlementId
   * @param {string} params.organizerId
   * @param {number} params.amountPaise
   * @param {string} [params.currency='INR']
   * @param {Object} params.recipientDetails
   * @param {string} [params.reference] - UTR / Bank Transaction Reference
   * @param {string} [params.paymentMode] - NEFT / RTGS / IMPS / UPI / MANUAL_BANK_TRANSFER
   * @param {string} [params.receiptUrl]
   * @param {string} [params.remarks]
   * @param {Object} [params.adminUser]
   * @returns {Promise<{
   *   providerPayoutId: string,
   *   status: string,
   *   amountPaise: number,
   *   utr?: string,
   *   feePaise?: number,
   *   processedAt: string,
   *   raw?: Object
   * }>}
   */
  async processPayout(_params) {
    throw new Error(`[${this.name}] processPayout() not implemented`);
  }

  /**
   * Check status of a previously initiated payout
   * @param {string} _providerPayoutId
   * @returns {Promise<{
   *   providerPayoutId: string,
   *   status: string,
   *   utr?: string,
   *   amountPaise: number,
   *   failureReason?: string,
   *   raw?: Object
   * }>}
   */
  async getPayoutStatus(_providerPayoutId) {
    throw new Error(`[${this.name}] getPayoutStatus() not implemented`);
  }

  /**
   * Cancel or hold a pending payout
   * @param {string} _providerPayoutId
   * @param {string} _reason
   * @returns {Promise<{ success: boolean, status: string, message: string }>}
   */
  async cancelOrHoldPayout(_providerPayoutId, _reason) {
    throw new Error(`[${this.name}] cancelOrHoldPayout() not implemented`);
  }
}
