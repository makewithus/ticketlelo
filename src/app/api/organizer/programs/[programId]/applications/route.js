import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

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

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "all";
    const searchQuery = (searchParams.get("q") || "").toLowerCase().trim();

    let q = adminDb.collection("ambassadorApplications").where("programId", "==", programId);
    if (statusFilter !== "all") {
      q = q.where("status", "==", statusFilter);
    }

    const snap = await q.get();
    let applications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Sort in memory by createdAt descending
    applications.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    if (searchQuery) {
      applications = applications.filter(
        (app) =>
          (app.fullName || "").toLowerCase().includes(searchQuery) ||
          (app.email || "").toLowerCase().includes(searchQuery) ||
          (app.college || "").toLowerCase().includes(searchQuery) ||
          (app.referralCode || "").toLowerCase().includes(searchQuery)
      );
    }

    return NextResponse.json({ success: true, applications });
  } catch (err) {
    console.error("[api/organizer/programs/[programId]/applications GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to list applications" }, { status: 500 });
  }
}
