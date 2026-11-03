"use client";

import { EmailMonitoringDashboard } from "@/components/admin/email-monitoring";

export default function SuperadminEmailsPage() {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <EmailMonitoringDashboard />
    </div>
  );
}
