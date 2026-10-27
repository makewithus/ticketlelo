/**
 * TicketLelo Tax Invoice & Receipt Engine
 * 
 * Provides:
 * 1. 18% GST tax invoice generation compliant with Indian Goods & Services Tax rules.
 * 2. SAC Code 999659 (Event ticketing & entertainment services).
 * 3. Itemized breakdowns: Base amount, CGST (9%), SGST (9%), Convenience Fee (2.5%), Total Payable.
 */

/**
 * Calculates itemized tax and invoice details from an order record.
 */
export function generateTaxInvoiceData({ order, event = {}, attendee = {} }) {
  const orderId = order.id || order.orderId || `ORD-${Date.now()}`;
  const invoiceNumber = `INV-${new Date().getFullYear()}-${orderId.slice(-6).toUpperCase()}`;
  const totalAmount = Number(order.pricing?.finalPayable ?? order.amount ?? order.finalPayable ?? 0);

  // If tax-inclusive (standard festival pass):
  // Total = Base + 18% GST
  // Base = Total / 1.18
  const baseAmount = Number(order.pricing?.taxableAmount ?? (totalAmount / 1.18).toFixed(2));
  const totalGst = Number(order.pricing?.gstAmount ?? (totalAmount - baseAmount).toFixed(2));
  const cgst = Number((totalGst / 2).toFixed(2));
  const sgst = Number((totalGst - cgst).toFixed(2));

  // Platform convenience fee (2.5% of base)
  const convenienceFee = Number(order.pricing?.platformFee ?? (baseAmount * 0.025).toFixed(2));

  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map((item) => ({
        name: item.title || item.name || "Festival Pass",
        sacCode: "999659",
        quantity: item.quantity || 1,
        unitPrice: item.price || baseAmount,
        taxableAmount: item.price || baseAmount,
        gstRate: "18%",
        gstAmount: Number(((item.price || baseAmount) * 0.18).toFixed(2)),
      }))
    : [
        {
          name: order.ticketTitle || event.title || "Festival Pass / Combo Track Access",
          sacCode: "999659",
          quantity: order.quantity || 1,
          unitPrice: baseAmount,
          taxableAmount: baseAmount,
          gstRate: "18%",
          gstAmount: totalGst,
        },
      ];

  return {
    invoiceNumber,
    orderId,
    invoiceDate: order.createdAt ? new Date(order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt).toISOString() : new Date().toISOString(),
    paymentStatus: order.status || "PAID",
    paymentId: order.razorpayPaymentId || order.paymentId || "ONLINE_GATEWAY",

    // Seller / Platform Details
    seller: {
      name: "TicketLelo Event Operating Platform",
      organizerName: event.organizerName || event.hostName || "Authorized Campus Organizer",
      address: event.location || "Pune, Maharashtra, India",
      gstin: process.env.PLATFORM_GSTIN || "",
      sacCode: "999659",
    },

    // Buyer Details
    buyer: {
      name: attendee.fullName || order.buyerName || "Registered Attendee",
      email: attendee.email || order.buyerEmail || "",
      phone: attendee.phone || order.buyerPhone || "",
    },

    // Financial breakdown
    lineItems: items,
    financials: {
      currency: "INR",
      subTotal: baseAmount,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: 0,
      totalGst: totalGst,
      convenienceFee: convenienceFee,
      totalPayable: totalAmount,
    },
  };
}
