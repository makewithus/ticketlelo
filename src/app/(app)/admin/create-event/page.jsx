"use client";

import { useEffect, useState } from "react";
import { EventCreateStudio } from "@/components/admin/event-create-studio";
import { useRouter, useSearchParams } from "next/navigation";
import { getEvent } from "@/lib/firestore";
import { BrandLoader } from "@/components/ui/brand-loader";
import { useAuth } from "@/context/auth-context";
import { auth } from "@/lib/firebase";
import { Zap, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreateEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const { user } = useAuth();
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [planLimitBlocked, setPlanLimitBlocked] = useState(false);
  const [planLimitData, setPlanLimitData] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function checkEligibilityAndLoad() {
      // If editing an existing event, load it (editing existing doesn't exceed quota)
      if (eventId) {
        try {
          const ev = await getEvent(eventId);
          if (isMounted) {
            setEditingEvent(ev);
            setLoading(false);
          }
        } catch (err) {
          console.error("Error loading event for edit:", err);
          if (isMounted) setLoading(false);
        }
        return;
      }

      // If creating a new event, check plan limit for organisers
      const isSuperAdmin =
        user?.role === "superAdmin" ||
        user?.role === "superadmin" ||
        user?.email === "adil4ticketlelo@gmail.com" ||
        user?.email === "superadmin@ticketlelo.com";

      if (user && user.role === "organiser" && !isSuperAdmin) {
        try {
          let headers = {};
          if (auth?.currentUser) {
            const token = await auth.currentUser.getIdToken().catch(() => null);
            if (token) headers.Authorization = `Bearer ${token}`;
          }

          const res = await fetch(
            `/api/plans/check?userId=${encodeURIComponent(user.uid || user.id)}&action=createEvent`,
            { headers, cache: "no-store" }
          );

          if (res.ok) {
            const data = await res.json();
            if (isMounted && data.allowed === false) {
              setPlanLimitBlocked(true);
              setPlanLimitData(data);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn("Could not check plan limit on create-event page:", err);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    }

    checkEligibilityAndLoad();

    return () => {
      isMounted = false;
    };
  }, [eventId, user]);

  if (loading) {
    return <BrandLoader message="Loading..." fullScreen />;
  }

  if (planLimitBlocked) {
    return (
      <div className="min-h-screen bg-[#0E1013] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-amber-500/20 bg-[#171412] p-8 shadow-2xl text-center">
          <div className="w-14 h-14 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Zap className="w-7 h-7 text-[#FE760B]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Plan Limit Reached
          </h2>
          <p className="text-sm text-neutral-300 mb-6">
            {planLimitData?.reason ||
              `You have reached the maximum active/draft event capacity (${planLimitData?.current || 0}/${planLimitData?.limit || 1}) for your plan.`}
          </p>
          <div className="bg-[#211E1A] border border-amber-500/10 rounded-xl p-4 text-xs text-neutral-400 mb-6 text-left space-y-1">
            <div className="flex justify-between">
              <span>Active/Draft Events:</span>
              <span className="font-semibold text-white">{planLimitData?.current || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Max Allowed:</span>
              <span className="font-semibold text-white">{planLimitData?.limit || 1}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Plan:</span>
              <span className="font-semibold text-[#FE760B] uppercase">{planLimitData?.plan || "Free"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => router.push("/pricing")}
              className="w-full h-11 bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold rounded-xl"
            >
              <Zap className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/admin/dashboard")}
              className="w-full h-11 border-[#2A2D31] text-neutral-300 hover:bg-[#202327] rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EventCreateStudio
      editingEvent={editingEvent}
      onClose={() => router.push("/admin/dashboard")}
      onSuccess={(saved) => {
        router.push(`/admin/overview?eventId=${saved?.id || eventId || ""}`);
      }}
    />
  );
}
