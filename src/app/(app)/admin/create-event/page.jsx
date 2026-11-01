"use client";

import { useEffect, useState } from "react";
import { EventCreateStudio } from "@/components/admin/event-create-studio";
import { useRouter, useSearchParams } from "next/navigation";
import { getEvent } from "@/lib/firestore";
import { Loader2 } from "lucide-react";

export default function CreateEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(Boolean(eventId));

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    getEvent(eventId)
      .then((ev) => {
        if (isMounted) {
          setEditingEvent(ev);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading event for edit:", err);
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131517] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE760B]" />
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
