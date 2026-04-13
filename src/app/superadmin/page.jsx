"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SuperAdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to hosting requests by default
    router.push("/superadmin/hosting-requests");
  }, [router]);

  return null;
}
