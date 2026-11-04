import { Suspense } from "react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { OrganizerPaymentSection } from "@/components/admin/payments/organizer-payment-section";
import { BrandLoader } from "@/components/ui/brand-loader";

function PaymentContent({ searchParams }) {
  const eventId = searchParams?.eventId || null;
  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full min-h-screen bg-[#131517] text-white space-y-6">
      <EventControlHeader activeTab="Payouts" eventId={eventId} />
      <OrganizerPaymentSection eventId={eventId} />
    </div>
  );
}

export default async function AdminPaymentsPage({ searchParams }) {
  const sp = await searchParams;
  return (
    <Suspense fallback={<BrandLoader message="Loading..." fullScreen />}>
      <PaymentContent searchParams={sp} />
    </Suspense>
  );
}
