import { getAuthenticatedUser } from "@/lib/auth-server";
import { managesEvent } from "@/lib/access-policy";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/analytics/[eventId]
 * Returns complete analytics data for an event
 */
export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!adminDb) return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "eventId is required" },
        { status: 400 },
      );
    }

    // Get event data
    const eventDoc = await adminDb.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    const event = eventDoc.data();

    if (!managesEvent(caller, event)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Fetch registrations, tickets, sub-events, and ambassador commissions in parallel
    const [registrationsSnapshot, ticketsSnapshot, subEventsSnapshot, commissionsSnapshot] =
      await Promise.all([
        adminDb.collection("registrations").where("eventId", "==", eventId).get(),
        adminDb.collection("tickets").where("eventId", "==", eventId).get().catch(() => ({ docs: [] })),
        adminDb.collection("subEvents").where("parentEventId", "==", eventId).get().catch(() => ({ docs: [] })),
        adminDb.collection("ambassadorCommissions").where("parentEventId", "==", eventId).get().catch(() => ({ docs: [] })),
      ]);

    const registrations = [];
    registrationsSnapshot.forEach((doc) => {
      registrations.push({ id: doc.id, ...doc.data() });
    });

    const tickets = [];
    if (ticketsSnapshot.docs) {
      ticketsSnapshot.docs.forEach((doc) => {
        tickets.push({ id: doc.id, ...doc.data() });
      });
    }

    const subEvents = [];
    if (subEventsSnapshot.docs) {
      subEventsSnapshot.docs.forEach((doc) => {
        subEvents.push({ id: doc.id, ...doc.data() });
      });
    }

    const commissions = [];
    if (commissionsSnapshot.docs) {
      commissionsSnapshot.docs.forEach((doc) => {
        commissions.push({ id: doc.id, ...doc.data() });
      });
    }

    // ======= Calculate Analytics =======

    // 1. Total registrations & Unique attendees (deduplicated by email)
    const totalRegistrations = registrations.length;
    const uniqueEmails = new Set(
      registrations
        .map((r) => (r.email || "").toLowerCase().trim())
        .filter(Boolean)
    );
    const uniqueAttendeesCount = uniqueEmails.size || totalRegistrations;

    // 2. Revenue calculation & Financial Rollup
    const ticketPrice = event.ticketPrice || 0;
    const isPaid = event.isPaid || ticketPrice > 0;
    
    // Aggregate revenue from tickets collection first (exact amounts), fallback to registrations
    let grossRevenue = 0;
    let discountsTotal = 0;

    if (tickets.length > 0) {
      tickets.forEach((t) => {
        grossRevenue += Number(t.amountPaid || 0);
        if (t.pricingBreakdown?.discountAmount) {
          discountsTotal += Number(t.pricingBreakdown.discountAmount);
        }
      });
    } else {
      const completedRegistrations = registrations.filter(
        (r) => r.paymentStatus === "completed" || r.paymentStatus === "paid" || !isPaid
      );
      grossRevenue = isPaid
        ? completedRegistrations.reduce((sum, r) => sum + (r.amount || ticketPrice), 0)
        : 0;
    }

    // Taxes (18% GST) and Platform fee (2.5%)
    const gstCollected = Math.round((grossRevenue * 0.18) * 100) / 100;
    const platformFees = Math.round((grossRevenue * 0.025) * 100) / 100;
    const netSettlement = Math.max(0, Math.round((grossRevenue - platformFees) * 100) / 100);

    // Ambassador metrics
    const ambassadorAttributedRevenue = commissions.reduce(
      (sum, c) => sum + Number(c.orderAmount || 0),
      0
    );
    const commissionLiabilities = commissions.reduce(
      (sum, c) => sum + Number(c.commissionAmount || 0),
      0
    );

    // 3. Registrations over time (last N days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const registrationsByDay = {};
    registrations.forEach((reg) => {
      const createdAt = reg.createdAt?.toDate
        ? reg.createdAt.toDate()
        : new Date(reg.createdAt);

      if (createdAt >= cutoffDate) {
        const dateKey = createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
        registrationsByDay[dateKey] = (registrationsByDay[dateKey] || 0) + 1;
      }
    });

    // Fill in missing days with 0
    const chartData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      chartData.push({
        date: dateKey,
        label: d.toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        registrations: registrationsByDay[dateKey] || 0,
        revenue: (registrationsByDay[dateKey] || 0) * ticketPrice,
      });
    }

    // 4. Payment status breakdown
    const paymentBreakdown = {
      completed: registrations.filter(
        (r) => r.paymentStatus === "completed" || r.paymentStatus === "paid"
      ).length,
      pending: registrations.filter((r) => r.paymentStatus === "pending").length,
      failed: registrations.filter((r) => r.paymentStatus === "failed").length,
      free: registrations.filter((r) => !isPaid).length,
    };

    // 5. Gate Check-In & Ticket usage stats (Case-insensitive)
    const isRecordUsed = (r) => {
      const status = (r.status || "").toLowerCase();
      const hasCheckIns = r.checkIns && Object.keys(r.checkIns).length > 0;
      return status === "used" || hasCheckIns;
    };

    const usedCount = tickets.length > 0
      ? tickets.filter(isRecordUsed).length
      : registrations.filter(isRecordUsed).length;

    const totalTicketsSold = tickets.length > 0 ? tickets.length : totalRegistrations;
    const usageRate = totalTicketsSold > 0 ? Math.round((usedCount / totalTicketsSold) * 100) : 0;

    const ticketStats = {
      total: totalTicketsSold,
      used: usedCount,
      unused: Math.max(0, totalTicketsSold - usedCount),
      usageRate,
    };

    // Station / Track check-in breakdown
    const stationCheckIns = {};
    [...tickets, ...registrations].forEach((item) => {
      if (item.checkIns && typeof item.checkIns === "object") {
        Object.keys(item.checkIns).forEach((stationId) => {
          stationCheckIns[stationId] = (stationCheckIns[stationId] || 0) + 1;
        });
      }
    });

    // Sub-event drill-down stats
    const subEventAnalytics = subEvents.map((se) => {
      const seId = se.id;
      const enrolledTickets = tickets.filter(
        (t) => Array.isArray(t.entitledSubEventIds) && t.entitledSubEventIds.includes(seId)
      );
      const admittedCount = stationCheckIns[seId] || 0;
      const seCapacity = Number(se.capacity || 0);

      return {
        id: seId,
        title: se.title,
        trackType: se.trackType,
        capacity: seCapacity,
        enrolledCount: enrolledTickets.length,
        admittedCount,
        capacityUtilization: seCapacity > 0 ? Math.round((enrolledTickets.length / seCapacity) * 100) : null,
      };
    });

    // 6. Registration trend (last 7 days vs previous 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const prev7Days = new Date();
    prev7Days.setDate(prev7Days.getDate() - 14);

    const recentRegistrations = registrations.filter((r) => {
      const date = r.createdAt?.toDate
        ? r.createdAt.toDate()
        : new Date(r.createdAt);
      return date >= last7Days;
    }).length;

    const previousRegistrations = registrations.filter((r) => {
      const date = r.createdAt?.toDate
        ? r.createdAt.toDate()
        : new Date(r.createdAt);
      return date >= prev7Days && date < last7Days;
    }).length;

    const registrationTrend =
      previousRegistrations > 0
        ? Math.round(
            ((recentRegistrations - previousRegistrations) /
              previousRegistrations) *
              100,
          )
        : recentRegistrations > 0
          ? 100
          : 0;

    // 7. Top registration days
    const sortedDays = Object.entries(registrationsByDay)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([date, count]) => ({ date, count }));

    // 8. Event capacity utilization (if max capacity set)
    const capacity = event.maxCapacity || event.capacity || null;
    const capacityUtilization = capacity
      ? Math.round((totalRegistrations / capacity) * 100)
      : null;

    return NextResponse.json({
      success: true,
      analytics: {
        summary: {
          totalRegistrations,
          uniqueAttendeesCount,
          totalRevenue: grossRevenue,
          grossRevenue,
          discountsTotal,
          gstCollected,
          platformFees,
          netSettlement,
          ambassadorAttributedRevenue,
          commissionLiabilities,
          ticketPrice,
          isPaid,
          completedPayments: paymentBreakdown.completed,
          recentRegistrations,
          registrationTrend,
          capacityUtilization,
          capacity,
        },
        chartData,
        paymentBreakdown,
        ticketStats,
        stationCheckIns,
        subEvents: subEventAnalytics,
        topDays: sortedDays,
        event: {
          id: event.id,
          name: event.name || event.title,
          date: event.date?.toDate?.()?.toISOString() || null,
          location: event.location,
        },
      },
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
