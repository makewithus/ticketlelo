"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrganiserLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?role=organiser&redirect=/admin/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#131517] flex items-center justify-center text-[#9B9EA4] text-sm">
      Redirecting to login...
    </div>
  );
}
