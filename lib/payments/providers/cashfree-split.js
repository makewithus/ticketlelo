import { PaymentProvider } from '../provider-interface.js';
import { PAYMENT_PROVIDERS } from '../types.js';

/**
 * Cashfree Easy Split Provider (Future Extension Skeleton)
 * Registered in provider architecture to support seamless multi-gateway expansion.
 */
export class CashfreeEasySplitProvider extends PaymentProvider {
  constructor(options = {}) {
    super(PAYMENT_PROVIDERS.CASHFREE_EASY_SPLIT);
    this.appId = options.appId || process.env.CASHFREE_APP_ID || '';
    this.secretKey = options.secretKey || process.env.CASHFREE_SECRET_KEY || '';
    this.isEnabled = process.env.CASHFREE_EASY_SPLIT_ENABLED === 'true';
  }

  async onboardCreator(_params) {
    throw new Error('[CashfreeEasySplit] Creator onboarding via Easy Split is pending activation in TicketLelo.');
  }

  async getConnectedAccount(_providerAccountId) {
    throw new Error('[CashfreeEasySplit] getConnectedAccount not implemented yet.');
  }

  async getAccountStatus(_providerAccountId) {
    throw new Error('[CashfreeEasySplit] getAccountStatus not implemented yet.');
  }

  async createPaymentOrder(_orderData) {
    throw new Error('[CashfreeEasySplit] createPaymentOrder not implemented yet.');
  }

  async verifyPaymentSignature(_paymentData) {
    throw new Error('[CashfreeEasySplit] verifyPaymentSignature not implemented yet.');
  }

  async createTransferOrSplit(_providerPaymentId, _splits) {
    throw new Error('[CashfreeEasySplit] createTransferOrSplit not implemented yet.');
  }

  async getTransferStatus(_transferId) {
    throw new Error('[CashfreeEasySplit] getTransferStatus not implemented yet.');
  }

  async refundPayment(_providerPaymentId, _refundOptions) {
    throw new Error('[CashfreeEasySplit] refundPayment not implemented yet.');
  }

  async reverseTransfer(_transferId, _reversalOptions) {
    throw new Error('[CashfreeEasySplit] reverseTransfer not implemented yet.');
  }

  async getSettlementStatus(_settlementId) {
    throw new Error('[CashfreeEasySplit] getSettlementStatus not implemented yet.');
  }

  async reconcileTransaction(_providerPaymentId) {
    throw new Error('[CashfreeEasySplit] reconcileTransaction not implemented yet.');
  }
}
