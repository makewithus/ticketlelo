"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { getEventsByOrganiser, getAllEvents } from "@/lib/firestore";
import BroadcastMessaging from "@/components/organiser/broadcast-messaging";
import { Loader2, MessageSquare } from "lucide-react";

export default function MessagesPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const data =
          user.role === "superAdmin"
            ? await getAllEvents()
            : await getEventsByOrganiser(user.id);
        setEvents(data || []);
        if (data?.length === 1) setSelectedEventId(data[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare size={22} className="text-[#FF6A00]" />
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">
          Broadcast Messages
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-500 dark:text-slate-400">
          <Loader2 size={20} className="animate-spin" /> Loading events…
        </div>
      ) : events.length === 0 ? (
        <div className="bg-black rounded-2xl border border-[#FF6A00]/20 p-10 text-center text-[#FF6A00] font-medium">
          No events found. Create an event first.
        </div>
      ) : (
        <div className="space-y-5">
          {events.length > 1 && (
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-black border border-[#FF6A00]/30 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
            >
              <option value="" className="bg-slate-900">
                Select an event
              </option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-slate-900">
                  {ev.name}
                </option>
              ))}
            </select>
          )}

          {selectedEventId ? (
            <BroadcastMessaging eventId={selectedEventId} userId={user?.id} />
          ) : (
            <div className="bg-black rounded-2xl border border-[#FF6A00]/20 p-10 text-center text-[#FF6A00] text-sm font-medium">
              Select an event to manage messages
            </div>
          )}
        </div>
      )}
    </div>
  );
}
