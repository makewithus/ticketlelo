"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  QrCode,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Ticket,
  Loader2,
  Users,
} from "lucide-react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { useAuth } from "@/context/auth-context";
import {
  getEventsByOrganiser,
  getAllEvents,
  subscribeToEvent,
  subscribeToEventRegistrations,
} from "@/lib/firestore";
import * as XLSX from "xlsx";
import { GuestDetailsModal } from "@/components/admin/guest-details-modal";

function formatRelativeTime(ts) {
  if (!ts) return "recently";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  } catch {
    return "recently";
  }
}

function getInitials(name = "") {
  return (name || "Guest")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-purple-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-indigo-600",
  "bg-teal-600",
  "bg-orange-600",
];

function getAvatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function RegistrationsGuestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGuestIndex, setSelectedGuestIndex] = useState(null);
  const pageSize = 15;

  // 1. Initial Load: Fetch events from Firestore
  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      if (!user) return;
      try {
        setLoading(true);
        let list = [];
        if (user.role === "superAdmin") {
          list = await getAllEvents();
        } else {
          list = await getEventsByOrganiser(user.id);
        }

        if (!isMounted) return;
        const uniqueList = [];
        const seenIds = new Set();
        for (const ev of (list || [])) {
          if (ev && ev.id && !seenIds.has(ev.id)) {
            seenIds.add(ev.id);
            uniqueList.push(ev);
          }
        }
        setEvents(uniqueList);

        const paramId = searchParams.get("eventId");
        let initialId = "";

        if (paramId && uniqueList.some((e) => e.id === paramId)) {
          initialId = paramId;
        } else {
          let cachedId = null;
          try {
            cachedId = localStorage.getItem("admin_selected_event_id");
          } catch {}
          if (cachedId && uniqueList.some((e) => e.id === cachedId)) {
            initialId = cachedId;
          } else if (uniqueList.length > 0) {
            initialId = uniqueList[0].id;
          }
        }

        setSelectedEventId(initialId);
        if (initialId) {
          try {
            localStorage.setItem("admin_selected_event_id", initialId);
          } catch {}
        }
      } catch (err) {
        console.error("Failed to load events for registrations:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadEvents();
    return () => {
      isMounted = false;
    };
  }, [user, searchParams]);

  // 2. Real-time Subscription to event
  useEffect(() => {
    if (!selectedEventId) {
      const timer = setTimeout(() => setEvent(null), 0);
      return () => clearTimeout(timer);
    }
    const unsub = subscribeToEvent(selectedEventId, (ev) => {
      if (ev) setEvent(ev);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [selectedEventId]);

  // 3. Real-time Subscription to registrations for this event
  useEffect(() => {
    if (!selectedEventId) {
      const timer = setTimeout(() => setRegistrations([]), 0);
      return () => clearTimeout(timer);
    }
    const unsub = subscribeToEventRegistrations(selectedEventId, (regs) => {
      const sorted = [...regs].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setRegistrations(sorted);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [selectedEventId]);

  // Real Stats
  const totalGuests = registrations.length;
  const totalCapacity = parseInt(event?.capacity || event?.totalTickets || 150, 10);

  const checkedInCount = useMemo(() => {
    return registrations.filter(
      (r) =>
        r.status === "Used" ||
        r.status === "used" ||
        r.status === "checked-in" ||
        r.checkedIn === true
    ).length;
  }, [registrations]);

  const pendingCount = useMemo(() => {
    return registrations.filter(
      (r) => r.status === "pending" || r.paymentStatus === "pending"
    ).length;
  }, [registrations]);

  const goingCount = Math.max(0, totalGuests - checkedInCount - pendingCount);

  // Filtered registrations
  const filteredGuests = useMemo(() => {
    return registrations.filter((guest) => {
      const isCheckedIn =
        guest.status === "Used" ||
        guest.status === "used" ||
        guest.status === "checked-in" ||
        guest.checkedIn === true;
      const isPending = guest.status === "pending" || guest.paymentStatus === "pending";
      const isGoing = !isCheckedIn && !isPending;

      if (statusFilter === "going" && !isGoing) return false;
      if (statusFilter === "checked-in" && !isCheckedIn) return false;
      if (statusFilter === "pending" && !isPending) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (guest.fullName || guest.name || guest.attendeeName || "").toLowerCase();
        const email = (guest.email || guest.whatsappPhone || "").toLowerCase();
        const code = (guest.ticketId || guest.ticketCode || guest.id || "").toLowerCase();
        return name.includes(q) || email.includes(q) || code.includes(q);
      }
      return true;
    });
  }, [registrations, searchQuery, statusFilter]);

  const paginatedGuests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGuests.slice(start, start + pageSize);
  }, [filteredGuests, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / pageSize));

  const handleExportExcel = () => {
    try {
      if (registrations.length === 0) {
        toast.info("No registrations to export");
        return;
      }
      const dataToExport = registrations.map((g) => ({
        "Ticket Code": g.ticketId || g.id,
        "Attendee Name": g.fullName || g.name || g.attendeeName || "Guest",
        "Email Address": g.email || "",
        Phone: g.whatsappPhone || g.phone || "",
        Status: g.status || "Unused",
        "Created At": g.createdAt?.toDate ? g.createdAt.toDate().toISOString() : String(g.createdAt || ""),
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Guests");
      const cleanTitle = (event?.name || "Event").replace(/[^a-zA-Z0-9]/g, "_");
      XLSX.writeFile(wb, `${cleanTitle}_Guest_List.xlsx`);
      toast.success("Guest list exported to Excel successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Excel");
    }
  };

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-white selection:bg-[#FE760B] selection:text-white pb-16">
      {/* ── Standard Navigation Header ── */}
      <EventControlHeader
        activeTab="Guests"
        eventTitle={event?.name || "Event Guests"}
        eventSlug={event?.slug || event?.id}
        isLive={event?.status === "live" || event?.isActive}
      />

      {/* ── At a Glance Section with Real Database Counts ── */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-white mb-2">At a glance</h2>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-2xl font-black text-[#3DD68C] tracking-tight">
            {totalGuests}{" "}
            <span className="text-xs font-semibold text-[#9B9EA4]">guests</span>
          </p>
          <span className="text-xs text-[#9B9EA4] font-medium font-mono">
            cap {totalCapacity}
          </span>
        </div>

        {/* Progress bar matching Image 2 */}
        <div className="w-full h-2 rounded-full bg-[#2A2D31] overflow-hidden flex mb-2.5">
          <div
            className="h-full bg-[#3DD68C] transition-all duration-500"
            style={{ width: `${Math.min(100, (checkedInCount / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${checkedInCount} checked in`}
          />
          <div
            className="h-full bg-[#FE760B] transition-all duration-500"
            style={{ width: `${Math.min(100, (goingCount / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${goingCount} going`}
          />
          <div
            className="h-full bg-[#FDE003] transition-all duration-500"
            style={{ width: `${Math.min(100, (pendingCount / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${pendingCount} payment pending`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium text-[#9B9EA4] flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
            <strong className="text-white">{checkedInCount}</strong> checked in
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
            <strong className="text-white">{goingCount}</strong> going
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
            <strong className="text-white">{pendingCount}</strong> payment pending
          </span>
        </div>
      </div>

      {/* ── 2 Action Cards matching Image 2 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
        {/* Check in guests */}
        <Link
          href={`/admin/scanner?eventId=${event?.id || ""}`}
          className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#3A3D42] rounded-2xl p-4 flex items-center gap-3.5 transition-all shadow-sm group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#212327] group-hover:bg-[#2A2D31] border border-[#2A2D31] flex items-center justify-center text-[#3DD68C] transition-colors">
            <QrCode size={19} />
          </div>
          <span className="text-sm font-bold text-white group-hover:text-[#FE760B] transition-colors">
            Check in guests
          </span>
        </Link>

        {/* Export to Excel */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#3A3D42] rounded-2xl p-4 flex items-center gap-3.5 transition-all shadow-sm group text-left cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#212327] group-hover:bg-[#2A2D31] border border-[#2A2D31] flex items-center justify-center text-[#7AA2FF] transition-colors">
            <Download size={19} />
          </div>
          <span className="text-sm font-bold text-white group-hover:text-[#FE760B] transition-colors">
            Export to Excel
          </span>
        </button>
      </div>

      {/* ── Guest List Section matching Image 2 ── */}
      <div>
        <h2 className="text-base font-bold text-white mb-3">Guest list</h2>

        {/* Search & Filter bar matching Image 2 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          {/* Search box */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9B9EA4]"
            />
            <input
              type="text"
              placeholder="Search name, email or ticket ID"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#1A1C1F] border border-[#2A2D31] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-[#9B9EA4] outline-none focus:border-[#FE760B] transition-colors"
            />
          </div>

          {/* Filter pills matching Image 2 */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "All" },
              { id: "going", label: "Going" },
              { id: "checked-in", label: "Checked in" },
              { id: "pending", label: "Pending" },
            ].map((pill) => {
              const isActive = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(pill.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-white text-black shadow-sm"
                      : "bg-[#1A1C1F] text-[#9B9EA4] hover:text-white border border-[#2A2D31]"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guest Rows */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl divide-y divide-[#2A2D31] overflow-hidden shadow-sm mb-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#9B9EA4] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#FE760B]" />
              <span>Loading guests in real time...</span>
            </div>
          ) : paginatedGuests.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#9B9EA4]">
              {registrations.length === 0
                ? "No guests registered for this event yet."
                : "No guests found matching your filter/search criteria."}
            </div>
          ) : (
            paginatedGuests.map((guest, idx) => {
              const guestName = guest.fullName || guest.name || guest.attendeeName || "Guest Attendee";
              const guestEmail = guest.email || guest.whatsappPhone || "No email";
              const isCheckedIn =
                guest.status === "Used" ||
                guest.status === "used" ||
                guest.status === "checked-in" ||
                guest.checkedIn === true;
              const isPending = guest.status === "pending" || guest.paymentStatus === "pending";
              const initials = getInitials(guestName);
              const avatarBg = getAvatarColor(guestName);
              const timeDisplay = formatRelativeTime(guest.createdAt);
              const ticketCode = guest.ticketId || guest.id;

              const globalIndex = (currentPage - 1) * pageSize + idx;

              return (
                <div
                  key={`${guest.id || guest.ticketId || "guest"}-${idx}`}
                  onClick={() => setSelectedGuestIndex(globalIndex)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedGuestIndex(globalIndex);
                    }
                  }}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-[#212327]/70 active:bg-[#212327] cursor-pointer transition-colors group"
                >
                  {/* Left: Avatar + Name + Email */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full ${avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FE760B] transition-colors truncate">
                        {guestName}
                      </p>
                      <p className="text-[11px] text-[#9B9EA4] truncate font-mono">
                        {guestEmail}
                      </p>
                    </div>
                  </div>

                  {/* Right: Ticket Code + Status Pill + Time */}
                  <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                    <span className="text-[11px] font-mono text-[#9B9EA4] hidden md:inline-block">
                      {ticketCode}
                    </span>

                    {/* Status Badge */}
                    {isCheckedIn ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#183124] text-[#3DD68C] border border-[#3DD68C]/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                        Checked in
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2C2614] text-[#FDE003] border border-[#FDE003]/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
                        Payment pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#192738] text-[#7AA2FF] border border-[#7AA2FF]/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7AA2FF]" />
                        Going
                      </span>
                    )}

                    {/* Relative Timestamp */}
                    <span className="text-[11px] text-[#9B9EA4] font-mono w-8 text-right">
                      {timeDisplay}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination matching Image 2 */}
        {filteredGuests.length > 0 && (
          <div className="flex items-center justify-between text-xs text-[#9B9EA4] px-1">
            <span>
              Showing {paginatedGuests.length} of {filteredGuests.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] text-white disabled:opacity-40 disabled:hover:bg-[#1A1C1F] transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] text-white disabled:opacity-40 disabled:hover:bg-[#1A1C1F] transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Guest Details Drawer / Modal matching Screenshot ── */}
      {selectedGuestIndex !== null && filteredGuests[selectedGuestIndex] && (
        <GuestDetailsModal
          isOpen={selectedGuestIndex !== null}
          onClose={() => setSelectedGuestIndex(null)}
          guest={filteredGuests[selectedGuestIndex]}
          allGuests={filteredGuests}
          currentIndex={selectedGuestIndex}
          onNavigate={(newIdx) => {
            setSelectedGuestIndex(newIdx);
            const targetPage = Math.floor(newIdx / pageSize) + 1;
            if (targetPage !== currentPage) {
              setCurrentPage(targetPage);
            }
          }}
          event={event}
          currentUser={user}
          onGuestUpdated={(updatedGuest) => {
            setRegistrations((prev) =>
              prev.map((g) => (g.id === updatedGuest.id ? { ...g, ...updatedGuest } : g))
            );
          }}
        />
      )}
    </div>
  );
}
