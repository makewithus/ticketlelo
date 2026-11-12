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

    const snap = await adminDb
      .collection("referralCodes")
      .where("programId", "==", programId)
      .get();

    const codes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ success: true, codes });
  } catch (err) {
    console.error("[api/organizer/referral-codes GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to list referral codes" }, { status: 500 });
  }
}
