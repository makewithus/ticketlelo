import { NextResponse } from "next/server";
import { verifyAndProcessResendWebhook } from "@/lib/email/webhook-handler";

/**
 * Resend Webhook Handler
 * POST /api/webhooks/resend
 *
 * Verifies Svix cryptographic signatures and idempotently updates
 * email job lifecycle events (sent, delivered, bounced, complained).
 */
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const result = await verifyAndProcessResendWebhook(rawBody, request.headers);
    return NextResponse.json(result);
  } catch (error) {
    const isSignatureError = error.message.includes("signature");
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: isSignatureError ? 401 : 500 }
    );
  }
}
