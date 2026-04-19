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
        
        setEvents(allEvents || []);
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
      setRegistrations([]);
      return;
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
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Registrations</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
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
            <div className="w-full h-10 px-3 py-2 bg-white dark:bg-black/50 border border-[#FE760B]/30 rounded-md text-gray-900 dark:text-white flex items-center">
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
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
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
            className="bg-white dark:bg-black/50 border-[#FE760B]/30 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        {/* EXPORT */}
        {selectedEventId && (
          <div className="flex items-end">
            <Button
              onClick={exportToExcel}
              disabled={isExporting || filteredRegistrations.length === 0}
              className="w-full"
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
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border border-[#FE760B]/30 bg-white dark:bg-black/50 rounded-xl text-center">
            <Users className="mx-auto mb-2 text-[#FE760B]" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            <p className="text-gray-500 dark:text-gray-400">Total</p>
          </div>

          <div className="p-4 border border-[#FE760B]/30 bg-white dark:bg-black/50 rounded-xl text-center">
            <CheckCircle2 className="mx-auto mb-2 text-[#FE760B]" />
            <p className="text-2xl font-bold text-[#FE760B]">{stats.used}</p>
            <p className="text-gray-500 dark:text-gray-400">Scanned</p>
          </div>

          <div className="p-4 border border-[#FE760B]/30 bg-white dark:bg-black/50 rounded-xl text-center">
            <Clock className="mx-auto mb-2 text-yellow-500" />
            <p className="text-2xl font-bold text-yellow-500">{stats.unused}</p>
            <p className="text-gray-500 dark:text-gray-400">Pending</p>
          </div>
        </div>
      )}

      {/* REGISTRATIONS TABLE */}
      {selectedEventId && (
        <div className="rounded-2xl border border-[#FE760B]/30 bg-white dark:bg-black/50 overflow-hidden mt-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#FE760B]/20">
                  <th className="px-5 py-4 text-left text-xs font-semibold text-[#FE760B] uppercase tracking-wider">
                    Ticket ID
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-[#FE760B] uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-[#FE760B] uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-[#FE760B] uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-[#FE760B] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-[#FE760B] uppercase tracking-wider">
                    Registered
                  </th>
                </tr>
              </thead>
                <tbody className="divide-y divide-[#FE760B]/10">
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
                      className="px-5 py-12 text-center text-gray-400"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#FE760B]/10 flex items-center justify-center mx-auto mb-3">
                        <Ticket className="w-6 h-6 text-[#FE760B]" />
                      </div>
                      No registrations found
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <tr
                      key={reg.id}
                      className="hover:bg-[#FE760B]/5 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm font-mono text-[#FE760B]">
                        {reg.ticketId}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {reg.fullName || "-"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">{reg.email || "-"}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {reg.whatsappPhone || "-"}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${reg.status === "Used" ? "bg-[#FE760B]/20 text-[#FE760B] border border-[#FE760B]/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}
                        >
                          {reg.status === "Used" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {reg.status || "-"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {reg.createdAt?.toDate
                          ? reg.createdAt.toDate().toLocaleDateString()
                          : reg.createdAt
                            ? new Date(reg.createdAt).toLocaleDateString()
                            : "N/A"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedEventId && (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-[#FE760B]/10 flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-[#FE760B]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Select an Event</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Choose an event above to view registrations
          </p>
        </div>
      )}
    </div>
  );
}
