import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { updateProgramStatus } from "@/lib/creator-campus/programs-service";

export async function PATCH(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({ error: "Target status is required" }, { status: 400 });
    }

    const emailLower = (caller.email || "").toLowerCase().trim();
    const isSuper =
      caller.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com";

    const updated = await updateProgramStatus(programId, status, caller.uid, isSuper);
    return NextResponse.json({ success: true, program: updated });
  } catch (err) {
    console.error("[api/organizer/programs/[programId]/status PATCH] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update lifecycle status" }, { status: 500 });
  }
}
