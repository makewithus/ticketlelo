"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { getEventsByOrganiser, getAllEvents } from "@/lib/firestore";
import EventCustomization from "@/components/organiser/event-customization";
import { EventPublish } from "@/components/organiser/event-publish";
import { getEvent } from "@/lib/firestore";
import { Loader2, Globe } from "lucide-react";

export default function CustomizePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
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
        if (data?.length === 1) {
          setSelectedEventId(data[0].id);
          setSelectedEvent(data[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleEventSelect = async (id) => {
    setSelectedEventId(id);
    if (!id) {
      setSelectedEvent(null);
      return;
    }
    try {
      const ev = await getEvent(id);
      setSelectedEvent(ev);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePublished = (updated) => {
    setSelectedEvent((prev) => ({ ...prev, ...updated }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Globe size={22} className="text-[#FE760B]" />
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">
          Customize & Publish
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-500 dark:text-slate-400">
          <Loader2 size={20} className="animate-spin" /> Loading events…
        </div>
      ) : events.length === 0 ? (
        <div className="bg-black rounded-2xl border border-[#FE760B]/20 p-10 text-center text-[#FE760B] text-sm font-medium">
          No events found. Create an event first.
        </div>
      ) : (
        <div className="space-y-6">
          {events.length > 1 && (
            <select
              value={selectedEventId}
              onChange={(e) => handleEventSelect(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-black border border-[#FE760B]/30 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FE760B]"
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

          {selectedEventId && selectedEvent ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EventCustomization
                event={selectedEvent}
                userId={user?.id}
                onSaved={(updated) =>
                  setSelectedEvent((prev) => ({ ...prev, ...updated }))
                }
              />
              <EventPublish
                event={selectedEvent}
                userId={user?.id}
                onPublished={handlePublished}
              />
            </div>
          ) : selectedEventId ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-500 dark:text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading event…
            </div>
          ) : (
            <div className="bg-black rounded-2xl border border-[#FE760B]/20 p-10 text-center text-[#FE760B] text-sm font-medium">
              Select an event to customize and publish
            </div>
          )}
        </div>
      )}
    </div>
  );
}
