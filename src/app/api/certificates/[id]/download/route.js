import { NextResponse } from "next/server";
import { getCertificate, generateCertificatePDF } from "@/lib/certificates";

/**
 * GET /api/certificates/[id]/download
 * Returns PDF download of certificate
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Certificate ID required" }, { status: 400 });
    }

    const cert = await getCertificate(id);
    if (!cert) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    if (cert.status === "revoked") {
      return NextResponse.json({ error: "This certificate has been revoked" }, { status: 403 });
    }

    const pdfBlob = generateCertificatePDF(cert);
    const buffer = await pdfBlob.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${id}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[api/certificates/download] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate certificate PDF" },
      { status: 500 }
    );
  }
}
