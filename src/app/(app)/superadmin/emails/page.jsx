"use client";

import { Suspense } from "react";
import { EmailMonitoringDashboard } from "@/components/admin/email-monitoring";
import { EmailMonitoringSkeleton } from "@/components/ui/skeleton";

export default function SuperadminEmailsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Email monitoring
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] mt-1">
          Inspect delivery logs, resend status, and quota health in real time.
        </p>
      </div>
      <Suspense fallback={<EmailMonitoringSkeleton />}>
        <EmailMonitoringDashboard />
      </Suspense>
    </div>
  );
}
