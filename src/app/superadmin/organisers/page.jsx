"use client";

import { OrganisersManagement } from "@/components/admin/organisers-management";

export default function OrganisersPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Organisers</h1>
        <p className="text-slate-300 mt-2">
          View and manage all event organisers
        </p>
      </div>
      <OrganisersManagement />
    </div>
  );
}
