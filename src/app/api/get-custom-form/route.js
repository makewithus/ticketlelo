import { NextResponse } from "next/server";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function GET(request) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 },
      );
    }

    console.log("[API] Fetching custom form for event:", eventId);

    // Fetch custom form for the event (uses client SDK with public read rules)
    const formsRef = collection(db, "customForms");
    const q = query(formsRef, where("eventId", "==", eventId));
    const querySnapshot = await getDocs(q);
    
    const queryTime = Date.now() - startTime;
    console.log(`[API] Firestore query completed in ${queryTime}ms`);

    if (querySnapshot.empty) {
      return NextResponse.json({
        success: true,
        form: null,
        message: "No custom form found for this event",
      });
    }

    const formDoc = querySnapshot.docs[0];
    const customForm = { id: formDoc.id, ...formDoc.data() };

    // Remove sensitive data before sending to frontend
    if (customForm.paymentCredentials) {
      // Keep only info needed for display, remove secrets
      customForm.paymentCredentials = {
        configured: true,
      };
    }

    const totalTime = Date.now() - startTime;
    console.log(`[API] ✅ Custom form sent successfully (Total: ${totalTime}ms)`);
    
    return NextResponse.json(
      {
        success: true,
        form: customForm,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[API] ❌ Error fetching custom form (after ${totalTime}ms):`, error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch form" },
      { status: 500 },
    );
  }
}
