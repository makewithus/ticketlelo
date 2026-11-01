"use client";

import { EmailMonitoringDashboard } from "@/components/admin/email-monitoring";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SuperadminEmailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isSuperAdmin =
    user?.role === "superAdmin" ||
    user?.email === "adil4ticketlelo@gmail.com" ||
    user?.email === "superadmin@ticketlelo.com";

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      router.push("/dashboard");
    }
  }, [user, loading, isSuperAdmin, router]);

  if (loading || !user || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#131517] text-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#FE760B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131517] text-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link
          href="/superadmin/hosting-requests"
          className="inline-flex items-center gap-2 text-xs text-[#9B9EA4] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Hosting Requests
        </Link>
        <EmailMonitoringDashboard />
      </div>
    </div>
  );
}
