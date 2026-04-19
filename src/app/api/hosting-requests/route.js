import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/hosting-requests
 * Fetch all hosting requests using Admin SDK (bypasses Firestore rules).
 * Used by the admin dashboard.
 */
export async function GET() {
  try {
    if (!adminDb) {
      // Fallback when Admin SDK is not initialized (local dev without credentials)
      return NextResponse.json({
        requests: [],
        warning: "Admin SDK not initialized",
      });
    }

    const snapshot = await adminDb
      .collection("hostingRequests")
      .orderBy("createdAt", "desc")
      .get();

    const requests = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Serialize Firestore Timestamps to ISO strings so they are JSON-safe
      return {
        id: doc.id,
        ...data,
        createdAt:
          data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? null,
        updatedAt:
          data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt ?? null,
      };
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Error fetching hosting requests via Admin SDK:", error);
    return NextResponse.json(
      { error: "Failed to fetch hosting requests", requests: [] },
      { status: 500 },
    );
  }
}
