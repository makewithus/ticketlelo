"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Download,
  Search,
  Users,
  CheckCircle2,
  Clock,
  Ticket,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  getAllEvents,
  getEventsByOrganiser,
  getEvent,
  subscribeToEventRegistrations,
} from "@/lib/firestore";
import { useAuth } from "@/context/auth-context";

export function RegistrationManagement() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);

  // IMPORTANT: Use "" instead of null
  const [selectedEventId, setSelectedEventId] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  /* =========================
     LOAD EVENTS ON MOUNT
  ==========================*/
  useEffect(() => {
    const loadEvents = async () => {
      if (!user) return;
      
      try {
        let allEvents;
        
        // SuperAdmin sees all events
        if (user.role === "superAdmin") {
          allEvents = await getAllEvents();
        } else if (user.role === "organiser") {
          // Organisers only see their own event
          allEvents = await getEventsByOrganiser(user.id);
          
          // Auto-select the organiser's event
          if (allEvents.length > 0) {
            setSelectedEventId(allEvents[0].id);
          }
        } else {
          allEvents = [];
        }
        
        const uniqueEvents = [];
        const seenIds = new Set();
        for (const ev of (allEvents || [])) {
          if (ev && ev.id && !seenIds.has(ev.id)) {
            seenIds.add(ev.id);
            uniqueEvents.push(ev);
          }
        }
        
        setEvents(uniqueEvents);
      } catch (error) {
        console.error("Error loading events:", error);
        toast.error("Failed to load events");
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();
  }, [user]);

  /* =========================
     LOAD REGISTRATIONS
  ==========================*/
  useEffect(() => {
    if (!selectedEventId) {
      const timer = setTimeout(() => {
        setRegistrations((prev) => (prev.length === 0 ? prev : []));
      }, 0);
      return () => clearTimeout(timer);
    }

    let unsubscribe;

    const loadData = async () => {
      try {
        unsubscribe = subscribeToEventRegistrations(
          selectedEventId,
          (regData) => {
            setRegistrations(regData || []);
          },
        );
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load registrations");
      }
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedEventId]);

  /* =========================
     FILTERING
  ==========================*/
  const filteredRegistrations = registrations.filter((reg) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      (reg.fullName || "").toLowerCase().includes(search) ||
      (reg.email || "").toLowerCase().includes(search) ||
      (reg.whatsappPhone || "").includes(search) ||
      (reg.ticketId || "").includes(search);

    return matchesSearch;
  });

  /* =========================
     EXPORT TO EXCEL
  ==========================*/
  const exportToExcel = async () => {
    if (filteredRegistrations.length === 0) {
      toast.error("No registrations to export");
      return;
    }

    setIsExporting(true);

    try {
      const eventData = await getEvent(selectedEventId);

      const exportData = filteredRegistrations.map((reg) => ({
        "Ticket ID": reg.ticketId || "",
        "Full Name": reg.fullName || "",
        Email: reg.email || "",
        "WhatsApp Phone": reg.whatsappPhone || "",
        Event: eventData?.name || "Unknown",
        Status: reg.status || "",
        "Registered Date": reg.createdAt?.toDate
          ? reg.createdAt.toDate().toLocaleDateString()
          : reg.createdAt
            ? new Date(reg.createdAt).toLocaleDateString()
            : "N/A",
        "Used Date": reg.usedAt?.toDate
          ? reg.usedAt.toDate().toLocaleDateString()
          : reg.usedAt
            ? new Date(reg.usedAt).toLocaleDateString()
            : "-",
        Message: reg.message || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

      worksheet["!cols"] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 25 },
        { wch: 18 },
        { wch: 20 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 30 },
      ];

      const fileName = `registrations-${
        eventData?.name || "export"
      }-${new Date().toISOString().split("T")[0]}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      toast.success("Registrations exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export registrations");
    } finally {
      setIsExporting(false);
    }
  };

  /* =========================
     STATS
  ==========================*/
  const stats = {
    total: filteredRegistrations.length,
    used: filteredRegistrations.filter((r) => r.status === "Used").length,
    unused: filteredRegistrations.filter((r) => r.status === "Unused").length,
  };

  /* =========================
     UI
  ==========================*/
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold text-white">Registrations</h2>
        <p className="text-[#9B9EA4] mt-1">
          View and manage event registrations
        </p>
      </div>

      {/* EVENT SELECT */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium flex items-center gap-1 text-[#FE760B]">
            <Filter className="w-3.5 h-3.5" /> {user?.role === "organiser" ? "Your Event" : "Event"}
          </label>

          {user?.role === "organiser" ? (
            /* Show event name for organisers (not editable) */
            <div className="w-full h-10 px-3 py-2 bg-[#1A1C1F] border border-[#2A2D31] rounded-md text-white flex items-center">
              {events.length > 0 ? (
                <span className="font-medium">{events[0].name}</span>
              ) : (
                <span className="text-gray-400">No event created</span>
              )}
            </div>
          ) : (
            /* Show dropdown for superadmin */
            <Select
              value={selectedEventId}
              onValueChange={(val) => {
                setSelectedEventId(val);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((event, idx) => (
                  <SelectItem key={`${event.id || "event"}-${idx}`} value={event.id}>
                    {event.name || event.title || "Untitled Event"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* SEARCH */}
        <div>
          <label className="text-sm font-medium flex items-center gap-1 text-[#FE760B]">
            <Search className="w-3.5 h-3.5" /> Search
          </label>

          <Input
            placeholder="Name, email, ticket ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#1A1C1F] border-[#2A2D31] text-white placeholder-gray-400"
          />
        </div>

        {/* EXPORT */}
        {selectedEventId && (
          <div className="flex items-end">
            <Button
              onClick={exportToExcel}
              disabled={isExporting || filteredRegistrations.length === 0}
              className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-sm transition-colors rounded-xl h-10 shadow-sm"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export to Excel
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* STATS */}
      {selectedEventId && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="p-3 sm:p-4 border border-[#2A2D31] bg-[#1A1C1F] rounded-xl text-center">
            <Users className="mx-auto mb-2 text-[#FE760B] w-4 h-4 sm:w-5 sm:h-5" />
            <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{stats.total}</p>
            <p className="text-[11px] sm:text-xs text-[#9B9EA4] mt-0.5">Total</p>
          </div>

          <div className="p-3 sm:p-4 border border-[#2A2D31] bg-[#1A1C1F] rounded-xl text-center">
            <CheckCircle2 className="mx-auto mb-2 text-[#3DD68C] w-4 h-4 sm:w-5 sm:h-5" />
            <p className="text-xl sm:text-2xl font-bold text-[#3DD68C] tabular-nums">{stats.used}</p>
            <p className="text-[11px] sm:text-xs text-[#9B9EA4] mt-0.5">Checked in</p>
          </div>

          <div className="p-3 sm:p-4 border border-[#2A2D31] bg-[#1A1C1F] rounded-xl text-center">
            <Clock className="mx-auto mb-2 text-[#FDE003] w-4 h-4 sm:w-5 sm:h-5" />
            <p className="text-xl sm:text-2xl font-bold text-[#FDE003] tabular-nums">{stats.unused}</p>
            <p className="text-[11px] sm:text-xs text-[#9B9EA4] mt-0.5">Unused</p>
          </div>
        </div>
      )}

      {/* REGISTRATIONS TABLE */}
      {selectedEventId && (
        <div className="rounded-2xl border border-[#2A2D31] bg-[#1A1C1F] overflow-hidden mt-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2A2D31]">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                    Ticket ID
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider whitespace-nowrap min-w-[150px]">
                    Full Name
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                    Email
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider whitespace-nowrap min-w-[130px]">
                    Phone
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                    Registered
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D31]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#FE760B]" />
                    </td>
                  </tr>
                ) : filteredRegistrations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-[#9B9EA4]"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#FE760B]/10 flex items-center justify-center mx-auto mb-3">
                        <Ticket className="w-6 h-6 text-[#FE760B]" />
                      </div>
                      No registrations found
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => {
                    const isUsed = reg.status === "Used" || reg.status === "checked_in";
                    return (
                      <tr
                        key={reg.id}
                        className="hover:bg-[#212327]/60 transition-colors"
                      >
                        <td className="px-5 py-4 text-sm font-mono text-[#FE760B]">
                          {reg.ticketId}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-white">
                          {reg.fullName || "-"}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#D0D0D1]">{reg.email || "-"}</td>
                        <td className="px-5 py-4 text-sm text-[#D0D0D1]">
                          {reg.whatsappPhone || "-"}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {isUsed ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#3DD68C]/12 text-[#3DD68C] border border-[#3DD68C]/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                              Checked in
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FE760B]/14 text-[#FE760B] border border-[#FE760B]/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
                              Unused
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#9B9EA4]">
                          {reg.createdAt?.toDate
                            ? reg.createdAt.toDate().toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : reg.createdAt
                              ? new Date(reg.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "N/A"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedEventId && (
        <div className="text-center py-20 bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-[#FE760B]/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[#FE760B]" />
          </div>
          <h3 className="text-xl font-bold text-white">Select an event</h3>
          <p className="text-sm text-[#9B9EA4] mt-1">
            Choose an event above to view registrations
          </p>
        </div>
      )}
    </div>
  );
}
