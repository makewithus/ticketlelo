import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { createProgram } from "@/lib/creator-campus/programs-service";

export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const emailLower = (caller.email || "").toLowerCase().trim();
    const isSuper =
      caller.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com";

    let query = adminDb.collection("ambassadorPrograms");
    if (!isSuper) {
      query = query.where("organizerId", "==", caller.uid);
    }

    const snap = await query.orderBy("createdAt", "desc").get();
    const programs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ success: true, programs });
  } catch (err) {
    console.error("[api/organizer/programs GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to list programs" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const title = String(body?.title || body?.name || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Program title is required" }, { status: 400 });
    }

    const program = await createProgram({
      organizerId: caller.uid,
      title,
      name: title,
      description: body.description || "",
      college: body.college || "",
      logo: body.logo || "",
      applicationFormId: body.applicationFormId || null,
      applicationStartDate: body.applicationStartDate || body.startDate || null,
      applicationEndDate: body.applicationEndDate || body.endDate || null,
      startDate: body.startDate || body.applicationStartDate || null,
      endDate: body.endDate || body.applicationEndDate || null,
      pointsRules: body.pointsRules || null,
      referralSettings: body.referralSettings || (body.pointsRules ? {
        basePointsPerTicket: Number(body.pointsRules.basePointsPerTicket) || 10,
        paidMultiplier: Number(body.pointsRules.paidMultiplier) || 2,
        freePoints: Number(body.pointsRules.basePointsPerTicket) || 10,
        paidPoints: (Number(body.pointsRules.basePointsPerTicket) || 10) * (Number(body.pointsRules.paidMultiplier) || 2),
      } : {}),
    });

    // Auto-connect target event if selected during creation
    if (body.eventId || (Array.isArray(body.eventIds) && body.eventIds.length > 0)) {
      const eIds = Array.isArray(body.eventIds) && body.eventIds.length > 0
        ? body.eventIds
        : [body.eventId];
      try {
        const { connectEventsToProgram } = await import("@/lib/creator-campus/programs-service");
        await connectEventsToProgram({
          programId: program.id,
          eventIds: eIds,
          organizerId: caller.uid,
        });
      } catch (connErr) {
        console.warn("Could not auto-connect event during program creation:", connErr?.message);
      }
    }

    return NextResponse.json({ success: true, program }, { status: 201 });
  } catch (err) {
    console.error("[api/organizer/programs POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create program" }, { status: 500 });
  }
}

