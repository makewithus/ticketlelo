import { NextResponse } from "next/server";

export async function GET() {
  const csvContent = "Ambassador Name,Username,Email,Phone,College,Referral Code\n";

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ticketlelo_ambassadors_template.csv"',
    },
  });
}

