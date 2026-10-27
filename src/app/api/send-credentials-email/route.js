import { NextResponse } from "next/server";

/** Password delivery by email is intentionally disabled. Use Firebase password recovery. */
export async function POST() {
  return NextResponse.json(
    { error: "Password delivery is disabled. Use the password recovery flow." },
    { status: 410 },
  );
}
