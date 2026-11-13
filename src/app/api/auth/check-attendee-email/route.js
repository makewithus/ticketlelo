import { NextResponse } from "next/server";
import { checkRestrictedAttendeeEmail } from "@/lib/auth-server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Validates whether an attendee email is eligible to register for an event.
 * Rejects organiser and superAdmin accounts before payment or registration.
 * POST /api/auth/check-attendee-email
 * Body: { email: string }
 */
export async function POST(request) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = checkRateLimit({
      key: `check_attendee_email_ip:${clientIp}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!ipLimit.allowed) {
      return NextResponse.json({ isRestricted: false, role: "user" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!rawEmail || !rawEmail.includes("@")) {
      return NextResponse.json({ isRestricted: false, role: "user" });
    }

    const result = await checkRestrictedAttendeeEmail(rawEmail);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[check-attendee-email] Validation error:", error);
    return NextResponse.json({ isRestricted: false, role: "user" }, { status: 500 });
  }
}

