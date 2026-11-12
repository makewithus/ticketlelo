import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { approveAmbassadorApplication } from "@/lib/creator-campus/programs-service";
import { notifyAmbassadorApproved } from "@/lib/creator-campus/notifications";

export async function POST(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId, applicationId } = await params;

    const emailLower = (caller.email || "").toLowerCase().trim();
    const isSuper =
      caller.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com";

    const result = await approveAmbassadorApplication({
      applicationId,
      callerUid: caller.uid,
      isSuper,
    });

    // Send approval notification
    try {
      const appDoc = await adminDb.collection("ambassadorApplications").doc(applicationId).get();
      const progDoc = await adminDb.collection("ambassadorPrograms").doc(programId).get();
      if (appDoc.exists && progDoc.exists) {
        const aData = appDoc.data();
        const pData = progDoc.data();
        await notifyAmbassadorApproved({
          email: aData.email,
          name: aData.fullName,
          programTitle: pData.title || "Campus Ambassador Program",
          referralCode: result.referralCode,
          referralLink: `/discover?ref=${result.referralCode}`,
          programId,
        });
      }
    } catch (notifErr) {
      console.warn("[approve] Notification dispatch warning:", notifErr?.message);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/organizer/.../approve POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to approve application" }, { status: 500 });
  }
}

