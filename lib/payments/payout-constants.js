/**
 * TicketLelo Payouts & Settlements - Shared Constants & Pure Validators
 * Safe for both Client ("use client") and Server components.
 */

export const UPI_HANDLES = Object.freeze([
  '@ybl',
  '@oksbi',
  '@okaxis',
  '@okhdfcbank',
  '@ibl',
  '@axl',
  '@paytm',
  'Other',
]);

export const BANK_NAMES = Object.freeze([
  'State Bank of India (SBI)',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Federal Bank',
  'Punjab National Bank (PNB)',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Indian Bank',
  'IDFC FIRST Bank',
  'Other',
]);

export const PAYOUT_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  DUE: 'DUE',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  ON_HOLD: 'ON_HOLD',
  FAILED: 'FAILED',
});

/**
 * Validates a UPI username and handle, or complete UPI ID.
 *
 * Rules:
 * - Username cannot be empty.
 * - Rejects spaces and invalid characters.
 * - Validates complete UPI ID format (username@handle).
 * - Explicitly rejects ordinary phone numbers unless entered with a valid UPI handle.
 * - Provides non-ownership disclaimer.
 */
export function validateUpiId({ username = '', handle = '@ybl', customHandle = '', fullUpiId = '' } = {}) {
  const cleanUsername = String(username || '').trim();
  const cleanHandle = String(handle || '').trim();
  const cleanCustom = String(customHandle || '').trim();

  let completeId = '';

  if (cleanHandle === 'Other') {
    // Organizer entered custom handle or full UPI ID
    completeId = String(fullUpiId || cleanCustom || cleanUsername).trim();

    // Check if user entered an ordinary phone number without handle
    if (/^\d{10}$/.test(completeId) || /^\+?91\d{10}$/.test(completeId)) {
      return {
        isValid: false,
        error: 'A 10-digit phone number is not a valid UPI ID. Please include a bank or provider handle (e.g. 9876543210@paytm or adil@okhdfcbank).',
        upiId: null,
      };
    }

    if (!completeId) {
      return {
        isValid: false,
        error: 'Please enter a complete UPI ID.',
        upiId: null,
      };
    }
  } else {
    // Combined username + preset handle
    if (!cleanUsername) {
      return {
        isValid: false,
        error: 'UPI Username cannot be empty.',
        upiId: null,
      };
    }

    // Check spaces
    if (/\s/.test(cleanUsername)) {
      return {
        isValid: false,
        error: 'UPI Username cannot contain spaces.',
        upiId: null,
      };
    }

    // Rejects invalid characters in username
    if (!/^[a-zA-Z0-9.\-_]{2,64}$/.test(cleanUsername)) {
      return {
        isValid: false,
        error: 'UPI Username can only contain letters, numbers, dots, hyphens, and underscores (2-64 characters).',
        upiId: null,
      };
    }

    // Form combined ID
    completeId = `${cleanUsername}${cleanHandle.startsWith('@') ? cleanHandle : `@${cleanHandle}`}`;
  }

  // Validate complete UPI ID syntax (e.g., username@bank)
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9.\-_]{2,64}$/;
  if (!upiRegex.test(completeId)) {
    return {
      isValid: false,
      error: 'Invalid UPI ID format. Expected format: username@handle (e.g. adil123@ybl).',
      upiId: null,
    };
  }

  const [finalUser, finalHandle] = completeId.split('@');

  return {
    isValid: true,
    error: null,
    upiId: completeId.toLowerCase(),
    username: finalUser,
    handle: `@${finalHandle}`,
    disclaimer: 'Format validation does not verify account ownership or existence. Please ensure accuracy before submitting.',
  };
}

/**
 * Validates bank name selection.
 */
export function validateBankName(bankName = '', customBankName = '') {
  const cleanBank = String(bankName || '').trim();
  if (!cleanBank) {
    return { isValid: false, error: 'Bank Name is required.' };
  }

  if (cleanBank === 'Other') {
    const cleanCustom = String(customBankName || '').trim();
    if (!cleanCustom) {
      return { isValid: false, error: 'Please enter your bank name when selecting "Other".' };
    }
    return { isValid: true, bankName: cleanCustom, isCustom: true };
  }

  if (!BANK_NAMES.includes(cleanBank)) {
    return { isValid: false, error: 'Selected bank is not supported. Please choose from the list or select "Other".' };
  }

  return { isValid: true, bankName: cleanBank, isCustom: false };
}

/**
 * Generates standard UPI payment intent deep link:
 * upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...&tr=...
 */
export function generateUpiPaymentLink({ upiId, payeeName = 'TicketLelo Organizer', amountRupees, payoutRefId, note = '' }) {
  if (!upiId) throw new Error('[PayoutEngine] upiId is required for UPI link generation.');
  if (amountRupees == null || amountRupees <= 0) {
    throw new Error('[PayoutEngine] A valid positive amountRupees is required.');
  }

  const cleanAmount = Number(amountRupees).toFixed(2);
  const cleanRef = String(payoutRefId || `TKT-PO-${Date.now()}`);
  const cleanNote = String(note || `TicketLelo Payout ${cleanRef}`).substring(0, 50);

  const params = new URLSearchParams({
    pa: upiId.trim(),
    pn: (payeeName || 'Organizer').trim().substring(0, 50),
    am: cleanAmount,
    cu: 'INR',
    tn: cleanNote,
    tr: cleanRef,
  });

  return `upi://pay?${params.toString()}`;
}

