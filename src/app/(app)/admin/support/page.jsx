import { Suspense } from "react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { SupportCenter } from "@/components/admin/support/support-center";
import { BrandLoader } from "@/components/ui/brand-loader";

function SupportContent({ searchParams }) {
  const eventId = searchParams?.eventId || null;
  const ticketId = searchParams?.ticketId || null;

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full min-h-screen bg-[#131517] text-white space-y-4 sm:space-y-6">
      <EventControlHeader activeTab="Support" eventId={eventId} />
      <SupportCenter initialTicketId={ticketId} />
    </div>
  );
}

export default async function AdminSupportPage({ searchParams }) {
  const sp = await searchParams;
  return (
    <Suspense fallback={<BrandLoader message="Loading..." fullScreen />}>
      <SupportContent searchParams={sp} />
    </Suspense>
  );
}

