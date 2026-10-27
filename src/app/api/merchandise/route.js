import { NextResponse } from "next/server";
import { createMerchandiseItem, getMerchandiseByEvent } from "@/lib/merchandise";
import { getAuthenticatedUser, requireRole } from "@/lib/auth-server";

/**
 * Merchandise API
 * GET /api/merchandise?eventId=...
 * POST /api/merchandise (Organizer role required)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const items = await getMerchandiseByEvent(eventId);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[api/merchandise] GET Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to fetch merchandise" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const caller = await requireRole(request, ["superAdmin", "organiser"]);
    const body = await request.json();
    const { eventId, productData } = body;

    if (!eventId || !productData) {
      return NextResponse.json(
        { error: "eventId and productData are required" },
        { status: 400 }
      );
    }

    const item = await createMerchandiseItem(eventId, productData);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("[api/merchandise] POST Error:", error.message);
    const status = error.message?.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to create merchandise item" },
      { status }
    );
  }
}
