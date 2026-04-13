"use client";

import { HostingRequestManagement } from "@/components/admin/hosting-request-management";

export default function HostingRequestsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Hosting Requests</h1>
        <p className="text-slate-300 mt-2">
          Review and manage event hosting requests
        </p>
      </div>
      <HostingRequestManagement />
    </div>
  );
}
