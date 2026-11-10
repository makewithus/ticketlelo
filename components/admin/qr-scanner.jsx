"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Ticket,
  Camera,
  Keyboard,
  Volume2,
  VolumeX,
  MapPin,
  Loader2,
  Check,
  ChevronDown,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { parseQRData } from "@/lib/qr";
import Html5QrcodePlugin from "@/components/admin/html5-qrcode-plugin";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { queueOfflineScan } from "@/lib/offline-checkin";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import {
  getEventsByOrganiser,
  getAllEvents,
  subscribeToEvent,
  subscribeToEventRegistrations,
} from "@/lib/firestore";
import { getSubEventsForEvent } from "@/lib/sub-events";
import { GuestDetailsModal } from "@/components/admin/guest-details-modal";
import { useAuth } from "@/context/auth-context";

const DEFAULT_GATE_STATIONS = [
  { id: "main_gate", label: "Main Festival Gate" },
  { id: "track_workshop", label: "AI Workshop Hall" },
  { id: "track_hackathon", label: "Hackathon Dev Room" },
  { id: "track_proshow", label: "Pro Show Concert Arena" },
  { id: "track_gaming", label: "Gaming Arena" },
  { id: "track_robowars", label: "RoboWars Arena" },
];

export function QRScanner({ event: propEvent = null, eventId: propEventId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Active event & registrations state
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(propEventId || propEvent?.id || "");
  const [currentEvent, setCurrentEvent] = useState(propEvent || null);
  const [eventRegistrations, setEventRegistrations] = useState([]);
  const [showEventDropdown, setShowEventDropdown] = useState(false);

  // Station dropdown state
  const [selectedStation, setSelectedStation] = useState("main_gate");
  const [isStationDropdownOpen, setIsStationDropdownOpen] = useState(false);
  const [subEvents, setSubEvents] = useState([]);

  // Scanning & UI state
  const [manualTicketId, setManualTicketId] = useState("");
  const [scanHistory, setScanHistory] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);

  const [useManualEntry, setUseManualEntry] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraPermissionDismissed, setCameraPermissionDismissed] = useState(false);
  const [cameraRetryKey, setCameraRetryKey] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flashColor, setFlashColor] = useState(null); // 'green' | 'red' | 'orange' | null

  // Fast local memory cache for sub-second duplicate detection at this gate
  const localScanCache = useRef(new Set());
  const stationDropdownRef = useRef(null);
  const eventDropdownRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  // ── 1. Resolve and Load Organizer Events ──
  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      try {
        let eventsList = [];
        if (user?.uid) {
          try {
            const userId = user.uid;
            let list = await getEventsByOrganiser(userId);
            if (!list || list.length === 0) {
              const all = await getAllEvents();
              list = (all || []).filter(
                (e) =>
                  e.createdBy === userId ||
                  e.userId === userId ||
                  e.organiserId === userId ||
                  e.organizerId === userId
              );
            }
            eventsList = list;
          } catch {
            eventsList = [];
          }
        } else {
          eventsList = await getAllEvents();
        }

        if (!isMounted) return;

        // Deduplicate events
        const unique = [];
        const seen = new Set();
        for (const ev of eventsList) {
          if (ev?.id && !seen.has(ev.id)) {
            seen.add(ev.id);
            unique.push(ev);
          }
        }
        setEvents(unique);

        const paramId = searchParams.get("eventId");
        let initialId = propEventId || propEvent?.id || "";

        if (paramId && unique.some((e) => e.id === paramId)) {
          initialId = paramId;
        } else if (!initialId) {
          let cachedId = null;
          try {
            cachedId = localStorage.getItem("admin_selected_event_id");
          } catch {}
          if (cachedId && unique.some((e) => e.id === cachedId)) {
            initialId = cachedId;
          } else if (unique.length > 0) {
            // Find "Tech Fest 2026" or first available event
            const techFest = unique.find((e) =>
              (e.name || "").toLowerCase().includes("tech fest")
            );
            initialId = techFest ? techFest.id : unique[0].id;
          }
        }

        if (initialId) {
          setSelectedEventId(initialId);
          try {
            localStorage.setItem("admin_selected_event_id", initialId);
          } catch {}
        }
      } catch (err) {
        console.error("Failed to load events for QR Scanner:", err);
      }
    };

    loadEvents();
    return () => {
      isMounted = false;
    };
  }, [user, searchParams, propEventId, propEvent]);

  // ── 2. Real-Time Subscription to Active Event Details & Sub-Events ──
  useEffect(() => {
    if (!selectedEventId) return;

    const unsub = subscribeToEvent(selectedEventId, (ev) => {
      if (ev) setCurrentEvent(ev);
    });

    getSubEventsForEvent(selectedEventId)
      .then((subs) => {
        if (Array.isArray(subs) && subs.length > 0) {
          setSubEvents(subs);
        } else {
          setSubEvents([]);
        }
      })
      .catch(() => setSubEvents([]));

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [selectedEventId]);

  // Derived counts from real-time event registrations
  const totalGuests = eventRegistrations.length;
  const checkedInCount = useMemo(() => {
    return eventRegistrations.filter(
      (r) => r.status === "Used" || r.checkedIn === true
    ).length;
  }, [eventRegistrations]);

  // ── 3. Real-Time Subscription to Registrations for THIS EVENT ONLY ──
  useEffect(() => {
    if (!selectedEventId) {
      const timer = setTimeout(() => {
        setEventRegistrations([]);
        setScanHistory([]);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Subscribe exclusively to registrations belonging to the current active event
    const unsub = subscribeToEventRegistrations(selectedEventId, (regs) => {
      setEventRegistrations(regs);

      // Populate recent scans list from real check-ins for THIS event
      const usedRegs = regs
        .filter((r) => r.status === "Used" || r.checkedIn === true)
        .sort((a, b) => {
          const timeA = a.usedAt?.toDate?.() || a.checkedInAt?.toDate?.() || new Date(a.updatedAt?.toDate?.() || 0);
          const timeB = b.usedAt?.toDate?.() || b.checkedInAt?.toDate?.() || new Date(b.updatedAt?.toDate?.() || 0);
          return timeB - timeA;
        })
        .slice(0, 10);

      const colors = [
        "bg-blue-600 text-white",
        "bg-pink-600 text-white",
        "bg-emerald-600 text-white",
        "bg-purple-600 text-white",
      ];

      const realScans = usedRegs.map((r, i) => {
        const name = r.fullName || r.name || r.attendeeName || r.buyerName || "Admitted Guest";
        const initials =
          name
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "OK";

        const timeObj =
          r.usedAt?.toDate?.() ||
          r.checkedInAt?.toDate?.() ||
          r.updatedAt?.toDate?.() ||
          new Date();

        const timeStr = timeObj.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });

        return {
          id: `real-${r.id}`,
          attendee: name,
          ticketId: r.ticketId || `TKT-${r.id.slice(0, 8)}`,
          status: "valid",
          time: timeStr,
          avatar: initials,
          avatarBg: colors[i % colors.length],
          guest: r,
        };
      });

      setScanHistory(realScans);
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [selectedEventId]);

  // ── 4. Dynamic Gate Stations calculation ──
  const gateStations = useMemo(() => {
    if (subEvents && subEvents.length > 0) {
      return [
        { id: "main_gate", label: "Main Festival Gate" },
        ...subEvents.map((sub) => ({
          id: sub.id,
          label: sub.title || sub.name || "Track Gate",
        })),
      ];
    }
    return DEFAULT_GATE_STATIONS;
  }, [subEvents]);

  // ── 5. Close Dropdowns on Click Outside ──
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        stationDropdownRef.current &&
        !stationDropdownRef.current.contains(event.target)
      ) {
        setIsStationDropdownOpen(false);
      }
      if (
        eventDropdownRef.current &&
        !eventDropdownRef.current.contains(event.target)
      ) {
        setShowEventDropdown(false);
      }
    }
    if (isStationDropdownOpen || showEventDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isStationDropdownOpen, showEventDropdown]);

  // Handle switching active event
  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId);
    setShowEventDropdown(false);
    try {
      localStorage.setItem("admin_selected_event_id", eventId);
    } catch {}
    router.replace(`/admin/scanner?eventId=${eventId}`);
    toast.success("Switched active scanner event");
  };

  // Web Audio feedback chimes
  const playFeedbackSound = (type) => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "admitted") {
        // High upbeat chime (880Hz -> 1320Hz)
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else {
        // Low double-buzz (220Hz)
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // AudioCtx might be blocked until user gesture, safe to ignore
    }
  };

  const triggerVisualFlash = (color) => {
    setFlashColor(color);
    setTimeout(() => setFlashColor(null), 1200);
  };

  // Ticket verification logic with Event-Level Isolation
  const verifyTicketPayload = async (payload) => {
    setIsProcessing(true);
    const code = (payload.ticketId || payload.rawQRData || "").trim();
    const cacheKey = `${selectedStation}:${code}`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    // 1. Fast local memory duplicate check
    if (localScanCache.current.has(cacheKey)) {
      triggerVisualFlash("orange");
      playFeedbackSound("denied");
      const duplicateRecord = {
        id: `scan-${Date.now()}`,
        attendee: payload.attendeeName || "Duplicate Ticket",
        ticketId: code || "Scanned Ticket",
        status: "invalid",
        time: timeStr,
        avatar: "!",
        avatarBg: "bg-amber-600 text-white",
      };
      setScanHistory((prev) => [duplicateRecord, ...prev].slice(0, 10));
      toast.warning("DUPLICATE SCAN - Already checked in at this gate!");
      setIsProcessing(false);
      return;
    }

    try {
      // 2. Direct Real-Time Firestore Verification against database
      let dbTicket = null;
      let dbRef = null;

      try {
        const qReg = query(collection(db, "registrations"), where("ticketId", "==", code));
        const regSnap = await getDocs(qReg);
        if (!regSnap.empty) {
          dbRef = regSnap.docs[0].ref;
          dbTicket = { id: regSnap.docs[0].id, ...regSnap.docs[0].data() };
        } else {
          const qTicket = query(collection(db, "tickets"), where("ticketId", "==", code));
          const tSnap = await getDocs(qTicket);
          if (!tSnap.empty) {
            dbRef = tSnap.docs[0].ref;
            dbTicket = { id: tSnap.docs[0].id, ...tSnap.docs[0].data() };
          }
        }
      } catch (dbErr) {
        console.warn("Client Firestore lookup warning:", dbErr);
      }

      if (dbTicket) {
        // Enforce event isolation: ticket must belong to the active event
        if (selectedEventId && dbTicket.eventId && dbTicket.eventId !== selectedEventId) {
          triggerVisualFlash("red");
          playFeedbackSound("denied");
          const wrongEventRecord = {
            id: `scan-${Date.now()}`,
            attendee: dbTicket.fullName || "Cross-Event Ticket",
            ticketId: code,
            status: "invalid",
            time: timeStr,
            avatar: "!",
            avatarBg: "bg-red-600 text-white",
          };
          setScanHistory((prev) => [wrongEventRecord, ...prev].slice(0, 10));
          toast.error("DENIED: This ticket is for a different event!");
          setIsProcessing(false);
          return;
        }

        const attendeeName = dbTicket.fullName || dbTicket.name || dbTicket.buyerName || "Verified Guest";
        const isAlreadyUsed = dbTicket.status === "Used" || dbTicket.checkedIn === true;

        if (isAlreadyUsed) {
          triggerVisualFlash("orange");
          playFeedbackSound("denied");
          const duplicateRecord = {
            id: `scan-${Date.now()}`,
            attendee: attendeeName,
            ticketId: code,
            status: "invalid",
            time: timeStr,
            avatar: "!",
            avatarBg: "bg-amber-600 text-white",
          };
          setScanHistory((prev) => [duplicateRecord, ...prev].slice(0, 10));
          toast.warning(`DUPLICATE SCAN: ${attendeeName} is already checked in!`);
          setIsProcessing(false);
          return;
        }

        // Valid & Unused: update database in real-time
        if (dbRef) {
          try {
            await updateDoc(dbRef, {
              status: "Used",
              checkedIn: true,
              usedAt: Timestamp.now(),
              checkedInAt: Timestamp.now(),
              checkedInStation: selectedStation,
              checkedInBy: user?.displayName || user?.fullName || "Admin",
            });
          } catch (writeErr) {
            console.warn("Firestore status update warning:", writeErr);
          }
        }

        localScanCache.current.add(cacheKey);
        triggerVisualFlash("green");
        playFeedbackSound("admitted");
        setEventRegistrations((prev) =>
          prev.map((r) =>
            r.ticketId === code || r.id === dbTicket?.id
              ? { ...r, status: "Used", checkedIn: true, usedAt: Timestamp.now() }
              : r
          )
        );

        const newScan = {
          id: `scan-${Date.now()}`,
          attendee: attendeeName,
          ticketId: code,
          status: "valid",
          time: timeStr,
          avatar: attendeeName
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "OK",
          avatarBg: "bg-blue-600 text-white",
          guest: dbTicket,
        };

        setScanHistory((prev) => [newScan, ...prev].slice(0, 10));
        toast.success(`ADMITTED: Welcome ${attendeeName}!`);
        setIsProcessing(false);
        return;
      }

      // 3. Fallback to API route if needed
      let idToken = "";
      try {
        if (auth?.currentUser) {
          idToken = await auth.currentUser.getIdToken();
        }
      } catch {
        // safe ignore
      }

      const response = await fetch("/api/verify-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          rawQRData: payload.rawQRData,
          ticketId: code,
          eventId: selectedEventId,
          gateStationSubEventId: selectedStation,
        }),
      });

      const result = await response.json();
      const isValid = result.status === "admitted" || result.status === "valid";
      const attendeeName =
        result.attendee ||
        result.user ||
        payload.attendeeName ||
        (isValid ? "Verified Guest" : "Unknown ticket");

      const newScan = {
        id: `scan-${Date.now()}`,
        attendee: attendeeName,
        ticketId: code || "QR-PASS",
        status: isValid ? "valid" : "invalid",
        time: timeStr,
        avatar: isValid
          ? attendeeName
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "OK"
          : "?",
        avatarBg: isValid ? "bg-emerald-600 text-white" : "bg-[#2A2D31] text-[#9B9EA4]",
      };

      setScanHistory((prev) => [newScan, ...prev].slice(0, 10));

      if (isValid) {
        localScanCache.current.add(cacheKey);
        triggerVisualFlash("green");
        playFeedbackSound("admitted");
        setEventRegistrations((prev) =>
          prev.map((r) =>
            r.ticketId === code ? { ...r, status: "Used", checkedIn: true } : r
          )
        );
        toast.success(`ADMITTED: Welcome ${attendeeName}!`);
      } else {
        triggerVisualFlash("red");
        playFeedbackSound("denied");
        toast.error(`DENIED: ${result.message || "Invalid ticket"}`);
      }
    } catch (error) {
      console.warn("[qr-scanner] Network offline, switching to offline check-in queue:", error);
      const offlineRecord = queueOfflineScan({
        ticketId: code || "OFFLINE_QR",
        rawQRData: payload.rawQRData,
        gateStationSubEventId: selectedStation,
      });

      const isValid = offlineRecord.status === "offline_provisional_admitted";
      const newScan = {
        id: `scan-${Date.now()}`,
        attendee: offlineRecord.attendeeName || "Offline Guest",
        ticketId: offlineRecord.ticketId,
        status: isValid ? "valid" : "invalid",
        time: timeStr,
        avatar: isValid ? "OG" : "!",
        avatarBg: isValid ? "bg-emerald-600 text-white" : "bg-amber-600 text-white",
      };

      setScanHistory((prev) => [newScan, ...prev].slice(0, 10));

      if (isValid) {
        triggerVisualFlash("green");
        playFeedbackSound("admitted");
        setEventRegistrations((prev) =>
          prev.map((r) =>
            r.ticketId === code ? { ...r, status: "Used", checkedIn: true } : r
          )
        );
        toast.info("OFFLINE: Provisional check-in queued for sync");
      } else {
        triggerVisualFlash("orange");
        playFeedbackSound("denied");
        toast.warning("OFFLINE DUPLICATE: Already scanned locally");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQRScan = async (decodedText) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 1800) return;
    lastScanTimeRef.current = now;

    try {
      if (decodedText.startsWith("TLSEC:")) {
        await verifyTicketPayload({ rawQRData: decodedText });
      } else {
        const ticketId = parseQRData(decodedText);
        await verifyTicketPayload({ rawQRData: decodedText, ticketId });
      }
    } catch (error) {
      console.error("QR scan error:", error);
      toast.error("Unrecognized QR code format");
    }
  };

  const handleManualEntry = async () => {
    if (!manualTicketId.trim()) {
      toast.error("Please enter a ticket ID");
      return;
    }
    await verifyTicketPayload({ ticketId: manualTicketId.trim() });
    setManualTicketId("");
  };

  // Simulate a scan action - prioritizes real registered guests for the active event
  const handleSimulateScan = () => {
    // If event has real registered guests who are not yet checked in, simulate admission for them
    const pendingGuests = eventRegistrations.filter(
      (r) => r.status !== "Used" && r.checkedIn !== true
    );

    let candidateName = "Simulated Guest";
    let candidateCode = `TKT-${Date.now().toString().slice(-6)}`;
    let isValid = true;
    let bg = "bg-purple-600 text-white";

    if (pendingGuests.length > 0) {
      const pick = pendingGuests[Math.floor(Math.random() * pendingGuests.length)];
      candidateName = pick.fullName || pick.name || "Registered Guest";
      candidateCode = pick.ticketId || pick.id;
      isValid = true;
      bg = "bg-blue-600 text-white";
    } else {
      const candidates = [
        { name: "Priya Sharma", code: "TKT-1793-PR89Q", valid: true, bg: "bg-purple-600 text-white" },
        { name: "Rohan Verma", code: "TKT-1793-RV44X", valid: true, bg: "bg-emerald-600 text-white" },
        { name: "Unknown ticket", code: "TKT-1701-XX99E", valid: false, bg: "bg-[#2A2D31] text-[#9B9EA4]" },
      ];
      const fallback = candidates[Math.floor(Math.random() * candidates.length)];
      candidateName = fallback.name;
      candidateCode = fallback.code;
      isValid = fallback.valid;
      bg = fallback.bg;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    const newScan = {
      id: `sim-${Date.now()}`,
      attendee: candidateName,
      ticketId: candidateCode,
      status: isValid ? "valid" : "invalid",
      time: timeStr,
      avatar: isValid
        ? candidateName
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        : "?",
      avatarBg: bg,
    };

    if (isValid) {
      triggerVisualFlash("green");
      playFeedbackSound("admitted");
      setEventRegistrations((prev) =>
        prev.map((r) =>
          r.ticketId === candidateCode || r.id === candidateCode
            ? { ...r, status: "Used", checkedIn: true }
            : r
        )
      );
      toast.success(`ADMITTED: Welcome ${candidateName}!`);
    } else {
      triggerVisualFlash("red");
      playFeedbackSound("denied");
      toast.error(`DENIED: Invalid ticket ${candidateCode}`);
    }

    setScanHistory((prev) => [newScan, ...prev].slice(0, 10));
  };

  const currentStationLabel = useMemo(() => {
    return gateStations.find((s) => s.id === selectedStation)?.label || "Main Festival Gate";
  }, [gateStations, selectedStation]);

  const isCancelled = Boolean(currentEvent?.isCancelled || currentEvent?.status === "cancelled");

  return (
    <div className="w-full text-white selection:bg-[#FE760B] selection:text-white pb-10">
      {/* ── Standard Navigation Header with Live Event Switcher ── */}
      <EventControlHeader
        activeTab="Check-In"
        eventTitle={currentEvent?.name || currentEvent?.title || ""}
        eventSlug={currentEvent?.slug || currentEvent?.id || ""}
        eventId={selectedEventId}
        isLive={currentEvent?.isLive !== false && !isCancelled}
        isCancelled={isCancelled}
        extraActions={
          <div className="flex items-center gap-2">
            {events.length > 1 && (
              <div className="relative" ref={eventDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowEventDropdown(!showEventDropdown)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] text-xs font-semibold text-white transition-colors"
                  title="Switch active event"
                >
                  <span className="truncate max-w-[120px]">
                    {currentEvent?.name || "Switch Event"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#9B9EA4]" />
                </button>

                {showEventDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-2xl z-50 overflow-hidden py-1 divide-y divide-[#2A2D31]/60">
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4]">
                      Your Events ({events.length})
                    </div>
                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                      {events.map((ev, idx) => (
                        <button
                          key={`${ev.id}-${idx}`}
                          type="button"
                          onClick={() => handleSelectEvent(ev.id)}
                          className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 hover:bg-white/5 transition-colors ${
                            ev.id === selectedEventId ? "bg-[#FE760B]/10 text-[#FE760B] font-bold" : "text-white"
                          }`}
                        >
                          <span className="truncate">{ev.name}</span>
                          {ev.id === selectedEventId && <Check className="w-3.5 h-3.5 shrink-0 text-[#FE760B]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute chime" : "Enable chime"}
              className="p-2 rounded-xl border border-[#2A2D31] bg-[#1A1C1F] hover:bg-[#212327] text-[#9B9EA4] hover:text-white transition-colors"
            >
              {soundEnabled ? (
                <Volume2 size={14} className="text-[#3DD68C]" />
              ) : (
                <VolumeX size={14} />
              )}
            </button>
          </div>
        }
      />

      {/* ── Cancelled Event Guard Banner ── */}
      {isCancelled && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-start gap-3 max-w-5xl mx-auto">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-rose-400">
              Check-In Disabled (Event Cancelled)
            </h4>
            <p className="text-xs text-rose-200/80 leading-relaxed">
              This event is cancelled. QR ticket validation, gate scanning, and attendee check-in are permanently stopped. Attendee lists remain visible below in View-Only Mode.
            </p>
          </div>
        </div>
      )}

      {/* ── 3. Main Two-Column Layout strictly matching Image 1 ── */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 items-start max-w-5xl mx-auto w-full ${isCancelled ? 'opacity-60 pointer-events-none select-none' : ''}`}>
        {/* ── Left Column: QR Viewfinder & Controls ── */}
        <div className="w-full flex flex-col items-center">
          {/* Camera / Manual Entry Mode Toggle matching Image 1 */}
          <div className="w-full flex p-1 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] mb-4">
            <button
              type="button"
              onClick={() => setUseManualEntry(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                !useManualEntry
                  ? "bg-[#212327] text-white shadow-sm"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              <Camera size={14} className="shrink-0" />
              <span>Camera</span>
            </button>
            <button
              type="button"
              onClick={() => setUseManualEntry(true)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                useManualEntry
                  ? "bg-[#212327] text-white shadow-sm"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              <Keyboard size={14} className="shrink-0" />
              <span>Manual entry</span>
            </button>
          </div>

          {!useManualEntry ? (
            /* ── Camera Viewfinder Box with Brackets & Animated Laser matching Image 1 ── */
            <>
              <div className="relative w-full aspect-square max-h-[380px] sm:max-h-[420px] rounded-2xl bg-[#0B0C0E] border border-[#2A2D31] overflow-hidden flex items-center justify-center shadow-2xl">
                {/* Background live camera stream */}
                <div className="absolute inset-0 z-0">
                  <Html5QrcodePlugin
                    key={`scanner-key-${cameraRetryKey}`}
                    fps={20}
                    qrbox={260}
                    aspectRatio={1.0}
                    disableFlip={false}
                    onSuccess={handleQRScan}
                    onReady={() => {
                      setScannerReady(true);
                      setCameraError(null);
                      setCameraPermissionDismissed(false);
                    }}
                    onError={(err, friendlyMsg) => {
                      setScannerReady(false);
                      setCameraError(friendlyMsg);
                      const isDismissed =
                        err?.name === "NotAllowedError" ||
                        String(err?.message || "").toLowerCase().includes("permission dismissed") ||
                        String(err?.message || "").toLowerCase().includes("permission denied");
                      setCameraPermissionDismissed(isDismissed);
                    }}
                  />
                </div>

                {/* Translucent vignette overlay for reticle contrast */}
                <div className="absolute inset-0 bg-black/35 pointer-events-none z-10" />

                {/* Color Flash on scan result */}
                {flashColor && (
                  <div
                    className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 ${
                      flashColor === "green"
                        ? "bg-emerald-500/25 ring-4 ring-emerald-500 inset-0"
                        : flashColor === "red"
                        ? "bg-red-500/25 ring-4 ring-red-500 inset-0"
                        : "bg-amber-500/25 ring-4 ring-amber-500 inset-0"
                    }`}
                  />
                )}

                {/* ── 4 White Corner Brackets forming Reticle Frame ── */}
                <div className="relative z-20 w-[190px] h-[190px] sm:w-[230px] sm:h-[230px] pointer-events-none flex items-center justify-center">
                  {/* Top-Left Corner */}
                  <div className="absolute top-0 left-0 w-8 h-8 sm:w-9 sm:h-9 border-t-[3.5px] border-l-[3.5px] border-white rounded-tl-2xl shadow-sm" />
                  {/* Top-Right Corner */}
                  <div className="absolute top-0 right-0 w-8 h-8 sm:w-9 sm:h-9 border-t-[3.5px] border-r-[3.5px] border-white rounded-tr-2xl shadow-sm" />
                  {/* Bottom-Left Corner */}
                  <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-9 sm:h-9 border-b-[3.5px] border-l-[3.5px] border-white rounded-bl-2xl shadow-sm" />
                  {/* Bottom-Right Corner */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-9 sm:h-9 border-b-[3.5px] border-r-[3.5px] border-white rounded-br-2xl shadow-sm" />

                  {/* ── Animated Orange Scanning Laser Beam Line ── */}
                  {!cameraError && (
                    <div className="absolute left-2.5 right-2.5 h-[2.5px] bg-[#FE760B] rounded-full shadow-[0_0_14px_3px_rgba(254,118,11,0.85),0_0_28px_6px_rgba(254,118,11,0.5)] animate-qr-laser">
                      <div className="absolute -top-3 inset-x-0 h-6 bg-gradient-to-b from-transparent via-[#FE760B]/25 to-transparent pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* ── Fallback View when Camera Permission is Dismissed or Unavailable ── */}
                {cameraError && (
                  <div className="absolute inset-0 z-30 bg-[#131517]/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-3">
                      <Camera className="w-6 h-6 text-amber-500" />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      {cameraPermissionDismissed ? "Camera Access Dismissed" : "Camera Unavailable"}
                    </h4>
                    <p className="text-xs text-[#9B9EA4] max-w-xs mb-4 leading-relaxed">
                      {cameraError}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setUseManualEntry(true)}
                        className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Keyboard size={13} />
                        <span>Use Manual Entry</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraError(null);
                          setCameraPermissionDismissed(false);
                          setCameraRetryKey((k) => k + 1);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Status pill under camera */}
              <div className="mt-3 flex items-center gap-2 text-xs text-[#9B9EA4]">
                <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
                <span>Camera ready · hold QR code steady</span>
              </div>

              {/* Simulate Scan Button */}
              <button
                type="button"
                onClick={handleSimulateScan}
                className="w-full mt-4 py-2.5 px-4 rounded-xl bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] text-xs font-semibold text-[#D0D0D1] hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <Sparkles size={13} className="text-[#FE760B]" />
                <span>Simulate a scan</span>
              </button>
            </>
          ) : (
            /* ── Manual Entry Mode ── */
            <div className="w-full bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 shadow-2xl space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Manual Ticket Verification
                </h4>
                <p className="text-xs text-[#9B9EA4]">
                  Enter the unique attendee Ticket ID printed on their digital pass.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. TKT-1772264271452-PVV8HMERQ"
                  value={manualTicketId}
                  onChange={(e) => setManualTicketId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
                  className="flex-1 h-10 px-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white text-xs sm:text-sm font-mono placeholder:text-[#5C6066] focus:border-[#FE760B] focus:outline-none transition-colors"
                  autoFocus
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={handleManualEntry}
                  disabled={isProcessing}
                  className="h-10 px-5 rounded-xl bg-white hover:bg-slate-100 text-[#131517] font-semibold text-xs sm:text-sm transition-all disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                >
                  {isProcessing ? (
                    <Loader2 size={14} className="animate-spin text-black" />
                  ) : (
                    "Verify"
                  )}
                </button>
              </div>

              {eventRegistrations.length > 0 && (
                <div className="pt-2 border-t border-[#2A2D31]">
                  <p className="text-[11px] text-[#9B9EA4] mb-2 font-medium">
                    Registered guests for this event ({eventRegistrations.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                    {eventRegistrations.map((guest) => {
                      const isUsed = guest.status === "Used" || guest.checkedIn === true;
                      return (
                        <button
                          key={guest.id}
                          type="button"
                          onClick={() => setManualTicketId(guest.ticketId || guest.id)}
                          className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-colors flex items-center gap-1.5 ${
                            isUsed
                              ? "bg-[#3DD68C]/10 border-[#3DD68C]/30 text-[#3DD68C]"
                              : "bg-[#212327] border-[#2A2D31] text-[#D0D0D1] hover:border-[#FE760B] hover:text-[#FE760B]"
                          }`}
                        >
                          <span className="truncate max-w-[120px]">
                            {guest.fullName || guest.name || guest.ticketId}
                          </span>
                          <span className="opacity-60 text-[9px]">
                            {isUsed ? "✓" : "→"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right Column: Stats & Recent Scans matching Image 1 & 2 ── */}
        <div className="w-full space-y-5">
          {/* ── 1. Checked in Counter & Progress Bar ── */}
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
                <span className="text-xs sm:text-sm font-semibold text-white">
                  Checked in
                </span>
              </div>
              <div className="flex items-baseline gap-1 text-white">
                <span className="text-lg sm:text-xl font-bold tabular-nums">
                  {checkedInCount}
                </span>
                <span className="text-xs text-[#9B9EA4] font-medium">
                  / {totalGuests}
                </span>
              </div>
            </div>

            {/* Green Progress Bar matching Image 1 */}
            <div className="w-full h-1.5 sm:h-2 rounded-full bg-[#2A2D31] overflow-hidden">
              <div
                className="h-full bg-[#3DD68C] rounded-full transition-all duration-500 ease-out"
                style={{
                  width: totalGuests > 0 ? `${Math.min(100, Math.round((checkedInCount / totalGuests) * 100))}%` : "0%",
                }}
              />
            </div>
          </div>

          {/* ── 2. Recent Scans Section with Custom Floating Gate Station Dropdown ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-0.5 relative">
              <h3 className="text-xs sm:text-sm font-semibold text-[#D0D0D1]">
                Recent scans
              </h3>

              {/* Custom Floating Gate Station Dropdown (Zero native select bugs) */}
              <div className="relative" ref={stationDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsStationDropdownOpen(!isStationDropdownOpen)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] text-[11px] font-medium text-[#9B9EA4] hover:text-white transition-all shadow-sm cursor-pointer select-none"
                  aria-haspopup="listbox"
                  aria-expanded={isStationDropdownOpen}
                >
                  <MapPin size={12} className="text-[#FE760B] shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-[190px] text-[#D0D0D1]">
                    {currentStationLabel}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-[#9B9EA4] transition-transform duration-200 shrink-0 ${
                      isStationDropdownOpen ? "rotate-180 text-[#FE760B]" : ""
                    }`}
                  />
                </button>

                {isStationDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-2xl z-50 py-1.5 animate-in fade-in zoom-in-95 backdrop-blur-md">
                    <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4] border-b border-[#2A2D31]/60 mb-1">
                      Check-In Gate Station
                    </div>
                    <div className="max-h-56 overflow-y-auto no-scrollbar space-y-0.5 px-1">
                      {gateStations.map((station) => {
                        const isSelected = selectedStation === station.id;
                        return (
                          <button
                            key={station.id}
                            type="button"
                            onClick={() => {
                              setSelectedStation(station.id);
                              setIsStationDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 rounded-xl transition-colors ${
                              isSelected
                                ? "bg-[#FE760B]/12 text-[#FE760B] font-bold"
                                : "text-[#D0D0D1] hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span className="truncate">{station.label}</span>
                            {isSelected && <Check size={13} className="shrink-0 text-[#FE760B]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* List of Recent Scans for THIS EVENT ONLY */}
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl divide-y divide-[#2A2D31] overflow-hidden shadow-lg">
              {scanHistory.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#9B9EA4]">
                  <div className="w-10 h-10 rounded-full bg-[#2A2D31]/50 border border-[#2A2D31] flex items-center justify-center mx-auto mb-2.5 text-[#5C6066]">
                    <Ticket size={18} />
                  </div>
                  <p className="font-semibold text-white text-xs">No check-ins yet for this event</p>
                  <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                    Scan attendee QR codes or use manual entry to begin gate admissions
                  </p>
                </div>
              ) : (
                scanHistory.map((scan) => (
                  <div
                    key={scan.id}
                    onClick={() => {
                      if (scan.guest) setSelectedGuest(scan.guest);
                    }}
                    role={scan.guest ? "button" : undefined}
                    tabIndex={scan.guest ? 0 : undefined}
                    className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#212327]/60 active:bg-[#212327] transition-colors group ${
                      scan.guest ? "cursor-pointer" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${scan.avatarBg}`}
                      >
                        {scan.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#FE760B] transition-colors truncate">
                          {scan.attendee}
                        </p>
                        <p className="font-mono text-[11px] text-[#9B9EA4] truncate">
                          {scan.ticketId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold ${
                          scan.status === "valid" || scan.status === "admitted"
                            ? "bg-[#3DD68C]/12 text-[#3DD68C] border border-[#3DD68C]/20"
                            : "bg-[#FF6B6B]/12 text-[#FF9A9A] border border-[#FF6B6B]/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            scan.status === "valid" || scan.status === "admitted"
                              ? "bg-[#3DD68C]"
                              : "bg-[#FF6B6B]"
                          }`}
                        />
                        <span>
                          {scan.status === "valid" || scan.status === "admitted"
                            ? "Valid"
                            : "Invalid"}
                        </span>
                      </span>
                      <span className="text-xs text-[#9B9EA4] whitespace-nowrap">
                        {scan.time}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Guest Details Drawer / Modal (Light Mint Theme & Live QR Preview) ── */}
      {selectedGuest && (
        <GuestDetailsModal
          isOpen={Boolean(selectedGuest)}
          onClose={() => setSelectedGuest(null)}
          guest={selectedGuest}
          allGuests={eventRegistrations.length > 0 ? eventRegistrations : scanHistory.map((s) => s.guest).filter(Boolean)}
          currentIndex={Math.max(
            0,
            (eventRegistrations.length > 0 ? eventRegistrations : scanHistory.map((s) => s.guest).filter(Boolean)).findIndex(
              (g) => (g.id || g.ticketId) === (selectedGuest.id || selectedGuest.ticketId)
            )
          )}
          onNavigate={(newIdx) => {
            const list = eventRegistrations.length > 0 ? eventRegistrations : scanHistory.map((s) => s.guest).filter(Boolean);
            if (list[newIdx]) setSelectedGuest(list[newIdx]);
          }}
          event={currentEvent}
          currentUser={user}
          onGuestUpdated={(updatedGuest) => {
            setSelectedGuest(updatedGuest);
            setScanHistory((prev) =>
              prev.map((s) =>
                s.guest?.id === updatedGuest.id
                  ? {
                      ...s,
                      attendee: updatedGuest.fullName || updatedGuest.name || s.attendee,
                      guest: { ...s.guest, ...updatedGuest },
                    }
                  : s
              )
            );
          }}
        />
      )}
    </div>
  );
}
