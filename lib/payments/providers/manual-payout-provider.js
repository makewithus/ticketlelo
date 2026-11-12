/**
 * TicketLelo Independent Settlement & Payout Management System
 * Manual Payout Provider (Mode B - Operational Default)
 *
 * Facilitates Super Admin review and manual bank transfer / UPI execution through
 * TicketLelo's business banking channels without dependency on Razorpay Route.
 */

import { PayoutProvider } from '../payout-provider-interface.js';
import { validateUpiId, validateBankName } from '../payout-constants.js';

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_NUMBER_REGEX = /^\d{8,18}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export class ManualPayoutProvider extends PayoutProvider {
  constructor() {
    super('manual');
  }

  /**
   * Mode B: Manual disbursements by Super Admin through business banking
   */
  supportsAutomatedPayouts() {
    return false;
  }

  /**
   * Validates payout destination bank/UPI details
   */
  async verifyPayoutAccount(accountDetails = {}) {
    const {
      accountHolderName,
      accountNumber,
      ifsc,
      upiId,
      bankName,
      pan,
    } = accountDetails;

    // Must have either a valid Bank Account (Holder + Account Number + IFSC) or a valid UPI ID
    const hasBank = Boolean(accountNumber && ifsc);
    const hasUpi = Boolean(upiId);

    if (!hasBank && !hasUpi) {
      return {
        isValid: false,
        error: 'Either complete Bank Account details (Account Number & IFSC) or a valid UPI ID must be provided.',
      };
    }

    if (hasBank) {
      const cleanAcc = String(accountNumber).trim();
      const cleanIfsc = String(ifsc).trim().toUpperCase();

      if (!ACCOUNT_NUMBER_REGEX.test(cleanAcc)) {
        return {
          isValid: false,
          error: 'Invalid bank account number. Must be between 8 and 18 numeric digits.',
        };
      }

      if (!IFSC_REGEX.test(cleanIfsc)) {
        return {
          isValid: false,
          error: 'Invalid IFSC code format. Expected 4 letters, zero, and 6 alphanumeric characters (e.g., HDFC0001234).',
        };
      }

      if (bankName && !validateBankName(bankName)) {
        return {
          isValid: false,
          error: `Unrecognized bank name: ${bankName}`,
        };
      }
    }

    if (hasUpi) {
      const cleanUpi = String(upiId).trim().toLowerCase();
      if (!validateUpiId(cleanUpi)) {
        return {
          isValid: false,
          error: 'Invalid UPI ID format. Expected user@bank handle.',
        };
      }
    }

    if (pan) {
      const cleanPan = String(pan).trim().toUpperCase();
      if (!PAN_REGEX.test(cleanPan)) {
        return {
          isValid: false,
          error: 'Invalid PAN format. Expected 5 letters, 4 digits, and 1 letter (e.g., ABCDE1234F).',
        };
      }
    }

    return {
      isValid: true,
      normalizedDetails: {
        accountHolderName: (accountHolderName || '').trim(),
        accountNumber: accountNumber ? String(accountNumber).trim() : null,
        ifsc: ifsc ? String(ifsc).trim().toUpperCase() : null,
        bankName: bankName ? String(bankName).trim() : null,
        upiId: upiId ? String(upiId).trim().toLowerCase() : null,
        pan: pan ? String(pan).trim().toUpperCase() : null,
      },
    };
  }

  /**
   * Processes manual payout confirmation by recording UTR and bank transfer details
   */
  async processPayout({
    payoutId,
    settlementId,
    organizerId,
    amountPaise,
    currency = 'INR',
    recipientDetails = {},
    reference,
    paymentMode = 'MANUAL_BANK_TRANSFER',
    receiptUrl = null,
    remarks = '',
    adminUser = null,
  }) {
    if (!reference || !String(reference).trim()) {
      throw new Error('[ManualPayoutProvider] A valid UTR / Bank Reference number is required to confirm manual payout.');
    }

    const cleanUtr = String(reference).trim();
    const now = new Date().toISOString();

    return {
      providerPayoutId: cleanUtr,
      status: 'SETTLED',
      amountPaise: Math.round(Number(amountPaise)),
      currency,
      utr: cleanUtr,
      paymentMode,
      receiptUrl,
      remarks,
      processedBy: adminUser?.email || 'superadmin',
      processedAt: now,
      raw: {
        payoutId,
        settlementId,
        organizerId,
        recipientDetails,
        recordedAt: now,
      },
    };
  }

  /**
   * Retrieves status of manual payout (returns recorded state)
   */
  async getPayoutStatus(providerPayoutId) {
    if (!providerPayoutId) {
      throw new Error('[ManualPayoutProvider] providerPayoutId / UTR is required');
    }

    return {
      providerPayoutId,
      status: 'SETTLED',
      utr: providerPayoutId,
      amountPaise: 0,
      raw: { manual: true },
    };
  }

  /**
   * Cancels or holds a manual payout
   */
  async cancelOrHoldPayout(providerPayoutId, reason) {
    return {
      success: true,
      status: 'ON_HOLD',
      message: reason || 'Payout placed on hold by administrator.',
    };
  }
}
