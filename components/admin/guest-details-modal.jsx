"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronUp,
  ChevronDown,
  Pencil,
  Check,
  Ticket,
  Mail,
  QrCode,
  ExternalLink,
  MoreHorizontal,
  Loader2,
  Copy,
  Send,
  MessageCircle,
  ShieldAlert,
  Clock,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { toast } from "sonner";
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCustomFormByEvent } from "@/lib/form-generator";
import { approveRegistration, declineRegistration } from "@/lib/firestore";
import Link from "next/link";

/**
 * Format Firestore timestamp or Date into "Mar 9, 4:31 PM"
 */
function formatGuestDateTime(rawDate) {
  if (!rawDate) return "—";
  let d = null;
  if (rawDate?.toDate && typeof rawDate.toDate === "function") {
    d = rawDate.toDate();
  } else if (rawDate?.seconds) {
    d = new Date(rawDate.seconds * 1000);
  } else if (rawDate instanceof Date) {
    d = rawDate;
  } else if (typeof rawDate === "string" || typeof rawDate === "number") {
    d = new Date(rawDate);
  }
  if (!d || isNaN(d.getTime())) return "—";

  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${month} ${day}, ${time}`;
}

/**
 * Format timestamp into relative day format e.g. "Yesterday, 11:55 AM"
 */
function formatTimelineDate(rawDate) {
  if (!rawDate) return "Recently";
  let d = null;
  if (rawDate?.toDate && typeof rawDate.toDate === "function") {
    d = rawDate.toDate();
  } else if (rawDate?.seconds) {
    d = new Date(rawDate.seconds * 1000);
  } else if (rawDate instanceof Date) {
    d = rawDate;
  } else if (typeof rawDate === "string" || typeof rawDate === "number") {
    d = new Date(rawDate);
  }
  if (!d || isNaN(d.getTime())) return "Recently";

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0 && d.getDate() === now.getDate()) {
    return `Today, ${timeStr}`;
  }
  if (diffDays === 1 || (diffDays === 0 && d.getDate() !== now.getDate())) {
    return `Yesterday, ${timeStr}`;
  }
  return formatGuestDateTime(d);
}

/**
 * Extract First Name first char and Last Name first char (e.g. "Amit Sharma" -> "AS")
 */
function getInitials(name = "") {
  if (!name || typeof name !== "string") return "G";
  const clean = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "G";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] || "";
  const last = parts[parts.length - 1][0] || "";
  return (first + last).toUpperCase();
}

/**
 * Check if a question or value corresponds to a phone number
 */
function isPhoneField(key = "", val = "") {
  const k = String(key || "").toLowerCase();
  const v = String(val || "").replace(/[\s\-\(\)\+]/g, "");
  if (
    k.includes("phone") ||
    k.includes("mobile") ||
    k.includes("whatsapp") ||
    k.includes("contact")
  ) {
    return true;
  }
  if (/^[0-9]{7,15}$/.test(v) && !k.includes("ticket") && !k.includes("semester") && !k.includes("year") && !k.includes("code") && !k.includes("pin") && !k.includes("zip")) {
    return true;
  }
  return false;
}

/**
 * Check if a value is an external URL / link
 */
function isUrlField(val = "") {
  const v = String(val || "").trim();
  return v.startsWith("http://") || v.startsWith("https://");
}

/**
 * Check if a field is internal/batch ID/location and should NEVER be shown in questions
 */
function isExcludedField(key = "", label = "") {
  const k = String(key || "").toLowerCase().replace(/[\s_\-]/g, "");
  const l = String(label || "").toLowerCase().replace(/[\s_\-]/g, "");
  if (k.includes("batch") || l.includes("batch")) return true;
  if (k.includes("razorpay") || l.includes("razorpay")) return true;
  if (k.includes("sessionid") || l.includes("sessionid")) return true;
  if (k === "orderid" || l === "orderid") return true;
  if (k === "transactionid" || l === "transactionid") return true;
  if (k === "qrcodepreview" || k === "qrcode" || k === "qrpayload" || k === "qrcodeurl") return true;
  if (k === "location" || l === "location") return true;
  return false;
}

/**
 * Normalize key for case/space/underscore-insensitive comparison
 */
function normalizeKey(str = "") {
  return String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Format any field value safely into displayable string
 */
function formatDisplayValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.filter(Boolean).map(String).join(", ");
  if (typeof val === "object") {
    if (val.toDate && typeof val.toDate === "function") return formatGuestDateTime(val);
    if (val.seconds) return formatGuestDateTime(val);
    try {
      return JSON.stringify(val);
    } catch (_) {
      return String(val);
    }
  }
  return String(val).trim();
}

/**
 * Clean human label from arbitrary key
 */
function toHumanLabel(key = "") {
  if (!key) return "Field";
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function GuestDetailsModal({
  isOpen,
  onClose,
  guest,
  allGuests = [],
  currentIndex = 0,
  onNavigate,
  event,
  currentUser,
  onGuestUpdated,
}) {
  const [editedFormData, setEditedFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [customForm, setCustomForm] = useState(null);
  const [broadcastMessages, setBroadcastMessages] = useState([]);
  const [generatedQr, setGeneratedQr] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [editingGuestId, setEditingGuestId] = useState(null);

  // Approval state & actions matching Image 2 & 3
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [customApprovalMessage, setCustomApprovalMessage] = useState("");
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  const actionMenuRef = useRef(null);

  const isEventCancelled = Boolean(event?.isCancelled || event?.status === "cancelled");
  const isEditing = editingGuestId === guest?.id;

  const handleApprove = async () => {
    if (isEventCancelled) {
      toast.info("This event is cancelled. Registrations cannot be approved.");
      return;
    }
    if (!guest?.id) return;
    setIsProcessingApproval(true);
    try {
      await approveRegistration(guest.id, customApprovalMessage, {
        notifyGuest,
      });
      toast.success(`${guestName} approved successfully!`);
      const updated = {
        ...guest,
        status: "Going",
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvalMessage: customApprovalMessage || null,
      };
      onGuestUpdated?.(updated);
    } catch (err) {
      console.error("Approve guest error:", err);
      toast.error("Failed to approve guest");
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleDecline = async () => {
    if (isEventCancelled) {
      toast.info("This event is cancelled. Registrations cannot be declined.");
      return;
    }
    if (!guest?.id) return;
    setIsProcessingApproval(true);
    try {
      await declineRegistration(guest.id, customApprovalMessage, {
        notifyGuest,
      });
      toast.error(`${guestName} declined`);
      const updated = {
        ...guest,
        status: "declined",
        approvalStatus: "declined",
        declinedAt: new Date(),
        declineMessage: customApprovalMessage || null,
      };
      onGuestUpdated?.(updated);
    } catch (err) {
      console.error("Decline guest error:", err);
      toast.error("Failed to decline guest");
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Derive QR Data URL directly from guest.qrCode if present, otherwise use generated QR
  const qrDataUrl = useMemo(() => {
    if (guest?.qrCode && typeof guest.qrCode === "string" && guest.qrCode.startsWith("data:image/")) {
      return guest.qrCode;
    }
    return generatedQr;
  }, [guest?.qrCode, generatedQr]);

  // Generate live high-contrast QR code for instant inline preview if missing
  useEffect(() => {
    const code = guest?.qrPayload || guest?.ticketId || guest?.id;
    if (!code) return;

    if (guest?.qrCode && typeof guest.qrCode === "string" && guest.qrCode.startsWith("data:image/")) {
      return;
    }

    let isMounted = true;
    QRCodeLib.toDataURL(code, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "H",
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (isMounted) setGeneratedQr(url);
      })
      .catch((err) => {
        console.warn("QR generation notice:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [guest?.id, guest?.ticketId, guest?.qrPayload, guest?.qrCode]);

  // Load custom questions schema specifically for THIS event dynamically from Firestore
  useEffect(() => {
    const eventId = guest?.eventId || event?.id;
    if (!eventId || !isOpen) return;

    let isMounted = true;
    const fetchForm = async () => {
      try {
        // 1. Direct check if event object already provides customQuestions
        if (event?.customQuestions && Array.isArray(event.customQuestions) && event.customQuestions.length > 0) {
          if (isMounted) setCustomForm({ fields: event.customQuestions });
          return;
        }

        // 2. Fetch using getCustomFormByEvent from lib/form-generator (sorted by newest update)
        const formFromDb = await getCustomFormByEvent(eventId);
        if (formFromDb && Array.isArray(formFromDb.fields) && formFromDb.fields.length > 0) {
          if (isMounted) setCustomForm(formFromDb);
          return;
        }

        // 3. Fallback: Fetch parent event document to inspect customQuestions
        const evSnap = await getDoc(doc(db, "events", eventId));
        if (evSnap.exists() && isMounted) {
          const evData = evSnap.data();
          if (Array.isArray(evData.customQuestions) && evData.customQuestions.length > 0) {
            setCustomForm({ fields: evData.customQuestions });
            return;
          }
        }

        // 4. Fallback: If guest registered for a subEvent, check subEvent document
        if (guest?.subEventId && isMounted) {
          const subSnap = await getDoc(doc(db, "events", eventId, "subEvents", guest.subEventId));
          if (subSnap.exists()) {
            const subData = subSnap.data();
            if (Array.isArray(subData.customQuestions) && subData.customQuestions.length > 0) {
              setCustomForm({ fields: subData.customQuestions });
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Could not load custom form questions:", err);
      }
    };

    fetchForm();
    return () => {
      isMounted = false;
    };
  }, [guest?.eventId, guest?.subEventId, event?.id, event?.customQuestions, isOpen]);

  // Load broadcast messages for the event timeline dynamically from Firestore
  useEffect(() => {
    const eventId = guest?.eventId || event?.id;
    if (!eventId || !isOpen) return;

    let isMounted = true;
    const fetchMessages = async () => {
      try {
        const msgsRef = collection(db, "messages");
        const q = query(
          msgsRef,
          where("eventId", "==", eventId),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const snap = await getDocs(q);
        if (!snap.empty && isMounted) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setBroadcastMessages(list);
        }
      } catch (err) {
        try {
          const qFallback = query(collection(db, "messages"), where("eventId", "==", eventId), limit(5));
          const snapFb = await getDocs(qFallback);
          if (!snapFb.empty && isMounted) {
            setBroadcastMessages(snapFb.docs.map((d) => ({ id: d.id, ...d.data() })));
          }
        } catch (_) {}
      }
    };

    fetchMessages();
    return () => {
      isMounted = false;
    };
  }, [guest?.eventId, event?.id, isOpen]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setIsActionMenuOpen(false);
      }
    }
    if (isActionMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isActionMenuOpen]);

  // Keyboard navigation: Escape, ArrowUp (Prev), ArrowDown (Next)
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        if (currentIndex > 0 && typeof onNavigate === "function") {
          e.preventDefault();
          onNavigate(currentIndex - 1);
        }
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        if (currentIndex < allGuests.length - 1 && typeof onNavigate === "function") {
          e.preventDefault();
          onNavigate(currentIndex + 1);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, allGuests.length, onNavigate, onClose]);

  // Prevent background body scrolling when modal is open
  useEffect(() => {
    if (!isOpen || !guest) return;

    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen, guest]);

  // Guest fields & status calculations (Real dynamic data)
  const guestName = guest?.fullName || guest?.name || guest?.attendeeName || "Guest Attendee";
  const guestEmail = guest?.email || (guest?.whatsappPhone ? `+${String(guest.whatsappPhone).replace(/\D/g, "")}` : "No email provided");
  const isCheckedIn =
    guest?.status === "Used" ||
    guest?.status === "used" ||
    guest?.status === "checked-in" ||
    guest?.checkedIn === true;
  const isDeclined =
    guest?.status === "declined" ||
    guest?.status === "Cancelled" ||
    guest?.status === "cancelled" ||
    guest?.approvalStatus === "declined";
  const isPending =
    !isCheckedIn &&
    !isDeclined &&
    (guest?.status === "pending" ||
      guest?.approvalStatus === "pending" ||
      guest?.paymentStatus === "pending");

  const statusLabel = isCheckedIn
    ? "Checked In"
    : isDeclined
    ? "Declined"
    : isPending
    ? "Pending"
    : "Going";

  // Build resolved questions & answers list (Dynamic per-event questions, NO Batch ID)
  const questionEntries = useMemo(() => {
    if (!guest) return [];
    const formData = {
      ...(guest.formData || {}),
      ...(guest.customFieldResponses || {}),
      ...(guest.answers || {}),
      ...(guest.responses || {}),
    };
    if (guest.teamName && formData.teamName === undefined) formData.teamName = guest.teamName;
    if (guest.teamLeaderName && formData.teamLeaderName === undefined) formData.teamLeaderName = guest.teamLeaderName;
    if (guest.department && formData.department === undefined) formData.department = guest.department;
    if (guest.semester && formData.semester === undefined) formData.semester = guest.semester;
    if (guest.college && formData.college === undefined) formData.college = guest.college;
    const result = [];
    const processedKeys = new Set();

    // 1. If customForm schema exists for this event, evaluate in exact order defined by organizer
    if (customForm?.fields && Array.isArray(customForm.fields)) {
      customForm.fields.forEach((field) => {
        const key = String(field.id ?? "");
        const name = String(field.name || "");
        const label = field.label || field.name || toHumanLabel(key);
        if (isExcludedField(key, label) || isExcludedField(name, label)) return;

        // Candidate search keys
        const normKey = normalizeKey(key);
        const normName = normalizeKey(name);
        const normLabel = normalizeKey(label);

        // Try direct lookup in formData
        let rawVal =
          formData[key] !== undefined
            ? formData[key]
            : formData[name] !== undefined
            ? formData[name]
            : formData[label] !== undefined
            ? formData[label]
            : "";

        // Try normalized lookup in formData
        if (rawVal === "") {
          for (const [formK, formV] of Object.entries(formData)) {
            const nK = normalizeKey(formK);
            if (nK && (nK === normKey || nK === normName || nK === normLabel)) {
              rawVal = formV;
              break;
            }
          }
        }

        // Try direct lookup on guest root object
        if (rawVal === "" && guest[key] !== undefined) {
          rawVal = guest[key];
        }
        if (rawVal === "" && name && guest[name] !== undefined) {
          rawVal = guest[name];
        }

        // Contextual fallbacks for standard registration intake fields
        if (rawVal === "" || rawVal === null || rawVal === undefined) {
          const lk = label.toLowerCase();
          if (lk.includes("team leader") || lk.includes("leader name")) {
            rawVal = guest.teamLeaderName || guestName;
          } else if (lk.includes("team name") || lk === "team") {
            rawVal = guest.teamName || "";
          } else if (lk === "full name" || lk === "name" || lk === "attendee name") {
            rawVal = guestName;
          } else if (lk.includes("phone") || lk.includes("whatsapp") || lk.includes("contact") || lk.includes("mobile")) {
            rawVal = guest.whatsappPhone || guest.phone || "";
          } else if (lk.includes("email")) {
            rawVal = guest.email || "";
          } else if (lk.includes("college") || lk.includes("institution") || lk.includes("organization") || lk.includes("university")) {
            rawVal = guest.college || guest.organization || "";
          } else if (lk.includes("department") || lk === "dept") {
            rawVal = guest.department || "";
          } else if (lk.includes("semester") || lk === "sem") {
            rawVal = guest.semester || "";
          } else if (lk.includes("year of study") || lk === "year") {
            rawVal = guest.year || guest.semester || "";
          }
        }

        const value = formatDisplayValue(rawVal);
        if (value !== "") {
          result.push({
            id: key || name || label,
            label,
            value,
            type: field.type || "text",
            isPhone: isPhoneField(label, value),
            isUrl: isUrlField(value),
          });
          processedKeys.add(key);
          if (name) processedKeys.add(name);
          processedKeys.add(label);
          if (normKey) processedKeys.add(normKey);
          if (normName) processedKeys.add(normName);
          if (normLabel) processedKeys.add(normLabel);
        }
      });
    }

    // 2. Append any remaining custom answers submitted in formData for this guest
    Object.entries(formData).forEach(([k, v]) => {
      const normK = normalizeKey(k);
      if (processedKeys.has(k) || processedKeys.has(normK)) return;
      if (isExcludedField(k, k)) return;
      if (v === "" || v === null || v === undefined) return;
      // Skip internal metadata fields
      if (k === "createdAt" || k === "updatedAt" || k === "id" || k === "ticketId" || k === "qrCode" || k === "qrPayload" || k === "status") return;

      const formatted = formatDisplayValue(v);
      if (!formatted) return;

      // Determine human label
      let label = toHumanLabel(k);
      if (/^\d{10,16}$/.test(k) || k.startsWith("q_")) {
        // Numeric timestamp or random key: derive label from context
        if (formatted === guestName) label = "Name";
        else if (formatted === guest.email) label = "Email";
        else if (isPhoneField("", formatted)) label = "WhatsApp Phone";
        else if (isUrlField(formatted)) {
          if (formatted.includes("github")) label = "GitHub";
          else if (formatted.includes("linkedin")) label = "LinkedIn";
          else if (formatted.includes("drive.google")) label = "Submission Link";
          else label = "Portfolio / Link";
        } else {
          label = "Additional Detail";
        }
      }

      result.push({
        id: k,
        label,
        value: formatted,
        type: "text",
        isPhone: isPhoneField(label, formatted),
        isUrl: isUrlField(formatted),
      });
      processedKeys.add(k);
      processedKeys.add(normK);
    });

    // 3. Append any additional dynamic guest fields from top-level of registration document
    const reservedGuestKeys = new Set([
      "id",
      "batchId",
      "batch_id",
      "batchID",
      "batch",
      "ticketId",
      "qrCode",
      "qrPayload",
      "eventId",
      "userId",
      "createdAt",
      "updatedAt",
      "status",
      "usedAt",
      "checkedInAt",
      "checkedInBy",
      "checkedInStation",
      "paymentStatus",
      "checkedIn",
      "isReported",
      "reportReason",
      "reportedAt",
      "ticketTitle",
      "fullName",
      "email",
      "name",
      "attendeeName",
      "formData",
      "message",
      "usedBy",
      "orderId",
      "paymentId",
      "amount",
      "currency",
      "razorpayOrderId",
      "razorpayPaymentId",
      "razorpaySignature",
      "sessionId",
      "eventCity",
      "location",
      "city",
      "venue",
      "subEventId",
      "subEvents",
      "type",
    ]);

    Object.entries(guest).forEach(([k, v]) => {
      const normK = normalizeKey(k);
      const label = toHumanLabel(k);
      if (reservedGuestKeys.has(k) || isExcludedField(k, label) || processedKeys.has(k) || processedKeys.has(normK)) return;
      if (v === "" || v === null || v === undefined) return;
      if (typeof v === "object" && !(v instanceof Date) && !v?.toDate) return;

      const formatted = formatDisplayValue(v);
      if (!formatted) return;

      result.push({
        id: k,
        label,
        value: formatted,
        type: "text",
        isPhone: isPhoneField(label, formatted),
        isUrl: isUrlField(formatted),
      });
      processedKeys.add(k);
      processedKeys.add(normK);
    });

    // 4. Fallback: if no custom questions were collected, present standard intake
    if (result.length === 0) {
      result.push({ id: "name", label: "Name", value: guestName, isPhone: false, isUrl: false });
      if (guest.whatsappPhone || guest.phone) {
        result.push({
          id: "phone",
          label: "Whatsapp Phone",
          value: formatDisplayValue(guest.whatsappPhone || guest.phone),
          isPhone: true,
          isUrl: false,
        });
      }
      if (guest.email) {
        result.push({
          id: "email",
          label: "Email Address",
          value: guest.email,
          isPhone: false,
          isUrl: false,
        });
      }
      if (guest.college || guest.organization) {
        result.push({
          id: "college",
          label: "College / Organisation",
          value: formatDisplayValue(guest.college || guest.organization),
          isPhone: false,
          isUrl: false,
        });
      }
      if (guest.ticketTitle) {
        result.push({
          id: "ticketTitle",
          label: "Ticket Category",
          value: formatDisplayValue(guest.ticketTitle),
          isPhone: false,
          isUrl: false,
        });
      }
    }

    return result.filter((entry) => !isExcludedField(entry.id, entry.label));
  }, [guest, customForm, guestName]);

  // Handle saving edited questions directly to Firestore
  const handleSaveQuestions = async () => {
    setIsSaving(true);
    try {
      const regId = guest.id;
      if (!regId) throw new Error("Missing registration ID");

      const mergedFormData = {
        ...(guest.formData || {}),
        ...editedFormData,
      };

      const updates = {
        formData: mergedFormData,
        updatedAt: Timestamp.now(),
      };

      // If leader name or phone was edited, also update primary top-level fields
      Object.entries(editedFormData).forEach(([k, v]) => {
        const lk = k.toLowerCase();
        if (lk.includes("name") && (lk.includes("full") || lk.includes("leader") || lk === "name")) {
          updates.fullName = String(v).trim();
        }
        if (isPhoneField(k, v)) {
          updates.whatsappPhone = String(v).trim();
        }
      });

      await updateDoc(doc(db, "registrations", regId), updates);

      toast.success("Guest details updated successfully!");
      setEditingGuestId(null);
      onGuestUpdated?.({ ...guest, ...updates });
    } catch (err) {
      console.error("Save guest details error:", err);
      toast.error(err.message || "Failed to update guest details");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle resending ticket pass email
  const handleResendEmail = async () => {
    setIsActionMenuOpen(false);
    if (!guest.ticketId) {
      toast.error("No ticket pass found for this registration");
      return;
    }
    const toastId = toast.loading("Sending ticket pass email...");
    try {
      const res = await fetch("/api/send-ticket-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: guest.ticketId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      toast.success(`Ticket email sent to ${guest.email}!`, { id: toastId });
    } catch (err) {
      console.error("Resend ticket email error:", err);
      toast.error(err.message || "Failed to resend ticket pass", { id: toastId });
    }
  };

  if (!isOpen || !guest) return null;

  const modalContent = (
    <>
      {/* ── Main Modal Backdrop ── */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden touch-none overscroll-contain"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Modal Card Container styled according to Dark Theme ── */}
        <div
          className="relative w-full max-w-lg bg-[#1A1C1F] text-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-[#2A2D31] animate-in slide-in-from-bottom-4 duration-200 touch-pan-y overscroll-contain"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Top Header with Subtle Emerald Accent Tint ── */}
          <div className="bg-gradient-to-b from-[#064E3B]/25 via-[#1A1C1F] to-[#1A1C1F] px-5 pt-3 pb-4 shrink-0 border-b border-[#2A2D31]">
            {/* Mobile Drag Pill */}
            <div className="w-10 h-1.5 rounded-full bg-gray-600 mx-auto mb-2.5" />

            {/* Header Navigation Bar */}
            <div className="flex items-center justify-between">
              {/* Prev / Next Chevrons */}
              <div className="flex items-center gap-1 w-16">
                <button
                  type="button"
                  onClick={() => onNavigate?.(currentIndex - 1)}
                  disabled={currentIndex <= 0}
                  aria-label="Previous guest"
                  className="p-1.5 rounded-lg text-[#9B9EA4] hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                >
                  <ChevronUp size={18} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.(currentIndex + 1)}
                  disabled={currentIndex >= allGuests.length - 1}
                  aria-label="Next guest"
                  className="p-1.5 rounded-lg text-[#9B9EA4] hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                >
                  <ChevronDown size={18} strokeWidth={2.5} />
                </button>
              </div>

              {/* Title */}
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight text-center flex-1">
                Guest Details
              </h2>

              {/* Close Button */}
              <div className="flex items-center justify-end w-16">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="p-1.5 rounded-full text-[#9B9EA4] hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ── Guest Profile Summary Row ── */}
            <div className="flex items-center justify-between gap-3 mt-4">
              {/* Left: Avatar with initials: First name first char + Last name first char */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30 flex items-center justify-center shrink-0 font-bold text-sm tracking-wider select-none shadow-sm">
                  <span>{getInitials(guestName)}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white truncate leading-tight">
                    {guestName}
                  </h3>
                  <p className="text-xs text-[#9B9EA4] truncate mt-0.5 font-normal">
                    {guestEmail}
                  </p>
                </div>
              </div>

              {/* Right: Clean Static Status Badge Pill (No dropdown) */}
              <div className="shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    isCheckedIn
                      ? "bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30"
                      : isDeclined
                      ? "bg-red-500/15 text-red-400 border-red-500/30"
                      : isPending
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30"
                  }`}
                >
                  <span>{statusLabel}</span>
                  {isPending && <ExternalLink size={10} className="opacity-70" />}
                </span>
              </div>
            </div>

            {/* ── Times Row ── */}
            <div className="grid grid-cols-2 gap-4 mt-5 pt-3 border-t border-[#2A2D31]">
              {/* Checked In Time */}
              <div>
                <p className="text-[11px] font-medium text-[#9B9EA4] uppercase tracking-wider mb-0.5">
                  Checked In Time
                </p>
                <p className="text-sm font-semibold text-white">
                  {isCheckedIn ? formatGuestDateTime(guest.usedAt || guest.checkedInAt) : "—"}
                </p>
              </div>

              {/* Registration Time */}
              <div>
                <p className="text-[11px] font-medium text-[#9B9EA4] uppercase tracking-wider mb-0.5">
                  Registration Time
                </p>
                <p className="text-sm font-semibold text-white">
                  {formatGuestDateTime(guest.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* ── Scrollable Body Area ── */}
          <div className="overflow-y-auto px-5 py-5 space-y-6 flex-1 text-left overscroll-contain bg-[#1A1C1F]">
            {/* ── Pending Approval Card & Actions (Matching Image 2 & 3) ── */}
            {isPending && (
              isEventCancelled ? (
                <div className="bg-[#2B1414] border border-rose-500/30 rounded-xl p-3.5 flex items-center gap-2.5 text-rose-300">
                  <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                  <p className="text-xs font-semibold">
                    This event has been cancelled. Guest registrations are locked in view-only mode.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Amber status card */}
                  <div className="bg-[#2C2614] border border-[#FDE003]/30 rounded-xl p-3.5 flex items-center gap-2.5 text-[#FDE003]">
                    <Clock size={16} className="shrink-0 text-[#FDE003]" />
                    <p className="text-xs font-semibold">
                      This guest is currently pending approval.
                    </p>
                  </div>

                  {/* Form action box */}
                  <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-4 space-y-3.5 shadow-sm">
                    {/* Notify guest checkbox */}
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notifyGuest}
                        onChange={(e) => setNotifyGuest(e.target.checked)}
                        className="w-4 h-4 rounded bg-[#212327] border-[#2A2D31] text-[#22C55E] focus:ring-0 cursor-pointer accent-[#22C55E]"
                      />
                      <span>Notify Guest</span>
                    </label>

                    {/* Optional custom message */}
                    <div className="space-y-1">
                      <textarea
                        rows={2}
                        placeholder="Add an optional, custom message..."
                        value={customApprovalMessage}
                        onChange={(e) => setCustomApprovalMessage(e.target.value)}
                        className="w-full text-xs font-medium text-white bg-[#212327] border border-[#2A2D31] rounded-xl p-3 outline-none focus:border-[#FE760B] transition-colors placeholder-[#9B9EA4] resize-none"
                      />
                      <p className="text-[10px] text-[#9B9EA4] leading-tight">
                        Any message you specified in the registration emails will always be included.
                      </p>
                    </div>

                    {/* Big Approve & Decline Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        disabled={isProcessingApproval}
                        onClick={handleApprove}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {isProcessingApproval ? (
                          <Loader2 size={14} className="animate-spin text-white" />
                        ) : (
                          <Check size={14} strokeWidth={3} />
                        )}
                        <span>Approve</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessingApproval}
                        onClick={handleDecline}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {isProcessingApproval ? (
                          <Loader2 size={14} className="animate-spin text-white" />
                        ) : (
                          <X size={14} strokeWidth={3} />
                        )}
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* If previously declined */}
            {isDeclined && (
              <div className="bg-[#2B1414] border border-red-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 text-red-300">
                <div className="flex items-center gap-2">
                  <X size={16} className="text-red-400 shrink-0" />
                  <p className="text-xs font-semibold">
                    Registration was declined by the organiser.
                  </p>
                </div>
                {!isEventCancelled && (
                  <button
                    type="button"
                    disabled={isProcessingApproval}
                    onClick={handleApprove}
                    className="px-3.5 py-1.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Approve Now
                  </button>
                )}
              </div>
            )}

            {/* ── Section 1: Registration Questions (Dynamic per-event details) ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-bold text-white tracking-tight">
                  Registration Questions
                </h4>
                {!isEventCancelled && (
                  !isEditing ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditedFormData(guest.formData || {});
                        setEditingGuestId(guest.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-[#D0D0D1] bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] transition-colors"
                    >
                      <Pencil size={12} />
                      <span>Edit</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditedFormData(guest.formData || {});
                          setEditingGuestId(null);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#9B9EA4] hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSaveQuestions}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {isSaving && <Loader2 size={12} className="animate-spin" />}
                        <span>Save</span>
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* Questions List (Dynamic per-event details, NO Batch ID) */}
              <div className="space-y-3.5">
                {questionEntries.map((entry) => (
                  <div key={entry.id} className="space-y-0.5">
                    <label className="text-[11px] font-medium text-[#9B9EA4] block leading-tight">
                      {entry.label}
                    </label>

                    {isEditing ? (
                      <input
                        type="text"
                        value={editedFormData[entry.id] ?? entry.value}
                        onChange={(e) =>
                          setEditedFormData((prev) => ({
                            ...prev,
                            [entry.id]: e.target.value,
                          }))
                        }
                        className="w-full text-xs font-medium text-white bg-[#212327] border border-[#2A2D31] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]"
                      />
                    ) : entry.isPhone ? (
                      /* Phone number in pink highlight: "+91 87148 11144" */
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${entry.value.replace(/\s+/g, "")}`}
                          className="text-sm font-bold text-[#F43F5E] hover:underline"
                        >
                          {entry.value}
                        </a>
                        <a
                          href={`https://wa.me/${entry.value.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in WhatsApp"
                          className="text-[#34D399] hover:text-[#10B981] transition-colors p-0.5"
                        >
                          <MessageCircle size={15} />
                        </a>
                      </div>
                    ) : entry.isUrl ? (
                      <a
                        href={entry.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-[#38BDF8] hover:underline inline-flex items-center gap-1 break-all"
                      >
                        <span>{entry.value}</span>
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <p className="text-sm font-semibold text-white leading-snug break-words">
                        {entry.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 2: Live Ticket Pass & QR Code Preview ── */}
            <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-4 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 text-[#34D399] flex items-center justify-center">
                    <QrCode size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight">Ticket Pass & QR Preview</h4>
                    <p className="text-[10px] text-[#9B9EA4]">Live scannable digital admission</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isCheckedIn
                      ? "bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30"
                      : "bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30"
                  }`}
                >
                  {isCheckedIn ? "Checked In" : "Valid Pass"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#1A1C1F] p-3 rounded-xl border border-[#2A2D31]">
                {/* QR Image Thumbnail */}
                <div className="w-24 h-24 bg-white p-1 rounded-xl shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                  {qrDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrDataUrl}
                      alt="Ticket QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg">
                      <Loader2 className="w-5 h-5 animate-spin text-[#10B981] mb-1" />
                      <span className="text-[9px] text-gray-500">Loading QR...</span>
                    </div>
                  )}
                </div>

                {/* Ticket Details & Actions */}
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5 w-full">
                  <div>
                    <span className="text-[10px] font-semibold text-[#9B9EA4] uppercase tracking-wider block">
                      Ticket ID
                    </span>
                    <div className="inline-flex items-center gap-1.5 bg-[#212327] px-2 py-0.5 rounded-md border border-[#2A2D31] mt-0.5">
                      <span className="font-mono text-xs font-bold text-white truncate">
                        {guest.ticketId || guest.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(guest.ticketId || guest.id);
                          toast.success("Ticket ID copied!");
                        }}
                        title="Copy Ticket ID"
                        className="text-[#9B9EA4] hover:text-white transition-colors p-0.5"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#9B9EA4] truncate">
                    Category: <strong className="text-white">{guest.ticketTitle || "General Admission"}</strong>
                  </p>

                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                    <Link
                      href={`/tickets/${guest.ticketId || guest.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-[#131517] hover:bg-slate-100 text-[11px] font-semibold transition-all shadow-md active:scale-95"
                    >
                      <span>Open Live Pass</span>
                      <ExternalLink size={11} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 3: Timeline ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-bold text-white tracking-tight">
                  Timeline
                </h4>

                {/* Action Menu (3 dots) */}
                <div className="relative" ref={actionMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsActionMenuOpen((v) => !v)}
                    aria-label="More actions"
                    className="p-1 rounded-lg text-[#9B9EA4] hover:text-white hover:bg-[#212327] transition-colors"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {isActionMenuOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-[#212327] rounded-xl shadow-xl border border-[#2A2D31] py-1 z-30 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={handleResendEmail}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#D0D0D1] hover:bg-[#2A2D31] flex items-center gap-2"
                      >
                        <Send size={14} className="text-[#38BDF8]" />
                        <span>Resend Ticket Pass</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          navigator.clipboard.writeText(guest.ticketId || guest.id);
                          toast.success("Ticket ID copied to clipboard!");
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#D0D0D1] hover:bg-[#2A2D31] flex items-center gap-2"
                      >
                        <Copy size={14} className="text-[#9B9EA4]" />
                        <span>Copy Ticket ID</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Connected Vertical Timeline */}
              <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#2A2D31]">
                {/* 1. Broadcast updates (if any were sent for this event) */}
                {broadcastMessages.map((msg, idx) => (
                  <div key={msg.id || idx} className="relative">
                    <div className="absolute -left-6 top-0.5 w-5 h-5 rounded bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4]">
                      <Mail size={11} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        Sent: {msg.subject || "Event Info Updated"}
                      </p>
                      <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                        {formatTimelineDate(msg.createdAt)} · Delivered
                      </p>
                    </div>
                  </div>
                ))}

                {/* 2. Check In Node (if checked in) */}
                {isCheckedIn && (
                  <div className="relative">
                    <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-[#10B981]/20 border border-[#10B981] text-[#34D399] flex items-center justify-center shadow-sm">
                      <Check size={11} strokeWidth={3} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        Checked In
                      </p>
                      <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                        {formatGuestDateTime(guest.usedAt || guest.checkedInAt)} ·{" "}
                        {guest.checkedInBy || guest.usedBy || "Adil M"}
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Confirmation Email Sent Node */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4]">
                    <Mail size={11} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Sent: Registration Confirmed
                    </p>
                    <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                      {formatGuestDateTime(guest.createdAt)} · Delivered
                    </p>
                  </div>
                </div>

                {/* 4. Registered Initial Node */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-[#10B981]/20 border border-[#10B981] text-[#34D399] flex items-center justify-center shadow-sm">
                    <Ticket size={11} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      Registered
                    </p>
                    <p className="text-[11px] text-[#D0D0D1] mt-0.5 font-medium">
                      {guest.ticketTitle || "1 Ticket"}
                    </p>
                    <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                      {formatGuestDateTime(guest.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Bottom Footer Links matching Theme (Zero Wrong Location) ── */}
          <div className="px-5 py-3.5 bg-[#131517] border-t border-[#2A2D31] flex items-center justify-between text-xs text-[#9B9EA4] shrink-0">
            {/* Report guest link */}
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="hover:text-red-400 transition-colors font-medium text-[#9B9EA4]"
            >
              Report Guest
            </button>

            <span className="text-[#2A2D31]">·</span>

            {/* Direct Ticket Pass link */}
            <Link
              href={`/tickets/${guest.ticketId || guest.id}`}
              target="_blank"
              className="hover:text-white inline-flex items-center gap-1 transition-colors font-medium text-[#D0D0D1]"
            >
              <span>Ticket Pass</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Sub-Modal: Report Guest ── */}
      {showReportModal && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowReportModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#1A1C1F] rounded-2xl p-6 text-left shadow-2xl border border-[#2A2D31]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-400 mb-3">
              <ShieldAlert size={18} />
              <h3 className="text-sm font-bold text-white">
                Report or Flag Guest
              </h3>
            </div>
            <p className="text-xs text-[#9B9EA4] mb-4">
              Flag <strong className="text-white">{guestName}</strong> for manual review or cancel their admission ticket.
            </p>

            <textarea
              placeholder="Reason for flag (e.g. duplicate submission, invalid contact, payment dispute)..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full text-xs bg-[#212327] border border-[#2A2D31] rounded-xl p-3 outline-none focus:border-red-500 h-24 mb-4 text-white placeholder:text-[#5C6066]"
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#9B9EA4] hover:bg-[#212327] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, "registrations", guest.id), {
                      isReported: true,
                      reportReason: reportReason || "Flagged by organizer/superadmin",
                      reportedAt: Timestamp.now(),
                    });
                    toast.success("Guest flagged for review");
                    setShowReportModal(false);
                    setReportReason("");
                  } catch (err) {
                    toast.error("Failed to flag guest");
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
