"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  Bell,
  Calendar,
  ChevronDown,
  Filter,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { EventPoster } from "@/components/admin/event-poster";
import { toast } from "sonner";
import { OrganiserShell } from "@/components/layout/organiser-shell";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-purple-600",
  "bg-pink-600",
  "bg-orange-600",
  "bg-teal-600",
  "bg-emerald-600",
  "bg-indigo-600",
];

function getAvatar(name = "") {
  const clean = (name || "").trim().toUpperCase();
  if (!clean) return { text: "TL", bg: "bg-[#2A2D31]" };
  const parts = clean.split(/\s+/).filter(Boolean);
  const text = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : clean.slice(0, 2);
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bg = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return { text, bg };
}

function formatTimeAgo(ts) {
  if (!ts) return "Just now";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = Date.now();
    const diff = Math.max(0, now - d.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "Recently";
  }
}

function formatSimpleDate(ts) {
  if (!ts) return "recently";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "recently";
  }
}

function isOrganiserEvent(u, eventData) {
  if (!u || !eventData) return false;
  const uEmail = (u.email || "").toLowerCase().trim();
  const isSuper =
    u.role === "superAdmin" ||
    uEmail === "adil4ticketlelo@gmail.com" ||
    uEmail === "superadmin@ticketlelo.com";
  if (isSuper) return true;

  const uid = u.id || u.uid;
  if (
    uid &&
    (eventData.createdBy === uid ||
      eventData.organiserId === uid ||
      eventData.userId === uid ||
      eventData.creatorId === uid)
  ) {
    return true;
  }

  if (u.organizationId && eventData.organizationId === u.organizationId) {
    return true;
  }

  if (uEmail) {
    const orgEmail = (eventData.organiserEmail || eventData.organizerEmail || eventData.email || "").toLowerCase().trim();
    if (orgEmail && orgEmail === uEmail) return true;
  }

  return false;
}

function ActivityContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState("notifications"); // "notifications" | "requests"
  const [notifFilter, setNotifFilter] = useState("All"); // "All" | "Registrations" | "Check-ins" | "Blasts"
  const [selectedEventId, setSelectedEventId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const param = urlParams.get("eventId");
      if (param) return param;
      return localStorage.getItem("admin_selected_event_id") || "";
    } catch {
      return "";
    }
  });
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Live real-time state loaded from backend
  const [eventsMap, setEventsMap] = useState({});
  const [eventsList, setEventsList] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [hostingRequests, setHostingRequests] = useState([]);
  const [apiActivities, setApiActivities] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("tl_read_activity_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const emailLower = (user?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    user?.role === "superAdmin" ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com";

  // Synchronize selectedEventId if URL searchParam changes
  useEffect(() => {
    const paramId = searchParams?.get("eventId");
    if (paramId) {
      const timer = setTimeout(() => setSelectedEventId(paramId), 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // 0. Primary server fetch from /api/activity (backed by Firebase Admin SDK)
  useEffect(() => {
    let isMounted = true;
    const fetchBackendActivity = async () => {
      try {
        const url = selectedEventId
          ? `/api/activity?eventId=${encodeURIComponent(selectedEventId)}`
          : "/api/activity";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setApiActivities(data.activities || []);
            setHostingRequests(data.hostingRequests || []);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch /api/activity:", err);
      }
    };
    fetchBackendActivity();
    return () => {
      isMounted = false;
    };
  }, [selectedEventId]);

  // 1. Live subscribe to Events to resolve event names and enforce organiser ownership
  useEffect(() => {
    if (!user) return;
    try {
      const unsub = onSnapshot(
        collection(db, "events"),
        (snap) => {
          const map = {};
          const list = [];
          snap.docs.forEach((doc) => {
            const data = doc.data();
            const belongs = isSuperAdmin || isOrganiserEvent(user, data);
            if (belongs) {
              const ev = {
                id: doc.id,
                name: data.name || data.title || "Event",
                createdBy: data.createdBy,
              };
              map[doc.id] = ev;
              list.push(ev);
            }
          });
          setEventsMap(map);
          setEventsList(list);
          setEventsLoaded(true);
        },
        (err) => {
          console.warn("Events onSnapshot warning:", err.message);
          setEventsLoaded(true);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn("Failed to subscribe to events:", e);
      const timer = setTimeout(() => setEventsLoaded(true), 0);
      return () => clearTimeout(timer);
    }
  }, [user, isSuperAdmin]);

  // 2. Live subscribe to Registrations (Registrations & Check-ins)
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, "registrations"),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRegistrations(list);
          setIsLoading(false);
        },
        (err) => {
          console.warn("Registrations onSnapshot warning:", err.message);
          setIsLoading(false);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn("Failed to subscribe to registrations:", e);
      const timer = setTimeout(() => setIsLoading(false), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // 3. Live subscribe to Messages (Blasts)
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, "messages"),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMessages(list);
        },
        (err) => console.warn("Messages onSnapshot warning:", err.message)
      );
      return () => unsub();
    } catch (e) {
      console.warn("Failed to subscribe to messages:", e);
    }
  }, []);

  // 4. Live subscribe to Hosting Requests strictly for this user (or all if superAdmin)
  useEffect(() => {
    if (!user) return;
    try {
      const unsub = onSnapshot(
        collection(db, "hostingRequests"),
        (snap) => {
          const list = snap.docs
            .filter((d) => {
              if (isSuperAdmin) return true;
              const data = d.data();
              const reqEmail = String(data.email || data.userAccountEmail || "").toLowerCase().trim();
              return Boolean(
                (user.uid && (data.userId === user.uid || data.organiserId === user.uid || data.createdBy === user.uid)) ||
                (emailLower && reqEmail === emailLower)
              );
            })
            .map((d) => {
              const data = d.data();
              const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null;
              const approvedAtDate = data.approvedAt?.toDate ? data.approvedAt.toDate() : data.approvedAt ? new Date(data.approvedAt) : null;

              return {
                id: d.id,
                eventName: data.eventTitle || data.eventName || "Untitled Event",
                ticketsType: data.isPaid ? "Paid" : "Free",
                ticketsCount: `${data.capacity || data.ticketsCount || 100} tickets`,
                sentDate: `sent ${formatSimpleDate(createdAtDate)}`,
                statusText: data.status === "approved" 
                  ? `Approved ${formatSimpleDate(approvedAtDate || createdAtDate)}` 
                  : data.status === "rejected" 
                  ? "Rejected" 
                  : "Under review",
                statusTone: data.status === "approved" 
                  ? "approved" 
                  : data.status === "rejected" 
                  ? "rejected" 
                  : "pending",
                rawCreatedAt: createdAtDate,
                email: data.email,
                userId: data.userId || data.organiserId,
              };
            });
          setHostingRequests(list);
        },
        (err) => console.warn("Hosting requests onSnapshot warning:", err.message)
      );
      return () => unsub();
    } catch (e) {
      console.warn("Failed to subscribe to hosting requests:", e);
    }
  }, [user, isSuperAdmin, emailLower]);

  const myEventIdSet = useMemo(() => new Set(Object.keys(eventsMap)), [eventsMap]);

  // Generate real-time synthesized feed of notifications strictly for organiser's events
  const liveNotifications = useMemo(() => {
    if (!eventsLoaded) {
      return [];
    }

    // Organiser with no events should see zero registrations / blasts
    if (!isSuperAdmin && myEventIdSet.size === 0) {
      return [];
    }

    const feed = [];

    // A. Registrations activity
    registrations.forEach((reg) => {
      // If not superadmin, MUST be in organiser's events
      if (!isSuperAdmin && (!reg.eventId || !myEventIdSet.has(reg.eventId))) {
        return;
      }
      // If filtered by a specific event:
      if (selectedEventId && reg.eventId !== selectedEventId) {
        return;
      }

      const rawDate = reg.createdAt?.toDate ? reg.createdAt.toDate() : reg.createdAt ? new Date(reg.createdAt) : new Date();
      const eventName = reg.eventName || eventsMap[reg.eventId]?.name || "Event";
      const attendeeName = reg.fullName || reg.name || reg.buyerName || reg.email?.split("@")[0] || "Attendee";
      const avatar = getAvatar(attendeeName);
      const regId = `reg_${reg.id}`;

      // Registration entry
      feed.push({
        id: regId,
        eventId: reg.eventId,
        type: "Registrations",
        avatar: avatar.text,
        avatarBg: avatar.bg,
        title: `${attendeeName} registered${reg.paymentStatus === "pending" ? " · payment pending" : ""}`,
        subtitle: `${eventName} · ${formatTimeAgo(rawDate)}`,
        timestamp: rawDate,
        unread: !readIds.has(regId),
      });

      // Check-in entry (if checked in)
      if (reg.checkedIn || reg.status === "Used" || reg.status === "Checked In" || reg.usedAt || reg.checkIns) {
        const checkinDate = reg.usedAt?.toDate ? reg.usedAt.toDate() : reg.usedAt ? new Date(reg.usedAt) : rawDate;
        const checkinId = `checkin_${reg.id}`;
        feed.push({
          id: checkinId,
          eventId: reg.eventId,
          type: "Check-ins",
          avatar: avatar.text,
          avatarBg: "bg-pink-600",
          title: `${attendeeName} checked in`,
          subtitle: `${eventName} · ${formatTimeAgo(checkinDate)}`,
          timestamp: checkinDate,
          unread: !readIds.has(checkinId),
        });
      }
    });

    // B. Broadcast Messages (Blasts)
    messages.forEach((msg) => {
      if (!isSuperAdmin) {
        const belongs = (msg.eventId && myEventIdSet.has(msg.eventId)) ||
          (user?.uid && (msg.createdBy === user.uid || msg.senderId === user.uid));
        if (!belongs) return;
      }
      if (selectedEventId && msg.eventId && msg.eventId !== selectedEventId) {
        return;
      }

      const rawDate = msg.sentAt?.toDate ? msg.sentAt.toDate() : msg.createdAt?.toDate ? msg.createdAt.toDate() : msg.createdAt ? new Date(msg.createdAt) : new Date();
      const eventName = msg.eventName || eventsMap[msg.eventId]?.name || "Event";
      const isFailed = msg.status === "failed";
      const count = msg.recipientCount || msg.successCount || 0;
      const blastId = `blast_${msg.id}`;

      feed.push({
        id: blastId,
        eventId: msg.eventId,
        type: "Blasts",
        avatar: isFailed ? "!" : "TL",
        avatarBg: "bg-[#2A2D31]",
        title: isFailed
          ? `Blast "${msg.subject || "Announcement"}" failed to send`
          : `Blast "${msg.subject || "Your ticket is ready"}" sent to ${count} guests`,
        subtitle: `${eventName} · ${formatTimeAgo(rawDate)}`,
        timestamp: rawDate,
        unread: !readIds.has(blastId),
      });
    });

    // Fallback to server-fetched activities if client live feed has no items
    if (feed.length === 0 && apiActivities.length > 0) {
      const filteredApi = apiActivities.filter((act) => {
        if (!isSuperAdmin && act.eventId && !myEventIdSet.has(act.eventId)) return false;
        if (selectedEventId && act.eventId && act.eventId !== selectedEventId) return false;
        return true;
      });

      return filteredApi.map((act) => {
        const rawDate = act.timestamp ? new Date(act.timestamp) : new Date();
        const attendeeName = act.title.replace(/ (registered|checked in).*$/, "") || "Attendee";
        const avatar = getAvatar(attendeeName);
        return {
          id: act.id,
          eventId: act.eventId,
          type: act.type || "Registrations",
          avatar: act.type === "Blasts" ? (act.title.includes("failed") ? "!" : "TL") : avatar.text,
          avatarBg: act.type === "Check-ins" ? "bg-pink-600" : act.type === "Blasts" ? "bg-[#2A2D31]" : avatar.bg,
          title: act.title,
          subtitle: `${act.subtitle} · ${formatTimeAgo(rawDate)}`,
          timestamp: rawDate,
          unread: !readIds.has(act.id),
        };
      });
    }

    feed.sort((a, b) => b.timestamp - a.timestamp);
    return feed;
  }, [eventsLoaded, isSuperAdmin, myEventIdSet, registrations, messages, eventsMap, selectedEventId, readIds, apiActivities, user]);

  const markAllAsRead = () => {
    const allIds = liveNotifications.map((n) => n.id);
    const updated = new Set([...readIds, ...allIds]);
    setReadIds(updated);
    try {
      localStorage.setItem("tl_read_activity_ids", JSON.stringify([...updated]));
    } catch (e) {
      console.warn("Failed to store read IDs", e);
    }
    toast.success("All notifications marked as read");
  };

  const filteredNotifications = useMemo(() => {
    return liveNotifications.filter((item) => {
      if (notifFilter !== "All" && item.type !== notifFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [liveNotifications, notifFilter, search]);

  const filteredRequests = useMemo(() => {
    return hostingRequests.filter((item) => {
      if (!isSuperAdmin) {
        const reqEmail = String(item.email || "").toLowerCase().trim();
        const isOwner =
          (user?.uid && (item.userId === user.uid || item.organiserId === user.uid)) ||
          (emailLower && reqEmail === emailLower);
        if (!isOwner) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.eventName.toLowerCase().includes(q) ||
          item.statusText.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [hostingRequests, isSuperAdmin, user, emailLower, search]);

  const hasNoEvents = eventsLoaded && !isSuperAdmin && eventsList.length === 0;

  return (
    <OrganiserShell allowAnyUser={true}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header & Segmented Pill */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#2A2D31]">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Activity
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981]/10 text-[#3DD68C] border border-[#3DD68C]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C] animate-pulse" />
                Live stream
              </span>
            </div>
            {activeTab === "requests" ? (
              <p className="text-sm text-[#9B9EA4] mt-1">
                Requests you&apos;ve sent to host events on TicketLelo.
              </p>
            ) : (
              <p className="text-sm text-[#9B9EA4] mt-1">
                Live stream of guest check-ins, ticket registrations, and updates for your events.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications / My hosting requests Toggle */}
            <div className="flex items-center rounded-xl bg-[#1A1C1F] border border-[#2A2D31] p-1">
              <button
                type="button"
                onClick={() => setActiveTab("notifications")}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === "notifications"
                    ? "bg-[#212327] text-white shadow-sm"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                Notifications
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("requests")}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === "requests"
                    ? "bg-[#212327] text-white shadow-sm"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                My hosting requests
              </button>
            </div>
          </div>
        </div>

        {/* View 1: Notifications */}
        {activeTab === "notifications" && (
          <div className="space-y-4">
            {/* Filter Pills + Event Selector + Search + Mark all as read */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                {["All", "Registrations", "Check-ins", "Blasts"].map((tab) => {
                  const isActive = notifFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setNotifFilter(tab)}
                      className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                        isActive
                          ? "bg-white text-[#131517] font-semibold"
                          : "bg-[#1A1C1F] text-[#D0D0D1] border border-[#2A2D31] hover:text-white hover:bg-[#212327]"
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Event Selector Dropdown if organiser has multiple events */}
                {eventsList.length > 1 && (
                  <div className="relative">
                    <select
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-1.5 rounded-xl text-xs font-medium bg-[#1A1C1F] border border-[#2A2D31] text-[#D0D0D1] hover:text-white focus:outline-none focus:border-[#FE760B] cursor-pointer"
                    >
                      <option value="">All Events ({eventsList.length})</option>
                      {eventsList.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#9B9EA4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}

                {/* Search */}
                <div className="relative w-40 sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9B9EA4]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search activity..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[#1A1C1F] border border-[#2A2D31] text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B]"
                  />
                </div>

                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-[#9B9EA4] hover:text-white transition-colors"
                >
                  Mark all as read
                </button>
              </div>
            </div>

            {/* Notifications Card List */}
            <div className="rounded-2xl border border-[#2A2D31] bg-[#1A1C1F] divide-y divide-[#2A2D31] overflow-hidden shadow-sm">
              {isLoading ? (
                <div className="p-16 flex flex-col items-center justify-center gap-3 text-[#9B9EA4]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
                  <p className="text-sm">Connecting to live activity stream...</p>
                </div>
              ) : hasNoEvents ? (
                <div className="p-12 sm:p-16 text-center text-[#9B9EA4] text-sm space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B] mx-auto mb-2">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-white">No Events Created Yet</h3>
                  <p className="text-xs text-[#9B9EA4] max-w-md mx-auto leading-relaxed">
                    Your organiser activity feed is dedicated strictly to your events. Once you create an event and receive registrations, check-ins, or send broadcasts, your live activity stream will appear here.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/admin/create-event"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First Event</span>
                    </Link>
                  </div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-16 text-center text-[#9B9EA4] text-sm space-y-2">
                  <Bell className="w-8 h-8 text-[#5C6066] mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-white">
                    No {notifFilter === "All" ? "" : notifFilter.toLowerCase()} activity recorded yet
                    {selectedEventId && eventsMap[selectedEventId] ? ` for ${eventsMap[selectedEventId].name}` : ""}
                  </p>
                  <p className="text-xs text-[#9B9EA4] max-w-sm mx-auto">
                    Live stream of attendee registrations, QR check-ins, and broadcast updates will appear here in real time.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-[#212327]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Avatar */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white select-none ${item.avatarBg}`}
                      >
                        {item.avatar}
                      </div>

                      {/* Text */}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-[#9B9EA4] mt-0.5 truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    {/* Unread dot or read dot */}
                    <div className="shrink-0 flex items-center justify-center w-4 h-4">
                      {item.unread ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#FE760B]" title="Unread" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-[#4A4E57]" title="Read" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* View 2: My Hosting Requests */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {/* List of Requests */}
            <div className="rounded-2xl border border-[#2A2D31] bg-[#1A1C1F] divide-y divide-[#2A2D31] overflow-hidden shadow-sm">
              {filteredRequests.length === 0 ? (
                <div className="p-16 text-center text-[#9B9EA4] text-sm space-y-2">
                  <Calendar className="w-8 h-8 text-[#5C6066] mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-white">No hosting requests yet</p>
                  <p className="text-xs text-[#9B9EA4] max-w-sm mx-auto">
                    Requests submitted to host college or community events will appear here with live review status.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/host-event"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FE760B] text-[#131517] font-semibold text-xs hover:bg-[#FF8A2B] transition-colors"
                    >
                      Submit Hosting Request
                    </Link>
                  </div>
                </div>
              ) : (
                filteredRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-[#212327]/40 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Event Poster Thumbnail */}
                      <EventPoster
                        event={{ name: req.eventName }}
                        className="w-14 h-14 rounded-xl shrink-0"
                      />

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-white truncate">
                          {req.eventName}
                        </div>
                        <div className="text-xs text-[#9B9EA4] mt-0.5">
                          {req.ticketsType} · {req.ticketsCount} · {req.sentDate}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {req.statusTone === "approved" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#3DD68C]/12 text-[#3DD68C] border border-[#3DD68C]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                          {req.statusText}
                        </span>
                      ) : req.statusTone === "rejected" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FF6B6B]/12 text-[#FF6B6B] border border-[#FF6B6B]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                          {req.statusText}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FDE003]/12 text-[#FDE003] border border-[#FDE003]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
                          {req.statusText}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </OrganiserShell>
  );
}

export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <OrganiserShell allowAnyUser={true}>
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-[#9B9EA4]">
            <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
            <p className="text-sm">Loading activity...</p>
          </div>
        </OrganiserShell>
      }
    >
      <ActivityContent />
    </Suspense>
  );
}
