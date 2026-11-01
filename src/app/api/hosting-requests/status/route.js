import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

/**
 * GET /api/hosting-requests/status
 * Real-time status lookup for hosting requests by requestId or email.
 * Bypasses client-side Firestore rule restrictions using Admin SDK.
 */
export async function GET(request) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: "Database service unavailable" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("id");
    const emailParam = searchParams.get("email");

    const caller = await getAuthenticatedUser(request);
    const targetEmail = (emailParam || caller?.email || "").trim().toLowerCase();
    const targetUserId = caller?.id || null;

    let docSnap = null;

    // 1. Try finding by ID if provided
    if (requestId) {
      try {
        const docRef = adminDb.collection("hostingRequests").doc(requestId);
        const snap = await docRef.get();
        if (snap.exists) {
          docSnap = snap;
        }
      } catch (err) {
        console.warn("[hosting-requests/status] Error fetching by ID:", err.message);
      }
    }

    // 2. Try finding by email if no doc found by ID
    if (!docSnap && targetEmail) {
      try {
        const qSnap = await adminDb
          .collection("hostingRequests")
          .where("email", "==", targetEmail)
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();

        if (!qSnap.empty) {
          docSnap = qSnap.docs[0];
        }
      } catch (err) {
        // In case composite index on (email, createdAt desc) is pending, fallback without orderBy
        try {
          const qSnapFallback = await adminDb
            .collection("hostingRequests")
            .where("email", "==", targetEmail)
            .limit(10)
            .get();

          if (!qSnapFallback.empty) {
            // Sort in memory by createdAt descending
            const sorted = qSnapFallback.docs.sort((a, b) => {
              const ta = a.data().createdAt?.toMillis?.() || 0;
              const tb = b.data().createdAt?.toMillis?.() || 0;
              return tb - ta;
            });
            docSnap = sorted[0];
          }
        } catch (fallbackErr) {
          console.warn("[hosting-requests/status] Email lookup error:", fallbackErr.message);
        }
      }
    }

    // 3. Try finding by userId
    if (!docSnap && targetUserId) {
      try {
        const qSnap = await adminDb
          .collection("hostingRequests")
          .where("userId", "==", targetUserId)
          .limit(10)
          .get();

        if (!qSnap.empty) {
          const sorted = qSnap.docs.sort((a, b) => {
            const ta = a.data().createdAt?.toMillis?.() || 0;
            const tb = b.data().createdAt?.toMillis?.() || 0;
            return tb - ta;
          });
          docSnap = sorted[0];
        }
      } catch (err) {
        console.warn("[hosting-requests/status] UserId lookup error:", err.message);
      }
    }

    // 4. Also check if the user account already has organiser privileges in users collection
    let isUserOrganiser = false;
    let userRole = "user";
    if (targetUserId || targetEmail) {
      try {
        let userSnap = null;
        if (targetUserId) {
          userSnap = await adminDb.collection("users").doc(targetUserId).get();
        }
        if ((!userSnap || !userSnap.exists) && targetEmail) {
          const uSnap = await adminDb
            .collection("users")
            .where("email", "==", targetEmail)
            .limit(1)
            .get();
          if (!uSnap.empty) userSnap = uSnap.docs[0];
        }

        if (userSnap && userSnap.exists) {
          const uData = userSnap.data();
          const isSuper =
            targetEmail === "adil4ticketlelo@gmail.com" ||
            targetEmail === "superadmin@ticketlelo.com" ||
            uData.role === "superAdmin";
          userRole = isSuper ? "superAdmin" : uData.role || "user";
          // Super Admins are platform managers, not event hosting applicants
          if (!isSuper && (uData.role === "organiser" || userRole === "organiser")) {
            isUserOrganiser = true;
          }
        }
      } catch (userCheckErr) {
        console.warn("[hosting-requests/status] User check error:", userCheckErr.message);
      }
    }

    if (!docSnap) {
      return NextResponse.json({
        success: true,
        found: false,
        isApproved: false,
        isUserOrganiser,
        userRole,
      });
    }

    const data = docSnap.data();
    const rawStatus = data.status || "pending";
    // If the user's account is already marked as organiser, treat request as approved
    const status = isUserOrganiser && rawStatus === "pending" ? "approved" : rawStatus;
    const isApproved = status === "approved";
    const isRejected = status === "rejected";
    const isPending = status === "pending" && !isApproved;

    return NextResponse.json({
      success: true,
      found: true,
      id: docSnap.id,
      status,
      isApproved,
      isRejected,
      isPending,
      isUserOrganiser,
      userRole,
      request: {
        id: docSnap.id,
        name: data.name || "",
        email: data.email || targetEmail,
        phone: data.phone || "",
        college: data.college || "",
        eventTitle: data.eventTitle || "",
        description: data.description || "",
        numberOfTickets: data.numberOfTickets || 0,
        isPaid: Boolean(data.isPaid),
        status,
        organiserId: data.organiserId || null,
        organiserEmail: data.organiserEmail || null,
        approvedAt: data.approvedAt?.toDate?.()?.toISOString() || null,
        rejectionReason: data.rejectionReason || null,
      },
    });
  } catch (error) {
    console.error("[hosting-requests/status] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to check hosting request status", details: error.message },
      { status: 500 }
    );
  }
}
