import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/analytics/[eventId]
 * Returns complete analytics data for an event
 */
export async function GET(request, { params }) {
  try {
    const eventId = params.eventId;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
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

    // Authorization check
    if (userId && event.createdBy !== userId) {
      const userDoc = await adminDb.collection("users").doc(userId).get();
      const user = userDoc.data();
      if (user?.role !== "superAdmin" && !user?.isAdmin) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 403 },
        );
      }
    }

    // Get all registrations for this event
    const registrationsSnapshot = await adminDb
      .collection("registrations")
      .where("eventId", "==", eventId)
      .get();

    const registrations = [];
    registrationsSnapshot.forEach((doc) => {
      registrations.push({ id: doc.id, ...doc.data() });
    });

    // ======= Calculate Analytics =======

    // 1. Total registrations
    const totalRegistrations = registrations.length;

    // 2. Revenue calculation
    const ticketPrice = event.ticketPrice || 0;
    const isPaid = event.isPaid || ticketPrice > 0;
    const completedRegistrations = registrations.filter(
      (r) => r.paymentStatus === "completed" || !isPaid,
    );
    const totalRevenue = isPaid
      ? completedRegistrations.reduce(
          (sum, r) => sum + (r.amount || ticketPrice),
          0,
        )
      : 0;

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
      completed: registrations.filter((r) => r.paymentStatus === "completed")
        .length,
      pending: registrations.filter((r) => r.paymentStatus === "pending")
        .length,
      failed: registrations.filter((r) => r.paymentStatus === "failed").length,
      free: registrations.filter((r) => !isPaid).length,
    };

    // 5. Ticket usage stats
    const ticketStats = {
      total: totalRegistrations,
      used: registrations.filter((r) => r.status === "used").length,
      unused: registrations.filter((r) => r.status === "unused" || !r.status)
        .length,
      usageRate:
        totalRegistrations > 0
          ? Math.round(
              (registrations.filter((r) => r.status === "used").length /
                totalRegistrations) *
                100,
            )
          : 0,
    };

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
    const capacity = event.maxCapacity || null;
    const capacityUtilization = capacity
      ? Math.round((totalRegistrations / capacity) * 100)
      : null;

    return NextResponse.json({
      success: true,
      analytics: {
        summary: {
          totalRegistrations,
          totalRevenue,
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
        topDays: sortedDays,
        event: {
          id: event.id,
          name: event.name,
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
