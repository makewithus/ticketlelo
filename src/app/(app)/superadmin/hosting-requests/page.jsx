"use client";

import { HostingRequestManagement } from "@/components/admin/hosting-request-management";

export default function HostingRequestsPage() {
  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#061a3f]">
          Hosting Requests
        </h1>
        <p className="text-[rgba(6,26,63,0.64)] mt-2">
          Review and manage event hosting requests
        </p>
      </div>
      <HostingRequestManagement />
    </div>
  );
}
