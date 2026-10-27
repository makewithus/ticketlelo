import { getAuthenticatedUser } from "@/lib/auth-server";
import { ownsResource } from "@/lib/access-policy";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { generateTaxInvoiceData } from "@/lib/invoices";

export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!adminDb) return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    const { orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    // Try finding order in orders collection or registrations
    let order = null;
    const orderDoc = await adminDb.collection("orders").doc(orderId).get();

    if (orderDoc.exists) {
      order = { id: orderDoc.id, ...orderDoc.data() };
    } else {
      // Fallback search in registrations
      const regSnapshot = await adminDb
        .collection("registrations")
        .where("orderId", "==", orderId)
        .limit(1)
        .get();

      if (!regSnapshot.empty) {
        const reg = regSnapshot.docs[0].data();
        order = {
          id: orderId,
          amount: reg.amountPaid || reg.amount || 0,
          buyerName: reg.fullName || reg.formData?.fullName,
          buyerEmail: reg.email || reg.formData?.email,
          buyerPhone: reg.whatsappPhone || reg.formData?.whatsappPhone,
          ticketTitle: reg.ticketTier || reg.ticketType || "Event Registration",
          createdAt: reg.createdAt,
          status: reg.paymentStatus || "PAID",
          eventId: reg.eventId,
        };
      }
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!ownsResource(caller, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let event = {};
    if (order.eventId) {
      const eventDoc = await adminDb.collection("events").doc(order.eventId).get();
      if (eventDoc.exists) {
        event = eventDoc.data();
      }
    }

    const invoiceData = generateTaxInvoiceData({
      order,
      event,
      attendee: {
        fullName: order.buyerName,
        email: order.buyerEmail,
        phone: order.buyerPhone,
      },
    });

    return NextResponse.json({
      success: true,
      invoice: invoiceData,
    });
  } catch (error) {
    console.error("[INVOICE_GENERATION_ERROR]", error?.message || error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
