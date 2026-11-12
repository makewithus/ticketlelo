import { NextResponse } from "next/server";

export async function GET() {
  const csvContent =
    "Ambassador Name,Username,Email,Phone,College,Referral Code\n" +
    "Adil Mohammed,adilmoh,adil@example.com,9876543210,CUSAT,ADIL-1001\n" +
    "Sara Joseph,saraj,sara@example.com,9876543211,IIT Bombay,\n" +
    "Rahul Sharma,rahuls,rahul@example.com,9876543212,NIT Trichy,RAHU-2045\n";

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ticketlelo_ambassadors_template.csv"',
    },
  });
}
