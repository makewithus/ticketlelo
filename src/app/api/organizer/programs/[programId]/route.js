import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { updateProgram } from "@/lib/creator-campus/programs-service";

export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;
    if (!adminDb || !programId) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const docSnap = await adminDb.collection("ambassadorPrograms").doc(programId).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const program = { id: docSnap.id, ...docSnap.data() };
    const emailLower = (caller.email || "").toLowerCase().trim();
    const isSuper =
      caller.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com";

    if (!isSuper && program.organizerId !== caller.uid && program.organizationId !== caller.uid) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch connected events count and ambassadors count
    const [eventsSnap, ambSnap, appSnap] = await Promise.all([
      adminDb.collection("programEvents").where("programId", "==", programId).where("status", "==", "connected").get(),
      adminDb.collection("programAmbassadors").where("programId", "==", programId).where("status", "==", "active").get(),
      adminDb.collection("ambassadorApplications").where("programId", "==", programId).get(),
    ]);

    const stats = {
      connectedEventsCount: eventsSnap.size,
      activeAmbassadorsCount: ambSnap.size,
      totalApplicationsCount: appSnap.size,
      pendingApplicationsCount: appSnap.docs.filter((d) => d.data().status === "pending").length,
    };

    return NextResponse.json({ success: true, program, stats });
  } catch (err) {
    console.error("[api/organizer/programs/[programId] GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch program" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;
    const body = await request.json();

    const emailLower = (caller.email || "").toLowerCase().trim();
    const isSuper =
      caller.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com";

    const updated = await updateProgram(programId, body, caller.uid, isSuper);
    return NextResponse.json({ success: true, program: updated });
  } catch (err) {
    console.error("[api/organizer/programs/[programId] PUT] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update program" }, { status: 500 });
  }
}

