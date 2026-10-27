import { NextResponse } from "next/server";
import { adminAuth, isFirebaseAdminReady } from "@/lib/firebase-admin";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 5,
};

export async function POST(request) {
  if (!isFirebaseAdminReady() || !adminAuth) {
    return NextResponse.json({ error: "Identity service unavailable" }, { status: 503 });
  }
  try {
    const { idToken } = await request.json();
    if (typeof idToken !== "string" || !idToken) {
      return NextResponse.json({ error: "Firebase ID token required" }, { status: 400 });
    }
    await adminAuth.verifyIdToken(idToken, true);
    const session = await adminAuth.createSessionCookie(idToken, {
      expiresIn: cookieOptions.maxAge * 1000,
    });
    const response = NextResponse.json({ success: true });
    response.cookies.set("__session", session, cookieOptions);
    return response;
  } catch {
    return NextResponse.json({ error: "Could not establish session" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("__session", "", { ...cookieOptions, maxAge: 0 });
  return response;
}
