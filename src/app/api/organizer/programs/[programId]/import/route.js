import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { processBulkAmbassadorImport } from "@/lib/creator-campus/bulk-importer";

export async function POST(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;

    const formData = await request.formData();
    const file = formData.get("file");
    const autoApprove = formData.get("autoApprove") === "true";

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "A valid CSV or XLSX file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = file.name || "import.csv";
    const fileType = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") ? "xlsx" : "csv";

    const result = await processBulkAmbassadorImport({
      fileBuffer: buffer,
      fileType,
      programId,
      organizerId: caller.uid,
      autoApprove,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/organizer/programs/import POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to import ambassadors" }, { status: 400 });
  }
}

