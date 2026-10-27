/**
 * Centralized Pricing, Tax, and Platform Fee Engine
 * Authoritative: Calculates base ticket price, coupon discounts, 18% GST, 2.5% convenience fee,
 * and organizer settlement (P07, PAYMENT-001–015, DEC-03).
 */

export const GST_RATE = 0.18; // 18% GST
export const PLATFORM_FEE_RATE = 0.025; // 2.5% platform convenience fee

/**
 * Calculates itemized invoice breakdown for ticket checkout.
 * 
 * Supports two pricing conventions:
 * 1. Tax-exclusive (default standard):
 *    Base -> Discount -> Taxable -> +18% GST -> +2.5% Fee -> Payable
 * 2. Tax-inclusive (canonical PRAROHA walkthrough):
 *    Total listed price (e.g. ₹499 - 10% coupon = ₹449.10) includes GST & Fee breakdown.
 */
export function calculateOrderPricing({
  basePrice = 0,
  quantity = 1,
  discountAmount = 0,
  coupon = null,
  isTaxInclusive,
  taxInclusive,
} = {}) {
  const effectiveTaxInclusive = isTaxInclusive !== undefined 
    ? Boolean(isTaxInclusive) 
    : (taxInclusive !== undefined ? Boolean(taxInclusive) : true);
  const qty = Math.max(1, Number(quantity) || 1);
  const grossBase = Number(basePrice || 0) * qty;

  let computedDiscount = Number(discountAmount) || 0;
  if (coupon) {
    if (coupon.discountType === "percentage") {
      computedDiscount = (grossBase * (Number(coupon.discountValue) || 0)) / 100;
    } else if (coupon.discountType === "flat" || coupon.discountValue) {
      computedDiscount = Number(coupon.discountValue) || 0;
    }
  }

  const discount = Math.min(grossBase, Math.max(0, computedDiscount));
  const netDiscounted = Math.max(0, grossBase - discount);

  let taxableAmount = 0;
  let gstAmount = 0;
  let platformFee = 0;
  let finalPayable = 0;

  if (effectiveTaxInclusive) {
    // Tax-inclusive: netDiscounted is the final payable total
    finalPayable = Math.round(netDiscounted * 100) / 100;
    
    // Decompose into base, GST (18%), and platform fee (2.5%)
    // finalPayable = taxable * (1 + 0.18 + 0.025) = taxable * 1.205
    taxableAmount = Math.round((finalPayable / (1 + GST_RATE + PLATFORM_FEE_RATE)) * 100) / 100;
    gstAmount = Math.round(taxableAmount * GST_RATE * 100) / 100;
    platformFee = Math.round((finalPayable - taxableAmount - gstAmount) * 100) / 100;
  } else {
    // Tax-exclusive: adds 18% GST and 2.5% fee on top of discounted amount
    taxableAmount = netDiscounted;
    gstAmount = Math.round(taxableAmount * GST_RATE * 100) / 100;
    platformFee = Math.round(taxableAmount * PLATFORM_FEE_RATE * 100) / 100;
    finalPayable = Math.round((taxableAmount + gstAmount + platformFee) * 100) / 100;
  }

  // Net organizer settlement = Gross payable minus platform convenience fee
  const organizerSettlement = Math.max(0, Math.round((finalPayable - platformFee) * 100) / 100);

  return {
    grossBase,
    discount,
    discountAmount: discount,
    taxableAmount,
    baseAmount: taxableAmount,
    gstRate: GST_RATE,
    gstAmount,
    platformFeeRate: PLATFORM_FEE_RATE,
    platformFee,
    finalPayable,
    finalPayableAmount: finalPayable,
    finalPayablePaise: Math.round(finalPayable * 100),
    organizerSettlement,
  };
}

export const calculatePricing = calculateOrderPricing;
