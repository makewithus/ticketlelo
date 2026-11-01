"use client";

import { HostingRequestManagement } from "@/components/admin/hosting-request-management";

export default function HostingRequestsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Hosting requests
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] mt-1">
          Approve who can host events on TicketLelo.
        </p>
      </div>
      <HostingRequestManagement />
    </div>
  );
}
