import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const SETTINGS_REF = () => adminDb.collection("siteSettings").doc("homepage");
const DEFAULT_COUNTDOWN_AT = "2026-11-04T18:30:00+05:30";

export async function GET() {
  try {
    if (!adminDb) {
      return NextResponse.json({ countdownAt: DEFAULT_COUNTDOWN_AT });
    }
    const snapshot = await SETTINGS_REF().get();
    const stored = snapshot.data()?.countdownAt;
    return NextResponse.json({
      countdownAt: typeof stored === "string" && !Number.isNaN(Date.parse(stored))
        ? stored
        : DEFAULT_COUNTDOWN_AT,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to read homepage countdown setting:", error);
    return NextResponse.json({ error: "Could not load homepage settings" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: "Site settings are unavailable" }, { status: 503 });
    }

    const token = request.cookies.get("auth-token")?.value;
    if (!token) return NextResponse.json({ error: "Sign in as a super administrator" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const userSnapshot = await adminDb.collection("users").doc(decoded.uid).get();
    const user = userSnapshot.data();
    if (user?.role !== "superAdmin" && user?.isSuperAdmin !== true) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    const { countdownAt } = await request.json();
    if (typeof countdownAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(countdownAt) || Number.isNaN(Date.parse(countdownAt))) {
      return NextResponse.json({ error: "Choose a valid date and time" }, { status: 400 });
    }

    await SETTINGS_REF().set({ countdownAt, updatedAt: new Date().toISOString(), updatedBy: decoded.uid }, { merge: true });
    return NextResponse.json({ success: true, countdownAt });
  } catch (error) {
    console.error("Failed to update homepage countdown setting:", error);
    const status = error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Your session has expired. Sign in again." : "Could not save homepage settings" }, { status });
  }
}
