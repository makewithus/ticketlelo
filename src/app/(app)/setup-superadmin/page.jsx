"use client";

import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default function SetupSuperAdminPage() {
  return (
    <main className="min-h-screen bg-[#131517] text-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-[#9B9EA4] hover:text-white transition-colors mb-6 group text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to login</span>
        </Link>

        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FE760B] text-[#131517] shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
              Superadmin provisioning
            </h1>
            <p className="text-sm text-[#9B9EA4] leading-relaxed">
              Superadmin access cannot be created from the browser. An existing platform
              operator must provision the account through the trusted Firebase Admin
              environment and verify the assigned role before access is granted.
            </p>
          </div>

          <div className="p-4 bg-[#212327] border border-[#2A2D31] rounded-xl text-xs text-[#9B9EA4] space-y-1">
            <p className="font-semibold text-white">Security requirement</p>
            <p>Role authorization keys and claims are evaluated cryptographically on each request.</p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-sm transition-colors shadow-sm"
            >
              Return to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
