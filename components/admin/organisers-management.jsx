"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Search,
  Loader2,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Check,
  X,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const AVATAR_COLORS = [
  "bg-[#FE760B]", // Orange (like TO in Image 1)
  "bg-[#2563EB]", // Blue (like NP in Image 1)
  "bg-[#8B5CF6]", // Purple (like AM in Image 1)
  "bg-[#10B981]", // Teal/Mint (like RS in Image 1)
  "bg-[#EC4899]", // Pink (like DK in Image 1)
  "bg-[#F59E0B]", // Amber
  "bg-[#06B6D4]", // Cyan
];

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "OR";
}

function formatApprovedDate(dateVal) {
  if (!dateVal) return "Recently";
  try {
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "Recently";
  }
}

export function OrganisersManagement() {
  const [organisers, setOrganisers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'paid' | 'free' | 'live' | 'duplicates'
  const [page, setPage] = useState(1);
  const pageSize = 5; // Image 1 displays 5 per page
  const [openActionId, setOpenActionId] = useState(null);
  const [resetModalData, setResetModalData] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!openActionId) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".action-menu-dropdown") && !e.target.closest(".action-menu-trigger")) {
        setOpenActionId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openActionId]);

  useEffect(() => {
    let isSubscribed = true;

    async function loadData() {
      try {
        // 1. Try server-side aggregator API
        const res = await fetch("/api/superadmin/organisers/", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.organisers)) {
            if (isSubscribed) {
              setOrganisers(json.organisers);
              setIsLoading(false);
            }
            return;
          }
        }

        // 2. Fallback directly to client Firestore if API is unavailable
        const hrQuery = query(
          collection(db, "hostingRequests"),
          where("status", "==", "approved"),
        );
        const hrSnap = await getDocs(hrQuery);

        const eventsSnap = await getDocs(collection(db, "events"));
        const eventsList = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const emailCounts = {};
        hrSnap.docs.forEach((d) => {
          const data = d.data();
          const em = (data.organiserEmail || data.email || "").toLowerCase().trim();
          if (em) emailCounts[em] = (emailCounts[em] || 0) + 1;
        });

        const now = Date.now();
        const list = hrSnap.docs.map((doc) => {
          const d = doc.data();
          const loginEmail = (d.organiserEmail || d.email || "").trim();
          const isDuplicate = (emailCounts[loginEmail.toLowerCase()] || 0) > 1;

          const matchingEvent = eventsList.find(
            (e) =>
              e.id === d.eventId ||
              (d.organiserId && e.createdBy === d.organiserId) ||
              (e.name && d.eventTitle && e.name.toLowerCase() === d.eventTitle.toLowerCase()),
          );

          let eventStatus = "Published";
          if (matchingEvent) {
            let eventDate = null;
            if (matchingEvent.date?.toDate) eventDate = matchingEvent.date.toDate();
            else if (matchingEvent.date) eventDate = new Date(matchingEvent.date);

            if (matchingEvent.status === "live") eventStatus = "Live";
            else if (matchingEvent.status === "draft" || matchingEvent.isActive === false) eventStatus = "Draft";
            else if (matchingEvent.status === "ended" || (eventDate && eventDate.getTime() < now - 24 * 60 * 60 * 1000)) eventStatus = "Ended";
            else if (matchingEvent.status === "published" || matchingEvent.isActive === true) eventStatus = "Published";
          }

          return {
            id: doc.id,
            name: d.name || d.organizerName || "Organiser",
            college: d.college || "college",
            eventTitle: d.eventTitle || matchingEvent?.name || "Event",
            isPaid: Boolean(d.isPaid || matchingEvent?.isPaid),
            eventStatus,
            tickets: matchingEvent?.totalTickets || d.numberOfTickets || 150,
            loginEmail: loginEmail || "—",
            phone: d.phone || "",
            isDuplicate,
            approvedAt: d.approvedAt || d.createdAt || null,
            eventId: matchingEvent?.id || null,
            eventSlug: matchingEvent?.slug || null,
          };
        });

        list.sort((a, b) => {
          const ta = a.approvedAt?.toDate ? a.approvedAt.toDate().getTime() : new Date(a.approvedAt || 0).getTime();
          const tb = b.approvedAt?.toDate ? b.approvedAt.toDate().getTime() : new Date(b.approvedAt || 0).getTime();
          return tb - ta;
        });

        if (isSubscribed) {
          setOrganisers(list);
        }
      } catch (err) {
        console.error("Failed to load approved organisers:", err);
        if (isSubscribed) {
          toast.error("Failed to load organisers from database");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Filter & Search Logic matching Image 1
  const filteredOrganisers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return organisers.filter((item) => {
      // Search match
      const searchable = [
        item.name,
        item.eventTitle,
        item.loginEmail,
        item.college,
        item.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || searchable.includes(q);

      // Filter pill match
      let matchesFilter = true;
      if (activeFilter === "paid") matchesFilter = item.isPaid === true;
      else if (activeFilter === "free") matchesFilter = item.isPaid === false;
      else if (activeFilter === "live") matchesFilter = item.eventStatus.toLowerCase() === "live";
      else if (activeFilter === "duplicates") matchesFilter = item.isDuplicate === true;

      return matchesSearch && matchesFilter;
    });
  }, [organisers, searchTerm, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrganisers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrganisers = filteredOrganisers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handleResetLogin = async (item) => {
    setOpenActionId(null);
    const toastId = toast.loading(`Generating password reset link for ${item.loginEmail}...`);
    try {
      const res = await fetch("/api/superadmin/reset-organiser-login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: item.loginEmail,
          name: item.name,
          eventTitle: item.eventTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset login");

      if (data.resetLink) {
        navigator.clipboard.writeText(data.resetLink);
      }

      toast.success(
        data.emailSent
          ? `Reset link emailed to ${data.email} and copied to clipboard!`
          : `Reset link copied to clipboard!`,
        { id: toastId },
      );

      setResetModalData({
        email: data.email,
        resetLink: data.resetLink,
        name: item.name,
        emailSent: data.emailSent,
      });
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err) {
      console.error("Reset login error:", err);
      toast.error(err.message || "Could not reset login", { id: toastId });
    }
  };

  const handleViewEvent = (item) => {
    setOpenActionId(null);
    const target = item.eventSlug || item.eventId;
    if (target) {
      window.open(`/e/${target}/`, "_blank");
    } else {
      toast.info(`No public event page found for "${item.eventTitle || item.name}" yet.`);
    }
  };

  const handleEmailOrganiser = (item) => {
    setOpenActionId(null);
    if (!item.loginEmail || item.loginEmail === "—") {
      toast.error("No valid email address for this organiser");
      return;
    }
    navigator.clipboard.writeText(item.loginEmail);
    const subject = encodeURIComponent(`TicketLelo Organizer - ${item.eventTitle || "Your Event"}`);
    window.open(`mailto:${item.loginEmail}?subject=${subject}`, "_blank");
    toast.success(`Opening email client for ${item.loginEmail} (email copied)`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE760B]" />
        <p className="text-xs text-[#9B9EA4]">Loading organisers from database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header matching Image 1: Title + Count Badge + Subtitle */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Organisers
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#212327] border border-[#2A2D31] text-[#9B9EA4]">
            {organisers.length}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[#9B9EA4] mt-1">
          Everyone approved to host events.
        </p>
      </div>

      {/* Filter and Search Bar matching Image 1 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input with 🔍 */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71767B]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, event or login email"
            className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#71767B] outline-none focus:border-[#FE760B] transition-colors"
          />
        </div>

        {/* Filter Pills matching Image 1 */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "paid", label: "Paid" },
            { id: "free", label: "Free" },
            { id: "live", label: "Live now" },
            { id: "duplicates", label: "Duplicates" },
          ].map((pill) => {
            const isActive = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setActiveFilter(pill.id);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-white text-[#131517] shadow-sm"
                    : "bg-[#1A1C1F] text-[#9B9EA4] hover:text-white border border-[#2A2D31]"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* High-Density Data Table Container matching Image 1 */}
      <div className="rounded-2xl border border-[#2A2D31] bg-[#1A1C1F] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2A2D31] text-[11px] font-semibold text-[#71767B] uppercase tracking-wider select-none">
                <th className="py-3.5 px-5">ORGANISER</th>
                <th className="py-3.5 px-4">EVENT</th>
                <th className="py-3.5 px-4">EVENT STATUS</th>
                <th className="py-3.5 px-4">TICKETS</th>
                <th className="py-3.5 px-4">LOGIN EMAIL</th>
                <th className="py-3.5 px-4">APPROVED</th>
                <th className="py-3.5 px-4 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2D31]/60">
              {paginatedOrganisers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#9B9EA4] text-xs">
                    No approved organisers found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedOrganisers.map((item, idx) => {
                  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  const initials = getInitials(item.name);

                  // Status Badge Styling matching Image 1
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#3DD68C]/15 text-[#3DD68C] border border-[#3DD68C]/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                      Published
                    </span>
                  );

                  if (item.eventStatus === "Live") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B] animate-pulse" />
                        Live
                      </span>
                    );
                  } else if (item.eventStatus === "Ended") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/5 text-[#9B9EA4] border border-[#2A2D31]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9B9EA4]" />
                        Ended
                      </span>
                    );
                  } else if (item.eventStatus === "Draft") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/5 text-[#9B9EA4] border border-[#2A2D31]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9B9EA4]" />
                        Draft
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Column 1: ORGANISER with Avatar */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-white truncate">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-[#71767B] truncate">
                              [{item.college || "college"}]
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: EVENT */}
                      <td className="py-4 px-4">
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-white truncate max-w-[200px]">
                            {item.eventTitle}
                          </div>
                          <div className="text-[11px] text-[#71767B]">
                            {item.isPaid ? "Paid" : "Free"}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: EVENT STATUS */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {statusBadge}
                      </td>

                      {/* Column 4: TICKETS */}
                      <td className="py-4 px-4 text-xs sm:text-sm font-mono text-white whitespace-nowrap">
                        {Number(item.tickets || 0).toLocaleString()}
                      </td>

                      {/* Column 5: LOGIN EMAIL with Duplicate Badge */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#D0D0D1]">
                            {item.loginEmail}
                          </span>
                          {item.isDuplicate && (
                            <span className="bg-[#FDE003]/15 text-[#FDE003] border border-[#FDE003]/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              Duplicate
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 6: APPROVED DATE */}
                      <td className="py-4 px-4 text-xs font-medium text-[#9B9EA4] whitespace-nowrap">
                        {formatApprovedDate(item.approvedAt)}
                      </td>

                      {/* Column 7: ACTION MENU (···) */}
                      <td className="py-4 px-4 text-right whitespace-nowrap relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenActionId(openActionId === item.id ? null : item.id)
                          }
                          className="action-menu-trigger p-1.5 rounded-lg text-[#9B9EA4] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          title="Actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Action Popover Menu matching user image */}
                        {openActionId === item.id && (
                          <div className="action-menu-dropdown absolute right-4 top-12 min-w-[170px] rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] p-1.5 shadow-2xl z-30 text-left space-y-0.5 animate-scale-in">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionId(null);
                                window.open(`/admin/dashboard`, "_blank");
                              }}
                              className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#FE760B] hover:bg-[#FE760B]/10 transition-colors cursor-pointer block"
                            >
                              Inspect portal →
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResetLogin(item)}
                              className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-white hover:bg-white/5 transition-colors cursor-pointer block"
                            >
                              Reset login
                            </button>

                            <button
                              type="button"
                              onClick={() => handleViewEvent(item)}
                              className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-white hover:bg-white/5 transition-colors cursor-pointer block"
                            >
                              View event
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEmailOrganiser(item)}
                              className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-white hover:bg-white/5 transition-colors cursor-pointer block"
                            >
                              Email organiser
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer matching Image 1 */}
      <div className="flex items-center justify-between pt-1">
        {/* Left: Showing X of Y */}
        <div className="text-xs text-[#71767B]">
          Showing {paginatedOrganisers.length} of {filteredOrganisers.length}
        </div>

        {/* Right: Previous, Page/Total, Next */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
            className="px-3.5 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs font-semibold text-white hover:bg-[#2A2D31] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <span className="text-xs text-[#9B9EA4] font-medium font-mono">
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            className="px-3.5 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs font-semibold text-white hover:bg-[#2A2D31] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {/* Password Reset Modal Dialog */}
      {resetModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FE760B]/15 text-[#FE760B] flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Reset Login Link</h3>
                  <p className="text-xs text-[#9B9EA4] truncate max-w-[260px]">
                    {resetModalData.name} ({resetModalData.email})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setResetModalData(null)}
                className="text-[#9B9EA4] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#9B9EA4]">
                Password Reset Link:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={resetModalData.resetLink}
                  className="w-full h-10 px-3 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs font-mono text-[#D0D0D1] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(resetModalData.resetLink);
                    setCopiedLink(true);
                    toast.success("Copied reset link to clipboard!");
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 h-10 rounded-xl bg-[#212327] border border-[#2A2D31] hover:border-[#FE760B] text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#3DD68C]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-[#71767B]">
                {resetModalData.emailSent
                  ? `An email has been dispatched to ${resetModalData.email}. You can also share the link above directly.`
                  : `Link copied to clipboard! Share this link directly with ${resetModalData.email} to set a new password.`}
              </p>
            </div>

            <div className="pt-2 border-t border-[#2A2D31] flex items-center justify-end gap-3">
              <a
                href={resetModalData.resetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
              >
                <span>Open link</span>
                <ExternalLink className="w-3 h-3 text-[#9B9EA4]" />
              </a>

              <button
                type="button"
                onClick={() => setResetModalData(null)}
                className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FE760B]/90 text-xs font-bold text-[#131517] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
