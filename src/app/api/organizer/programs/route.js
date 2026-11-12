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
    if (!body || !body.title) {
      return NextResponse.json({ error: "Program title is required" }, { status: 400 });
    }

    const program = await createProgram({
      organizerId: caller.uid,
      title: body.title,
      description: body.description || "",
      logo: body.logo || "",
      applicationFormId: body.applicationFormId || null,
      applicationStartDate: body.applicationStartDate || null,
      applicationEndDate: body.applicationEndDate || null,
      referralSettings: body.referralSettings || {},
    });

    return NextResponse.json({ success: true, program }, { status: 201 });
  } catch (err) {
    console.error("[api/organizer/programs POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create program" }, { status: 500 });
  }
}
