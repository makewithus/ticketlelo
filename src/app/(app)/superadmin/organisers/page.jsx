"use client";

import { OrganisersManagement } from "@/components/admin/organisers-management";

export default function OrganisersPage() {
  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#061a3f]">Organisers</h1>
        <p className="text-[rgba(6,26,63,0.64)] mt-2">
          View and manage all event organisers
        </p>
      </div>
      <OrganisersManagement />
    </div>
  );
}
