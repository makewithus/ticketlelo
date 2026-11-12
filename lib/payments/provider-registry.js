import { PAYMENT_PROVIDERS, PAYOUT_PROVIDERS } from './types.js';
import { RazorpayRouteProvider } from './providers/razorpay-route.js';
import { CashfreeEasySplitProvider } from './providers/cashfree-split.js';
import { ManualPayoutProvider } from './providers/manual-payout-provider.js';

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.payoutProviders = new Map();
    this._initializeDefaultProviders();
  }

  _initializeDefaultProviders() {
    // Legacy payment split providers (retained strictly for reading historical transactions)
    this.providers.set(PAYMENT_PROVIDERS.RAZORPAY_ROUTE, new RazorpayRouteProvider());
    this.providers.set(PAYMENT_PROVIDERS.CASHFREE_EASY_SPLIT, new CashfreeEasySplitProvider());

    // Independent Payout Providers (Mode B manual default, extensible for Mode A)
    this.payoutProviders.set(PAYOUT_PROVIDERS.MANUAL, new ManualPayoutProvider());
  }

  /**
   * Register or override a payment provider implementation (useful for tests and mock injection)
   */
  register(name, providerInstance) {
    this.providers.set(name, providerInstance);
  }

  /**
   * Register or override an independent payout provider (Mode A / Mode B)
   */
  registerPayoutProvider(name, providerInstance) {
    this.payoutProviders.set(name, providerInstance);
  }

  /**
   * Retrieve a specific payment provider instance
   */
  get(name = PAYMENT_PROVIDERS.RAZORPAY_ROUTE) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`[PaymentRegistry] Provider '${name}' is not registered`);
    }
    return provider;
  }

  /**
   * Retrieve a specific payout provider instance
   */
  getPayoutProvider(name = PAYOUT_PROVIDERS.MANUAL) {
    const provider = this.payoutProviders.get(name);
    if (!provider) {
      throw new Error(`[PaymentRegistry] Payout Provider '${name}' is not registered`);
    }
    return provider;
  }

  /**
   * Get the primary active payment provider (retained for backward compatibility)
   */
  getDefault() {
    return this.get(PAYMENT_PROVIDERS.RAZORPAY_ROUTE);
  }

  /**
   * Get the primary active payout provider (Default: Mode B Manual Payout Provider)
   */
  getDefaultPayoutProvider() {
    return this.getPayoutProvider(PAYOUT_PROVIDERS.MANUAL);
  }

  /**
   * Check if marketplace Route routing is currently active
   * Permanently false: Razorpay Route / Linked accounts removed.
   */
  isRouteActive() {
    return false;
  }

  /**
   * Check if organizer marketplace linked account onboarding is enabled
   * Permanently false: Organizers submit bank/UPI payout details directly.
   */
  isOnboardingActive() {
    return false;
  }
}

export const paymentRegistry = new ProviderRegistry();
export const getPaymentProvider = (name) => paymentRegistry.get(name);
export const getDefaultPaymentProvider = () => paymentRegistry.getDefault();
export const getPayoutProvider = (name) => paymentRegistry.getPayoutProvider(name);
export const getDefaultPayoutProvider = () => paymentRegistry.getDefaultPayoutProvider();
