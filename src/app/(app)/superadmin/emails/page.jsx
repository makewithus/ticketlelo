"use client";

import { Suspense } from "react";
import { EmailMonitoringDashboard } from "@/components/admin/email-monitoring";
import { EmailMonitoringSkeleton } from "@/components/ui/skeleton";

export default function SuperadminEmailsPage() {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Suspense fallback={<EmailMonitoringSkeleton />}>
        <EmailMonitoringDashboard />
      </Suspense>
    </div>
  );
}
