import { PAYMENT_PROVIDERS } from './types.js';
import { RazorpayRouteProvider } from './providers/razorpay-route.js';
import { CashfreeEasySplitProvider } from './providers/cashfree-split.js';

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this._initializeDefaultProviders();
  }

  _initializeDefaultProviders() {
    this.providers.set(PAYMENT_PROVIDERS.RAZORPAY_ROUTE, new RazorpayRouteProvider());
    this.providers.set(PAYMENT_PROVIDERS.CASHFREE_EASY_SPLIT, new CashfreeEasySplitProvider());
  }

  /**
   * Register or override a provider implementation (useful for tests and mock injection)
   */
  register(name, providerInstance) {
    this.providers.set(name, providerInstance);
  }

  /**
   * Retrieve a specific provider instance
   */
  get(name = PAYMENT_PROVIDERS.RAZORPAY_ROUTE) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`[PaymentRegistry] Provider '${name}' is not registered`);
    }
    return provider;
  }

  /**
   * Get the primary active provider
   */
  getDefault() {
    return this.get(PAYMENT_PROVIDERS.RAZORPAY_ROUTE);
  }

  /**
   * Check if marketplace Route routing is currently active
   */
  isRouteActive() {
    return process.env.RAZORPAY_ROUTE_ENABLED === 'true';
  }

  /**
   * Check if organizer onboarding is enabled
   */
  isOnboardingActive() {
    return process.env.RAZORPAY_ACCOUNT_ONBOARDING_ENABLED === 'true';
  }
}

export const paymentRegistry = new ProviderRegistry();
export const getPaymentProvider = (name) => paymentRegistry.get(name);
export const getDefaultPaymentProvider = () => paymentRegistry.getDefault();
