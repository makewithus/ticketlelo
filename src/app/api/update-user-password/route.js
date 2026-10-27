import { NextResponse } from "next/server";

/** Password changes must use Firebase Auth's client-side reauthentication flow. */
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is disabled. Use Firebase Authentication password recovery or reauthenticate to change your password." },
    { status: 410 },
  );
}
