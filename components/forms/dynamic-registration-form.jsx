"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signup, login, getCurrentUser } from "@/lib/auth";
import {
  getEvent,
} from "@/lib/firestore";
import { sendRegistrationConfirmation } from "@/lib/email";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { getCustomFormByEvent } from "@/lib/form-generator";
import { BrandLoader } from "@/components/ui/brand-loader";
import {
  Loader2,
  Sparkles,
  CheckCircle,
  X,
  LogIn,
  Key,
  RefreshCw,
  Mail,
  Info,
  User,
  Phone,
  Lock,
  Building2,
  Tag,
  Ticket,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Calendar,
  UploadCloud,
  FileText,
  Upload,
} from "lucide-react";

/**
 * Default fallback questions used ONLY when an event has no custom form configured in Form Builder.
 */
const DEFAULT_FALLBACK_FIELDS = [
  {
    id: "fullName",
    label: "Full Name",
    name: "Full Name",
    type: "text",
    required: true,
    placeholder: "Enter full name",
  },
  {
    id: "email",
    label: "Email Address",
    name: "Email Address",
    type: "email",
    required: true,
    placeholder: "Enter email address",
  },
  {
    id: "whatsappPhone",
    label: "Phone / WhatsApp",
    name: "Phone / WhatsApp",
    type: "tel",
    required: true,
    placeholder: "Enter phone number",
  },
  {
    id: "college",
    label: "College / University Name",
    name: "College / University Name",
    type: "text",
    required: false,
    placeholder: "Enter college or university name",
  },
  {
    id: "yearOfStudy",
    label: "Year of Study",
    name: "Year of Study",
    type: "dropdown",
    required: false,
    placeholder: "Select year of study",
    options: [
      "1st Year",
      "2nd Year",
      "3rd Year",
      "4th Year",
      "Postgraduate",
    ],
  },
];

/**
 * Sanitizes organizer custom form fields to ensure consistent property access:
 * id, label, name, type, required, placeholder, options.
 * Replaces any mock or institution-specific placeholders with privacy-safe genuine prompts.
 */
function sanitizeCustomFields(fields = []) {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && typeof f === "object")
    .map((f, index) => {
      const id = f.id !== undefined && f.id !== null ? String(f.id) : `field_${index}`;
      const name = f.name ? String(f.name) : (f.label ? String(f.label) : `Field ${index + 1}`);
      const label = f.label ? String(f.label) : (f.name ? String(f.name) : `Field ${index + 1}`);
      
      let cleanPlaceholder = f.placeholder;
      const lowerPh = String(cleanPlaceholder || "").toLowerCase();
      if (!cleanPlaceholder || lowerPh.includes("e.g.") || lowerPh.includes("example.com") || lowerPh.includes("+91") || lowerPh.includes("cusat") || lowerPh.includes("codeninjas")) {
        const lowerName = String(label || name || "").toLowerCase();
        if (f.type === "tel" || lowerName.includes("phone") || lowerName.includes("mobile") || lowerName.includes("whatsapp")) {
          cleanPlaceholder = "Enter phone number";
        } else if (f.type === "email" || lowerName.includes("email")) {
          cleanPlaceholder = "Enter email address";
        } else if (lowerName.includes("college") || lowerName.includes("university") || lowerName.includes("institute")) {
          cleanPlaceholder = "Enter college or university name";
        } else if (lowerName.includes("team")) {
          cleanPlaceholder = "Enter team name";
        } else if (lowerName.includes("name") && !lowerName.includes("team")) {
          cleanPlaceholder = "Enter full name";
        } else if (f.type === "dropdown" || f.type === "select") {
          cleanPlaceholder = `Select ${label.toLowerCase()}`;
        } else {
          cleanPlaceholder = `Enter ${label.toLowerCase()}`;
        }
      }

      const options = (
        Array.isArray(f.options)
          ? f.options
          : typeof f.options === "string"
          ? f.options.split(",").map((s) => s.trim())
          : []
      )
        .map(String)
        .filter((opt) => opt.trim().length > 0);

      return {
        ...f,
        id,
        name,
        label,
        type: f.type || "text",
        required: Boolean(f.required),
        placeholder: cleanPlaceholder,
        options,
      };
    });
}

export function parseEventPrice(val) {
  if (typeof val === "number") return isNaN(val) ? 0 : Math.max(0, val);
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.max(0, num);
}

export function DynamicRegistrationForm({ eventId, event: initialEvent, initialForm, ...props }) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const effectiveUser = authUser || auth.currentUser;

  // Real-time Event and Live Registrations listener
  const [currentEvent, setCurrentEvent] = useState(initialEvent || props.event || null);
  const [liveRegistrationsCount, setLiveRegistrationsCount] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [customForm, setCustomForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [tempFormData, setTempFormData] = useState(null);
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(true);
  const [emailDeliveryStatus, setEmailDeliveryStatus] = useState("queued");
  const [formLoadError, setFormLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const hasLoadedFormRef = useRef(false);
  const prevFormFieldsSignatureRef = useRef("");

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponData, setCouponData] = useState(null);
  const [couponError, setCouponError] = useState("");

  // Creator Campus Ambassador Referral State
  const [referralCode, setReferralCode] = useState(() => props.defaultReferralCode || "");
  const [referralEligible, setReferralEligible] = useState(Boolean(props.defaultReferralCode));

  useEffect(() => {
    if (props.defaultReferralCode) {
      setReferralCode(props.defaultReferralCode);
      setReferralEligible(true);
    }
  }, [props.defaultReferralCode]);

  useEffect(() => {
    const targetId = eventId || initialEvent?.id || props.event?.id || currentEvent?.id;
    if (!targetId) return;

    fetch(`/api/referral/validate?checkEvent=${encodeURIComponent(targetId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.referralActive) {
          setReferralEligible(true);
        }
      })
      .catch(() => {});
  }, [eventId, initialEvent?.id, props.event?.id, currentEvent?.id]);

  const activeEvent = currentEvent || initialEvent || props.event;
  const eventNumericPrice = parseEventPrice(
    activeEvent?.ticketPrice ??
    activeEvent?.price ??
    activeEvent?.amount ??
    customForm?.amount ??
    0
  );
  const isPaidEvent = Boolean(
    activeEvent?.isPaid === true ||
    customForm?.isPaid === true ||
    eventNumericPrice > 0
  );
  const basePayableAmount = isPaidEvent
    ? (eventNumericPrice > 0 ? eventNumericPrice : (parseEventPrice(customForm?.amount) || 199))
    : 0;
  const finalPayableAmount = couponData?.finalAmount !== undefined
    ? parseEventPrice(couponData.finalAmount)
    : basePayableAmount;

  // Helper to build initial form values with user pre-population
  const buildInitialData = (fields) => {
    const initialData = {};
    if (!Array.isArray(fields)) return initialData;
    fields.forEach((field) => {
      if (field.id !== undefined && field.id !== null) {
        initialData[field.id] = "";
      }
      if (field.name) {
        initialData[field.name] = "";
      }
    });
    const signedIn = authUser || auth.currentUser;
    if (signedIn) {
      const emailF = fields.find((f) => {
        const t = String(f?.type || "").toLowerCase();
        const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
        return t === "email" || n === "email" || n.includes("email");
      });
      const nameF = fields.find((f) => {
        const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
        return (
          n === "fullname" ||
          n === "name" ||
          (n.includes("name") &&
            !n.includes("college") &&
            !n.includes("school") &&
            !n.includes("team") &&
            !n.includes("company"))
        );
      });
      const phoneF = fields.find((f) => {
        const t = String(f?.type || "").toLowerCase();
        const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
        return (
          t === "tel" ||
          n.includes("phone") ||
          n.includes("mobile") ||
          n.includes("whatsapp") ||
          n.includes("contact")
        );
      });
      if (emailF && signedIn.email) {
        initialData[emailF.id] = signedIn.email;
        if (emailF.name) initialData[emailF.name] = signedIn.email;
      }
      if (nameF && (signedIn.displayName || signedIn.fullName)) {
        const nVal = signedIn.displayName || signedIn.fullName;
        initialData[nameF.id] = nVal;
        if (nameF.name) initialData[nameF.name] = nVal;
      }
      if (phoneF && (signedIn.phoneNumber || signedIn.whatsappPhone)) {
        const pVal = signedIn.phoneNumber || signedIn.whatsappPhone;
        initialData[phoneF.id] = pVal;
        if (phoneF.name) initialData[phoneF.name] = pVal;
      }
    }
    return initialData;
  };

  useEffect(() => {
    if (initialEvent || props.event) {
      setCurrentEvent(initialEvent || props.event);
    }
  }, [initialEvent, props.event]);

  useEffect(() => {
    const targetId = eventId || initialEvent?.id || props.event?.id || currentEvent?.id;
    if (!targetId || !db) return;

    let unsubEvent = null;
    let unsubRegs = null;
    let unsubFormEvent = null;
    let unsubFormTarget = null;

    let latestEventDocs = [];
    let latestTargetDocs = [];

    const applyFormUpdate = (formDoc) => {
      if (!formDoc || !Array.isArray(formDoc.fields)) return;
      const sanitizedFields = sanitizeCustomFields(formDoc.fields);
      const activeEv = currentEvent || initialEvent || props.event;
      const evNumericPrice = parseEventPrice(activeEv?.ticketPrice ?? activeEv?.price ?? activeEv?.amount ?? 0);
      const formIsPaid = Boolean(formDoc.isPaid ?? activeEv?.isPaid ?? (evNumericPrice > 0));
      const formAmount = parseEventPrice(formDoc.amount ?? evNumericPrice ?? 0);

      setCustomForm((prev) => ({
        ...(prev || {}),
        id: formDoc.id,
        ...formDoc,
        fields: sanitizedFields,
        isPaid: formIsPaid,
        amount: formAmount > 0 ? formAmount : (prev?.amount || evNumericPrice || 0),
      }));

      // Merge formData so user inputs in existing fields are preserved
      setFormData((prev) => {
        const initial = buildInitialData(sanitizedFields);
        const next = { ...initial };
        if (prev && typeof prev === "object") {
          for (const [key, val] of Object.entries(prev)) {
            if (val !== undefined && val !== null && val !== "") {
              next[key] = val;
            }
          }
        }
        return next;
      });

      // Clear errors for any removed fields or fields whose requirements changed
      setErrors((prev) => {
        if (!prev || Object.keys(prev).length === 0) return prev;
        const validIds = new Set(
          sanitizedFields.flatMap((f) => [String(f.id), f.name ? String(f.name) : null]).filter(Boolean)
        );
        const nextErrors = {};
        for (const [key, val] of Object.entries(prev)) {
          if (validIds.has(String(key))) {
            nextErrors[key] = val;
          }
        }
        return nextErrors;
      });

      // Show toast if form updated while user is actively viewing
      const newSignature = JSON.stringify(
        sanitizedFields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          req: f.required,
          opts: f.options,
        }))
      );

      if (hasLoadedFormRef.current) {
        if (prevFormFieldsSignatureRef.current && prevFormFieldsSignatureRef.current !== newSignature) {
          toast.info("Registration form has been updated by the host.", {
            id: "form-realtime-update-toast",
            duration: 3500,
          });
        }
      } else {
        hasLoadedFormRef.current = true;
      }
      prevFormFieldsSignatureRef.current = newSignature;
    };

    const applyEventQuestionsUpdate = (evData) => {
      if (!evData || !Array.isArray(evData.customQuestions) || evData.customQuestions.length === 0) return;
      const compiled = [];
      compiled.push({
        id: "fullName",
        name: "fullName",
        label: "Full Name",
        type: "text",
        required: true,
        placeholder: "Enter full name",
      });
      compiled.push({
        id: "email",
        name: "email",
        label: "Email Address",
        type: "email",
        required: true,
        placeholder: "Enter email address",
      });
      if (evData.personalInfoConfig?.phoneMode !== "Hidden") {
        compiled.push({
          id: "whatsappPhone",
          name: "whatsappPhone",
          label: "Phone / WhatsApp",
          type: "tel",
          required: evData.personalInfoConfig?.phoneMode === "Required",
          placeholder: "Enter phone number",
        });
      }
      evData.customQuestions.forEach((q, idx) => {
        compiled.push({
          id: q.id || `q_${idx}`,
          name: q.name || q.label || `q_${idx}`,
          label: q.label || `Question ${idx + 1}`,
          type: q.type === "select" ? "dropdown" : q.type || "text",
          required: Boolean(q.required),
          placeholder: q.placeholder || "",
          options: Array.isArray(q.options) ? q.options : [],
        });
      });
      const sanitizedFields = sanitizeCustomFields(compiled);
      const evNumericPrice = parseEventPrice(evData.ticketPrice ?? evData.price ?? evData.amount ?? 0);
      const isPaid = Boolean(evData.isPaid ?? (evNumericPrice > 0));
      const amount = evNumericPrice;
      applyFormUpdate({
        id: `ev_form_${evData.id}`,
        eventId: evData.id,
        fields: sanitizedFields,
        isPaid,
        amount,
        status: "published",
      });
    };

    const syncLatestForm = () => {
      const docMap = new Map();
      latestEventDocs.forEach((d) => docMap.set(d.id, d));
      latestTargetDocs.forEach((d) => docMap.set(d.id, d));

      const allDocs = Array.from(docMap.values());
      if (allDocs.length > 0) {
        allDocs.sort((a, b) => {
          const getMillis = (item) =>
            item?.updatedAt?.toMillis?.() ||
            (item?.updatedAt?.seconds ? item.updatedAt.seconds * 1000 : 0) ||
            item?.createdAt?.toMillis?.() ||
            (item?.createdAt?.seconds ? item.createdAt.seconds * 1000 : 0) ||
            0;
          return getMillis(b) - getMillis(a);
        });

        // Pick latest published doc or latest doc
        const latestDoc = allDocs.find((d) => d.status === "published") || allDocs[0];
        if (Array.isArray(latestDoc.fields) && latestDoc.fields.length > 0) {
          applyFormUpdate(latestDoc);
          return;
        }
      }

      // Fallback: check if event document itself has customQuestions
      if (currentEvent && Array.isArray(currentEvent.customQuestions) && currentEvent.customQuestions.length > 0) {
        applyEventQuestionsUpdate(currentEvent);
      }
    };

    // 1. Listen to events collection
    try {
      unsubEvent = onSnapshot(
        doc(db, "events", targetId),
        (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() };
            setCurrentEvent((prev) => ({ ...(prev || {}), ...data }));

            // If no customForms docs exist, or if customQuestions on event updated
            if (
              Array.isArray(data.customQuestions) &&
              data.customQuestions.length > 0 &&
              latestEventDocs.length === 0 &&
              latestTargetDocs.length === 0
            ) {
              applyEventQuestionsUpdate(data);
            }
          }
        },
        (err) => console.warn("Real-time event subscription warning:", err?.message)
      );
    } catch (err) {
      console.warn("Could not bind real-time event listener:", err);
    }

    // 2. Listen to live registrations count only if caller is organizer/superAdmin
    const emailLower = (authUser?.email || "").toLowerCase().trim();
    const canListenRegistrations = Boolean(
      authUser &&
      (authUser.role === "superAdmin" ||
        authUser.role === "superadmin" ||
        emailLower === "adil4ticketlelo@gmail.com" ||
        emailLower === "superadmin@ticketlelo.com" ||
        authUser.uid === initialEvent?.organizerId ||
        authUser.uid === initialEvent?.createdBy ||
        authUser.id === initialEvent?.organizerId ||
        authUser.id === initialEvent?.createdBy)
    );

    if (canListenRegistrations) {
      try {
        const q = query(collection(db, "registrations"), where("eventId", "==", targetId));
        unsubRegs = onSnapshot(
          q,
          (snap) => {
            setLiveRegistrationsCount(snap.size);
          },
          (err) => console.warn("Real-time registrations subscription warning:", err?.message)
        );
      } catch (err) {
        console.warn("Could not bind real-time registrations listener:", err);
      }
    }

    // 3. Real-time listener for customForms collection by eventId
    try {
      const qFormEvent = query(collection(db, "customForms"), where("eventId", "==", targetId));
      unsubFormEvent = onSnapshot(
        qFormEvent,
        (snap) => {
          latestEventDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          syncLatestForm();
        },
        (err) => console.warn("Real-time form (eventId) subscription warning:", err?.message)
      );
    } catch (err) {
      console.warn("Could not bind real-time form listener (eventId):", err);
    }

    // 4. Real-time listener for customForms collection by targetId
    try {
      const qFormTarget = query(collection(db, "customForms"), where("targetId", "==", targetId));
      unsubFormTarget = onSnapshot(
        qFormTarget,
        (snap) => {
          latestTargetDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          syncLatestForm();
        },
        (err) => console.warn("Real-time form (targetId) subscription warning:", err?.message)
      );
    } catch (err) {
      console.warn("Could not bind real-time form listener (targetId):", err);
    }

    return () => {
      if (typeof unsubEvent === "function") unsubEvent();
      if (typeof unsubRegs === "function") unsubRegs();
      if (typeof unsubFormEvent === "function") unsubFormEvent();
      if (typeof unsubFormTarget === "function") unsubFormTarget();
    };
  }, [eventId, initialEvent?.id, props.event?.id]);

  const themeColor =
    props.themeColor ||
    (activeEvent?.theme === "minimal" || activeEvent?.themeName?.toLowerCase() === "minimal"
      ? "#FE760B"
      : activeEvent?.themeColor || activeEvent?.themeHex || "#FE760B");

  // Registration Closure & Capacity Controls (Computed authoritatively in real time)
  const isEventCancelled = Boolean(
    activeEvent?.status === "cancelled" || activeEvent?.isCancelled
  );

  const isEventEnded = Boolean(
    activeEvent?.status === "ended" ||
    activeEvent?.status === "completed" ||
    activeEvent?.isEnded === true
  );

  // Authoritative explicit closure evaluation:
  // If closeRegistrationEnabled is explicitly false, closure rule is disabled and registration is open.
  let isRegistrationClosedExplicit = false;
  if (activeEvent?.closeRegistrationEnabled === true) {
    if (activeEvent?.closeRegistrationMode === "now" || activeEvent?.registrationClosed === true) {
      isRegistrationClosedExplicit = true;
    }
  } else if (activeEvent?.closeRegistrationEnabled === false) {
    isRegistrationClosedExplicit = false;
  } else {
    // Fallback for older event records before closeRegistrationEnabled field was introduced
    isRegistrationClosedExplicit = Boolean(
      (activeEvent?.registrationClosed === true && activeEvent?.registrationStatus !== "Open") ||
      (activeEvent?.isRegistrationClosed === true && activeEvent?.registrationStatus !== "Open") ||
      activeEvent?.registrationStatus === "Closed" ||
      activeEvent?.registrationStatus === "closed" ||
      activeEvent?.status === "closed"
    );
  }

  const allocatedSeats = Math.max(
    Number(activeEvent?.allocatedSeats || 0),
    liveRegistrationsCount
  );

  const isCapacityClosed = Boolean(
    activeEvent?.closeRegistrationEnabled === true &&
    activeEvent?.closeRegistrationMode === "capacity" &&
    typeof activeEvent?.closeRegistrationCapacity === "number" &&
    Number(activeEvent.closeRegistrationCapacity) > 0 &&
    allocatedSeats >= Number(activeEvent.closeRegistrationCapacity)
  );

  const totalSeats = Number(
    activeEvent?.globalCapacity ||
    activeEvent?.capacity ||
    activeEvent?.maxCapacity ||
    0
  );

  const isGlobalCapacityReached = Boolean(
    Boolean(activeEvent?.limitCapacity) &&
    totalSeats > 0 &&
    allocatedSeats >= totalSeats
  );

  const isClosedForRegistration =
    isEventCancelled ||
    isEventEnded ||
    isRegistrationClosedExplicit ||
    isCapacityClosed ||
    isGlobalCapacityReached;

  // Auto-fill and lock logged-in attendee details when auth initializes or changes
  useEffect(() => {
    const userToSync = authUser || auth.currentUser;
    if (userToSync && customForm?.fields) {
      setFormData((prev) => {
        const next = { ...prev };
        let updated = false;
        const emailF = customForm.fields.find((f) => {
          const t = String(f?.type || "").toLowerCase();
          const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
          return t === "email" || n === "email" || n.includes("email");
        });
        const nameF = customForm.fields.find((f) => {
          const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
          return (
            n === "fullname" ||
            n === "name" ||
            (n.includes("name") &&
              !n.includes("college") &&
              !n.includes("school") &&
              !n.includes("team") &&
              !n.includes("company"))
          );
        });
        const phoneF = customForm.fields.find((f) => {
          const t = String(f?.type || "").toLowerCase();
          const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
          return (
            t === "tel" ||
            n.includes("phone") ||
            n.includes("mobile") ||
            n.includes("whatsapp") ||
            n.includes("contact")
          );
        });
        if (emailF && userToSync.email && next[emailF.id] !== userToSync.email) {
          next[emailF.id] = userToSync.email;
          if (emailF.name) next[emailF.name] = userToSync.email;
          updated = true;
        }
        if (nameF && !next[nameF.id] && (userToSync.displayName || userToSync.fullName)) {
          const nVal = userToSync.displayName || userToSync.fullName;
          next[nameF.id] = nVal;
          if (nameF.name) next[nameF.name] = nVal;
          updated = true;
        }
        if (phoneF && !next[phoneF.id] && (userToSync.phoneNumber || userToSync.whatsappPhone)) {
          const pVal = userToSync.phoneNumber || userToSync.whatsappPhone;
          next[phoneF.id] = pVal;
          if (phoneF.name) next[phoneF.name] = pVal;
          updated = true;
        }
        return updated ? next : prev;
      });
    }
  }, [authUser, customForm]);

  // Fetch custom form structure with timeout and retry (only if not prefetched)
  useEffect(() => {
    // If we already have initialForm (not undefined), use it and skip the fetch
    if (initialForm !== undefined) {
      const timer = setTimeout(() => {
        if (initialForm && Array.isArray(initialForm.fields) && initialForm.fields.length > 0) {
          // Custom form exists with organizer fields - sanitize without synthetic injections
          console.log(" Using prefetched custom form");
          const sanitizedFields = sanitizeCustomFields(initialForm.fields);
          const normalizedForm = {
            ...initialForm,
            fields: sanitizedFields,
          };
          setCustomForm(normalizedForm);
          setFormData(buildInitialData(sanitizedFields));
        } else {
          // No custom form fields exist - use default fallback form
          console.log("No custom form fields found (prefetched), using default form");
          const evPrice = parseEventPrice(activeEvent?.ticketPrice ?? activeEvent?.price ?? activeEvent?.amount ?? 0);
          const defaultForm = {
            ...(initialForm || {}),
            eventId: eventId,
            fields: DEFAULT_FALLBACK_FIELDS,
            theme: {
              logo: null,
              color: props.themeColor || activeEvent?.themeColor || activeEvent?.themeHex || "#FE760B",
            },
            isPaid: Boolean(activeEvent?.isPaid || evPrice > 0),
            amount: evPrice > 0 ? evPrice : 199,
            enableCoupons: true,
            status: "published",
            isDefault: true,
          };

          setCustomForm(defaultForm);
          setFormData(buildInitialData(DEFAULT_FALLBACK_FIELDS));
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    async function loadForm() {
      try {
        setFormLoadError(null);
        const evPrice = parseEventPrice(activeEvent?.ticketPrice ?? activeEvent?.price ?? activeEvent?.amount ?? 0);

        // 1. First attempt fast direct load from Firestore client
        try {
          const directForm = await getCustomFormByEvent(eventId);
          if (directForm && Array.isArray(directForm.fields) && directForm.fields.length > 0) {
            console.log("Custom form loaded directly from Firestore");
            const sanitizedFields = sanitizeCustomFields(directForm.fields);
            const formToUse = {
              ...directForm,
              fields: sanitizedFields,
              isPaid: Boolean(directForm.isPaid ?? activeEvent?.isPaid ?? (evPrice > 0)),
              amount: parseEventPrice(directForm.amount) || evPrice || 199,
            };
            setCustomForm(formToUse);
            setFormData(buildInitialData(sanitizedFields));
            setRetryCount(0);
            return;
          }
        } catch (directErr) {
          console.warn("Direct form fetch fallback to API:", directErr);
        }

        // 2. Fallback to API route
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(
          `/api/get-custom-form?eventId=${eventId}`,
          {
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load form");
        }

        if (data.success && data.form && Array.isArray(data.form.fields) && data.form.fields.length > 0) {
          console.log("Custom form loaded successfully from API");
          const sanitizedFields = sanitizeCustomFields(data.form.fields);
          const formToUse = {
            ...data.form,
            fields: sanitizedFields,
            isPaid: Boolean(data.form.isPaid ?? activeEvent?.isPaid ?? (evPrice > 0)),
            amount: parseEventPrice(data.form.amount) || evPrice || 199,
          };
          setCustomForm(formToUse);
          setFormData(buildInitialData(sanitizedFields));
          setRetryCount(0);
        } else {
          // No custom form exists - fallback to default form
          console.log("No custom form configured, applying default fallback form");
          const defaultForm = {
            eventId: eventId,
            fields: DEFAULT_FALLBACK_FIELDS,
            theme: {
              logo: null,
              color: props.themeColor || activeEvent?.themeColor || activeEvent?.themeHex || "#FE760B",
            },
            isPaid: Boolean(activeEvent?.isPaid || evPrice > 0),
            amount: evPrice > 0 ? evPrice : 199,
            enableCoupons: true,
            status: "published",
            isDefault: true,
          };

          setCustomForm(defaultForm);
          setFormData(buildInitialData(DEFAULT_FALLBACK_FIELDS));
          setRetryCount(0);
        }
      } catch (error) {
        console.error("Error loading custom form:", error);

        if (error.name === "AbortError") {
          setFormLoadError("Form loading timed out. Click retry to try again.");
          toast.error("Loading timed out. Please retry.");
        } else {
          setFormLoadError(error.message || "Failed to load registration form");
          toast.error(
            "Failed to load form: " + (error.message || "Unknown error"),
          );
        }
      }
    }

    if (eventId) {
      loadForm();
    }
  }, [eventId, retryCount, initialForm, activeEvent]);

  // Load Razorpay script
  useEffect(() => {
    if (isPaidEvent) {
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [isPaidEvent]);

  const validateForm = () => {
    const newErrors = {};

    customForm?.fields?.forEach((field) => {
      const rawVal =
        formData[field.id] !== undefined && formData[field.id] !== ""
          ? formData[field.id]
          : (field.name && formData[field.name] !== undefined ? formData[field.name] : "");
      const trimmedVal = typeof rawVal === "string" ? rawVal.trim() : rawVal;

      if (
        field.required &&
        (trimmedVal === "" ||
          trimmedVal === null ||
          trimmedVal === undefined ||
          (Array.isArray(trimmedVal) && trimmedVal.length === 0))
      ) {
        newErrors[field.id] =
          `${field.label || field.name || "This field"} is required`;
        return;
      }

      // Email validation - only if field type is email and value is present
      if (field.type === "email" && trimmedVal) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedVal)) {
          newErrors[field.id] = "Invalid email address";
        }
      }

      // Phone validation - 10-digit validation only if field is phone and value is present
      const isPhoneField =
        field.type === "tel" ||
        String(field.id).toLowerCase().includes("phone") ||
        String(field.id).toLowerCase().includes("whatsapp") ||
        String(field.label || field.name).toLowerCase().includes("phone") ||
        String(field.label || field.name).toLowerCase().includes("whatsapp") ||
        String(field.label || field.name).toLowerCase().includes("contact");

      if (isPhoneField && trimmedVal) {
        const digitsOnly = String(trimmedVal).replace(/\D/g, "");
        const isTenDigitValid =
          digitsOnly.length === 10 ||
          (digitsOnly.length === 12 && digitsOnly.startsWith("91")) ||
          (digitsOnly.length === 11 && digitsOnly.startsWith("0"));

        if (!isTenDigitValid) {
          newErrors[field.id] = "Please enter a valid 10-digit phone number";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Coupon handlers
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    if (!basePayableAmount || basePayableAmount <= 0) {
      toast.error("This event is free. No coupon needed!");
      return;
    }

    setCouponValidating(true);
    setCouponError("");

    try {
      const response = await fetch("/api/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: couponCode.trim(),
          eventId,
          amount: basePayableAmount,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setCouponData(data);
        setCouponError("");
        toast.success(
          data.message || `${data.discountPercent}% discount applied!`,
        );
      } else {
        setCouponData(null);
        setCouponError(data.message || "Invalid coupon code");
        toast.error(data.message || "Invalid coupon code");
      }
    } catch (error) {
      console.error("Error validating coupon:", error);
      setCouponData(null);
      setCouponError("Failed to validate coupon");
      toast.error("Failed to validate coupon");
    } finally {
      setCouponValidating(false);
    }
  };

  const removeCoupon = () => {
    setCouponCode("");
    setCouponData(null);
    setCouponError("");
    toast.info("Coupon removed");
  };

  // Handle EXISTING user login
  const handleExistingUserLogin = async () => {
    if (!loginPassword || loginPassword.length < 6) {
      toast.error("Please enter your password (at least 6 characters)");
      return;
    }

    setIsLoggingIn(true);

    try {
      // Login with email and password
      const user = await login(tempFormData.email, loginPassword);
      setShowLoginModal(false);

      const isPaidEvent = tempFormData.isPaid;

      if (isPaidEvent) {
        // Paid event - initiate payment with logged-in user
        await handlePaymentFlowForExistingUser(user);
      } else {
        // Free event - register directly
        await registerExistingUser(user);
      }
    } catch (error) {
      console.error("Login error:", error);
      if (
        error.message?.includes("wrong-password") ||
        error.message?.includes("invalid-credential")
      ) {
        toast.error("Incorrect password. Please try again.");
      } else {
        toast.error("Login failed: " + error.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle payment for existing logged-in users
  const handlePaymentFlowForExistingUser = async (user) => {
    try {
      setPaymentProcessing(true);

      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          registrationData: { fullName: user.fullName, email: user.email, whatsappPhone: user.whatsappPhone, formData: tempFormData?.formData || {} },
          couponCode: couponCode || null,
          referralCode: referralCode?.trim() || null,
          referralCode: referralCode?.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment order");
      }

      const orderData = await response.json();

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order");
      }

      const gatewayOrder = orderData.order || {
        id: orderData.razorpayOrderId || orderData.orderId,
        razorpayKeyId: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
      };
      const options = {
        key: gatewayOrder.razorpayKeyId || orderData.keyId,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        name: "Ticketलेलो",
        description: `Ticket for ${event?.name || "Event"}`,
        order_id: gatewayOrder.id,
        prefill: {
          name: (typeof tempFormData !== "undefined" && tempFormData?.fullName) || (typeof fullName !== "undefined" && fullName) || user?.fullName || user?.email || "Attendee",
          email: (typeof tempFormData !== "undefined" && tempFormData?.email) || (typeof email !== "undefined" && email) || user?.email || "",
          contact: (typeof tempFormData !== "undefined" && (tempFormData?.whatsappPhone || tempFormData?.phone)) || (typeof whatsappPhone !== "undefined" && whatsappPhone) || (typeof phone !== "undefined" && phone) || user?.phone || user?.phoneNumber || "9876543210",
        },
        handler: async function (response) {
          try {
            const verifyResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                eventId,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              const emailSent = verifyData.ticketId
                ? await sendRegistrationConfirmation(user.email, tempFormData.fullName || user.fullName || user.email, event?.name || "Event", verifyData.ticketId)
                : false;
              toast.success(emailSent ? "Payment complete. Ticket sent to your email." : "Payment complete. Ticket is available in your dashboard.");

              setShowSuccessModal(true);
              setPaymentProcessing(false);
              setIsLoading(false);
            } else {
              toast.error("Payment verification failed");
              setPaymentProcessing(false);
              setIsLoading(false);
              setTimeout(() => router.push("/"), 2000);
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            toast.error("Payment verification failed");
            setPaymentProcessing(false);
            setIsLoading(false);
            setTimeout(() => router.push("/"), 2000);
          }
        },
        modal: {
          ondismiss: function () {
            toast.error("Payment cancelled");
            setPaymentProcessing(false);
            setIsLoading(false);
            setTimeout(() => router.push("/"), 2000);
          },
        },
        theme: {
          color: customForm?.theme?.color || props.themeColor || activeEvent?.themeColor || activeEvent?.themeHex || "#FE760B",
        },
      };

      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => {
          const rzp = new window.Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      } else {
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      console.error("Payment initialization error:", error);
      toast.error("Failed to initialize payment");
      setPaymentProcessing(false);
      setIsLoading(false);
      setTimeout(() => router.push("/"), 2000);
    }
  };

  // Server-owned free admission issuance is idempotent and capacity checked.
  const registerExistingUser = async (user, payloadData = null) => {
    try {
      const dataToSend = payloadData || tempFormData?.formData || {};
      const token =
        (await auth.currentUser?.getIdToken?.().catch(() => null)) ||
        (await user?.getIdToken?.().catch(() => null));
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/register-free", {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventId,
          formData: dataToSend,
          referralCode: referralCode?.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration failed");
      setIsFirstTimeUser(Boolean(result.isFirstTimeUser));
      if (result.emailStatus) setEmailDeliveryStatus(result.emailStatus);
      const requiresApproval = Boolean(event?.requireApproval || result.requiresApproval);
      setIsPendingApproval(requiresApproval);
      if (requiresApproval) {
        toast.info("Registration submitted! Organiser approval is required.");
      } else {
        const attendeeName = dataToSend.fullName || tempFormData?.fullName || user.fullName || user.email;
        sendRegistrationConfirmation(
          user.email,
          attendeeName,
          event?.name || "Event",
          result.ticketId
        ).catch((err) => console.warn("[Email] Background confirmation delivery:", err));
        toast.success(
          result.alreadyRegistered
            ? "You are already registered for this event"
            : "Registration successful"
        );
      }
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Free registration failed:", error.message);
      toast.error(error.message || "Registration failed");
    } finally {
      setIsLoading(false);
      setPaymentProcessing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isClosedForRegistration) {
      toast.error("Registration is closed for this event.");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fill all required fields correctly");
      return;
    }

    setIsLoading(true);

    try {
      // Find form field values - check both type, id, and label for robust matching
      const emailField = customForm?.fields?.find((f) => {
        const type = String(f?.type || "").toLowerCase();
        const name = String(f?.name || f?.label || "").toLowerCase();
        const id = String(f?.id || "").toLowerCase();
        return type === "email" || name.includes("email") || id.includes("email");
      });
      const phoneField = customForm?.fields?.find((f) => {
        const type = String(f?.type || "").toLowerCase();
        const name = String(f?.name || f?.label || "").toLowerCase();
        const id = String(f?.id || "").toLowerCase();
        return (
          type === "tel" ||
          name.includes("phone") ||
          name.includes("mobile") ||
          name.includes("contact") ||
          name.includes("whatsapp") ||
          id.includes("phone") ||
          id.includes("mobile") ||
          id.includes("whatsapp")
        );
      });
      const nameField = customForm?.fields?.find((f) => {
        const name = String(f?.name || f?.label || "").toLowerCase();
        const id = String(f?.id || "").toLowerCase();
        return (
          id === "fullname" ||
          id === "name" ||
          id === "attendee_name" ||
          (name.includes("name") &&
            !name.includes("college") &&
            !name.includes("school") &&
            !name.includes("team") &&
            !name.includes("company"))
        );
      });

      let email =
        effectiveUser?.email ||
        (emailField ? (formData[emailField.id] || formData[emailField.name]) : "") ||
        formData.email ||
        auth.currentUser?.email ||
        "";
      email = typeof email === "string" ? email.trim().toLowerCase() : "";

      let phone =
        (phoneField ? (formData[phoneField.id] || formData[phoneField.name]) : "") ||
        formData.whatsappPhone ||
        formData.phone ||
        auth.currentUser?.phoneNumber ||
        "";
      phone = typeof phone === "string" ? phone.trim() : "";

      let fullName =
        (nameField ? (formData[nameField.id] || formData[nameField.name]) : "") ||
        formData.fullName ||
        formData.name ||
        auth.currentUser?.displayName ||
        "Attendee";
      fullName = typeof fullName === "string" ? fullName.trim() : "Attendee";

      // Email is required for ticket delivery & account identity
      if (!email || email === "") {
        toast.info("Please sign in to register for this event");
        setShowLoginModal(true);
        setIsLoading(false);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error("Please provide a valid email address.");
        setIsLoading(false);
        return;
      }

      // Phone validation - enforce valid 10-digit number ONLY if phoneField is in the form schema
      if (phoneField) {
        if (phoneField.required && (!phone || phone === "")) {
          toast.error("Phone number is required. Please provide your phone number.");
          setIsLoading(false);
          return;
        }
        if (phone) {
          const phoneDigits = String(phone).replace(/\D/g, "");
          const isTenDigitValid =
            phoneDigits.length === 10 ||
            (phoneDigits.length === 12 && phoneDigits.startsWith("91")) ||
            (phoneDigits.length === 11 && phoneDigits.startsWith("0"));

          if (!isTenDigitValid) {
            toast.error("Please provide a valid 10-digit phone number.");
            setIsLoading(false);
            return;
          }
        }
      }

      const signedInUser = auth.currentUser;
      if (
        signedInUser &&
        signedInUser.email &&
        email &&
        signedInUser.email.toLowerCase() !== email.toLowerCase()
      ) {
        toast.error("Sign in with the email address entered on this form");
        setIsLoading(false);
        return;
      }

      // Build unified, canonical form payload containing all organizer fields
      const payloadFormData = {
        ...formData,
        fullName: fullName || "Attendee",
        name: fullName || "Attendee",
        email: email,
        whatsappPhone: phone || "",
        phone: phone || "",
      };
      customForm?.fields?.forEach((f) => {
        const val =
          formData[f.id] !== undefined && formData[f.id] !== ""
            ? formData[f.id]
            : (f.name && formData[f.name] !== undefined ? formData[f.name] : "");
        if (f.id !== undefined && f.id !== null) {
          payloadFormData[f.id] = val;
        }
        if (f.name) {
          payloadFormData[f.name] = val;
        }
        if (f.label) {
          payloadFormData[f.label] = val;
        }
      });
      if (nameField?.id) {
        payloadFormData[nameField.id] = fullName;
      }
      if (emailField?.id) {
        payloadFormData[emailField.id] = email;
      }
      if (phoneField?.id) {
        payloadFormData[phoneField.id] = phone;
      }

      const existingUser = signedInUser
        ? (await getCurrentUser(signedInUser.uid)) || {
            id: signedInUser.uid,
            email: signedInUser.email,
            fullName: signedInUser.displayName || fullName,
          }
        : null;

      // Store form data for state persistence
      const submissionContext = {
        email,
        phone,
        fullName,
        eventId,
        event,
        customForm,
        formData: payloadFormData,
        isPaid: isPaidEvent,
        amount: finalPayableAmount,
      };
      setTempFormData(submissionContext);

      if (isPaidEvent) {
        await handlePaymentFlow(
          email,
          phone,
          fullName,
          existingUser,
          payloadFormData
        );
      } else if (existingUser) {
        await registerExistingUser(existingUser, payloadFormData);
      } else {
        await registerGuestUser(
          email,
          phone,
          fullName,
          payloadFormData
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(error.message || "Registration failed. Please try again.");
      setIsLoading(false);
    }
  };

  // Register unauthenticated visitor as guest
  const registerGuestUser = async (
    email,
    phone,
    fullName,
    payloadData = null
  ) => {
    try {
      setIsLoading(true);
      const dataToSend = payloadData || tempFormData?.formData || {};
      const fullFormData = {
        ...dataToSend,
        email,
        fullName: fullName || dataToSend.fullName || email,
        whatsappPhone: phone || dataToSend.whatsappPhone || dataToSend.phone || "",
      };

      const response = await fetch("/api/register-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          formData: fullFormData,
          referralCode: referralCode?.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration failed");

      const isFirst = Boolean(result.isFirstTimeUser);
      setIsFirstTimeUser(isFirst);

      const requiresApproval = Boolean(event?.requireApproval || result.requiresApproval);
      setIsPendingApproval(requiresApproval);

      if (requiresApproval) {
        toast.info("Registration submitted! Organiser approval is required.");
      } else {
        await sendRegistrationConfirmation(
          email,
          fullName || email,
          event?.name || "Event",
          result.ticketId
        );
        toast.success(
          result.alreadyRegistered
            ? "You are already registered for this event"
            : "Registration successful"
        );
      }
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Guest registration failed:", error?.message || error);
      toast.error(error?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
      setPaymentProcessing(false);
    }
  };

  // Handle payment flow for both new and existing users
  const handlePaymentFlow = async (
    email,
    phone,
    fullName,
    existingUser = null,
    payloadData = null
  ) => {
    try {
      setPaymentProcessing(true);
      const dataToSend = payloadData || tempFormData?.formData || {};

      const token =
        (await auth.currentUser?.getIdToken?.(true).catch(() => null)) ||
        (await existingUser?.getIdToken?.(true).catch(() => null));
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/create-order", {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventId,
          registrationData: {
            fullName,
            email,
            whatsappPhone: phone,
            formData: dataToSend,
          },
          couponCode: couponCode || null,
          referralCode: referralCode?.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment order");
      }

      const orderData = await response.json();

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order");
      }

      // Load Razorpay checkout
      const gatewayOrder = orderData.order || {
        id: orderData.razorpayOrderId || orderData.orderId,
        razorpayKeyId: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
      };
      const options = {
        key: gatewayOrder.razorpayKeyId || orderData.keyId,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        name: "Ticketलेलो",
        description: `Ticket for ${event?.name || "Event"}`,
        order_id: gatewayOrder.id,
        prefill: {
          name: (typeof tempFormData !== "undefined" && tempFormData?.fullName) || (typeof fullName !== "undefined" && fullName) || user?.fullName || user?.email || "Attendee",
          email: (typeof tempFormData !== "undefined" && tempFormData?.email) || (typeof email !== "undefined" && email) || user?.email || "",
          contact: (typeof tempFormData !== "undefined" && (tempFormData?.whatsappPhone || tempFormData?.phone)) || (typeof whatsappPhone !== "undefined" && whatsappPhone) || (typeof phone !== "undefined" && phone) || user?.phone || user?.phoneNumber || "9876543210",
        },
        handler: async function (response) {
          try {
            console.log(" Payment successful");

            // Verify payment
            const verifyHeaders = { "Content-Type": "application/json" };
            if (token) verifyHeaders["Authorization"] = `Bearer ${token}`;

            const verifyResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: verifyHeaders,
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                eventId,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              setIsFirstTimeUser(Boolean(verifyData.isFirstTimeUser));
              const emailSent = verifyData.ticketId
                ? await sendRegistrationConfirmation(
                    email,
                    fullName || email,
                    event?.name || "Event",
                    verifyData.ticketId
                  )
                : false;
              toast.success(
                emailSent
                  ? "Payment complete. Ticket sent to your email."
                  : "Payment complete. Ticket is available in your dashboard."
              );

              setShowSuccessModal(true);
              setPaymentProcessing(false);
              setIsLoading(false);
            } else {
              toast.error("Payment verification failed");
              setPaymentProcessing(false);
              setIsLoading(false);
              setTimeout(() => router.push("/"), 2000);
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            toast.error("Payment verification failed");
            setPaymentProcessing(false);
            setIsLoading(false);
            setTimeout(() => router.push("/"), 2000);
          }
        },
        modal: {
          ondismiss: function () {
            toast.error("Payment cancelled");
            setPaymentProcessing(false);
            setIsLoading(false);
            setTimeout(() => router.push("/"), 2000);
          },
        },
        theme: {
          color: customForm?.theme?.color || props.themeColor || activeEvent?.themeColor || activeEvent?.themeHex || "#FE760B",
        },
      };

      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => {
          const rzp = new window.Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      } else {
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      console.error("Payment initialization error:", error);
      toast.error("Failed to initialize payment");
      setPaymentProcessing(false);
      setIsLoading(false);
      setTimeout(() => router.push("/"), 2000);
    }
  };

  const createAccountAndRegister = async (
    email,
    phone,
    fullName,
    password,
    payloadData = null
  ) => {
    try {
      const user = await signup(
        email,
        password,
        fullName || email,
        phone || "",
        { hasSetPassword: true, isFirstTimeUser: false }
      );
      const dataToSend = payloadData || tempFormData?.formData || {};
      const token =
        (await auth.currentUser?.getIdToken?.().catch(() => null)) ||
        (await user?.getIdToken?.().catch(() => null));
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/register-free", {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventId: eventId,
          formData: dataToSend,
          referralCode: referralCode?.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration failed");
      const requiresApproval = Boolean(event?.requireApproval || result.requiresApproval);
      setIsPendingApproval(requiresApproval);
      if (requiresApproval) {
        toast.info("Registration submitted! Organiser approval is required.");
      } else {
        sendRegistrationConfirmation(
          email,
          user.fullName || fullName || email,
          event?.name || "Event",
          result.ticketId
        ).catch((err) => console.warn("[Email] Background confirmation delivery:", err));
        toast.success("Registration complete! Your ticket has been generated.");
      }
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Free account registration failed:", error.message);
      if (error.code === "auth/email-already-in-use" || /already exists/i.test(error.message || "")) {
        setShowLoginModal(true);
        toast.info("An account already exists. Sign in to continue.");
      } else {
        toast.error(error.message || "Registration failed");
      }
    } finally {
      setIsLoading(false);
      setPaymentProcessing(false);
    }
  };


  const getFieldIcon = (field) => {
    const id = String(field?.id ?? "").toLowerCase();
    const type = String(field?.type ?? "").toLowerCase();
    const label = String(field?.label || field?.name || "").toLowerCase();

    if (type === "email" || id.includes("email") || label.includes("email")) {
      return <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    if (type === "tel" || id.includes("phone") || id.includes("mobile") || id.includes("whatsapp") || label.includes("phone")) {
      return <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    if (id.includes("password") || label.includes("password")) {
      return <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    if (id.includes("name") || label.includes("name") || id.includes("user")) {
      return <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    if (id.includes("college") || id.includes("university") || id.includes("school") || id.includes("company") || id.includes("org") || label.includes("college") || label.includes("school")) {
      return <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    return <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
  };

  const renderField = (field) => {
    if (!field || !field.id) return null;
    const value =
      formData[field.id] !== undefined && formData[field.id] !== ""
        ? formData[field.id]
        : (field.name && formData[field.name] !== undefined ? formData[field.name] : "");
    const error = errors[field.id] || (field.name ? errors[field.name] : null);

    const updateValue = (newValue) => {
      setFormData((prev) => {
        const next = { ...prev, [field.id]: newValue };
        if (field.name) next[field.name] = newValue;
        return next;
      });
      if (errors[field.id] || (field.name && errors[field.name])) {
        setErrors((prev) => {
          const next = { ...prev, [field.id]: null };
          if (field.name) next[field.name] = null;
          return next;
        });
      }
    };

    switch (field.type) {
      case "text":
      case "email":
      case "tel": {
        const isTel = field.type === "tel";
        const isEmail =
          field.type === "email" ||
          String(field.name || field.label || field.id).toLowerCase() === "email" ||
          String(field.name || field.label || field.id).toLowerCase().includes("email");
        const isUserLoggedIn = Boolean(effectiveUser?.email);
        const isEmailLocked = isEmail && isUserLoggedIn;
        const fieldValue = isEmailLocked
          ? effectiveUser.email
          : (formData[field.id] !== undefined && formData[field.id] !== ""
            ? formData[field.id]
            : (field.name && formData[field.name] !== undefined ? formData[field.name] : ""));

        const handleInputChange = (e) => {
          if (isEmailLocked) return;
          let val = e.target.value;
          if (isTel) {
            // Allow only numbers, +, -, and spaces
            val = val.replace(/[^\d+\s-]/g, "");
            // If doesn't start with '+', cap raw digits at 10
            if (!val.startsWith("+")) {
              const digits = val.replace(/\D/g, "");
              if (digits.length > 10) {
                val = digits.slice(0, 10);
              }
            } else {
              // Country code +91 with 10 digits = 12 digits total
              const digits = val.replace(/\D/g, "");
              if (digits.length > 12) {
                val = "+" + digits.slice(0, 12);
              }
            }
          }
          updateValue(val);
        };

        const handleBlur = () => {
          if (isTel && value) {
            const digits = String(value).replace(/\D/g, "");
            const isTenDigitValid =
              digits.length === 10 ||
              (digits.length === 12 && digits.startsWith("91")) ||
              (digits.length === 11 && digits.startsWith("0"));
            if (!isTenDigitValid) {
              setErrors((prev) => ({
                ...prev,
                [field.id]: "Please enter a valid 10-digit phone number",
              }));
            }
          }
        };

        const resolvedPlaceholder = (() => {
          const raw = String(field.placeholder || "").trim();
          const lower = raw.toLowerCase();
          if (
            !raw ||
            lower.includes("e.g.") ||
            lower.includes("example.com") ||
            lower.includes("+91") ||
            lower.includes("cusat") ||
            lower.includes("codeninjas")
          ) {
            if (isTel) return "Enter phone number";
            if (isEmail) return "Enter email address";
            const fieldLabelLower = String(field.label || field.name || "").toLowerCase();
            if (fieldLabelLower.includes("college") || fieldLabelLower.includes("university")) {
              return "Enter college or university name";
            }
            if (fieldLabelLower.includes("team")) {
              return "Enter team name";
            }
            if (fieldLabelLower.includes("name")) {
              return "Enter full name";
            }
            return `Enter ${String(field.label || field.name || "details").toLowerCase()}`;
          }
          return raw;
        })();

        return (
          <div key={field.id} className="space-y-1.5 w-full">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
                {field.label || field.name || "Field"}{" "}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              {isEmailLocked && (
                <span className="text-[10px] text-[#3DD68C] font-mono bg-[#3DD68C]/10 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold select-none">
                  <CheckCircle className="w-2.5 h-2.5" /> Verified Account
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={isEmail ? "email" : field.type}
                inputMode={isTel ? "tel" : isEmail ? "email" : undefined}
                maxLength={isTel ? 15 : undefined}
                placeholder={resolvedPlaceholder}
                value={fieldValue}
                readOnly={isEmailLocked}
                onChange={handleInputChange}
                onBlur={handleBlur}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 h-11 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none transition-all text-base sm:text-sm ${
                  isEmailLocked
                    ? "bg-slate-100 dark:bg-[#1A1C1F] cursor-not-allowed opacity-90 border-slate-200 dark:border-[#2A2D31] select-none pr-10"
                    : error
                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-slate-50 dark:bg-[#212327]"
                    : "border-slate-200 dark:border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] bg-slate-50 dark:bg-[#212327]"
                }`}
              />
              {isEmailLocked && (
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none select-none" />
              )}
            </div>
            {isEmailLocked && (
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] flex items-center gap-1">
                <span>Email is locked to your account for security and consistency.</span>
              </p>
            )}
            {error && !isEmailLocked && (
              <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>
            )}
          </div>
        );
      }

      case "textarea":
        return (
          <div key={field.id} className="space-y-1.5 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              placeholder={
                field.placeholder ||
                `Enter ${String(field.label || field.name || "text").toLowerCase()}`
              }
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              disabled={isLoading}
              rows={3}
              className="w-full p-3 bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-all text-base sm:text-sm resize-none"
            />
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      case "radio": {
        const rawOptions = (
          Array.isArray(field.options)
            ? field.options
            : typeof field.options === "string"
            ? field.options.split(",").map((s) => s.trim())
            : []
        )
          .map(String)
          .filter((opt) => opt.trim().length > 0);

        return (
          <div key={field.id} className="space-y-2 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="space-y-2">
              {rawOptions.map((option, idx) => (
                <label
                  key={`${field.id}_${idx}`}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    value === option
                      ? "bg-[#FE760B]/10 border-[#FE760B] text-[#FE760B] font-medium"
                      : "bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:border-slate-300 dark:hover:border-[#3A3D42]"
                  }`}
                >
                  <input
                    type="radio"
                    name={String(field.id)}
                    value={option}
                    checked={value === option}
                    onChange={(e) => updateValue(e.target.value)}
                    disabled={isLoading}
                    className="w-4 h-4 text-[#FE760B] border-slate-300 dark:border-[#2A2D31] focus:ring-[#FE760B]"
                  />
                  <span className="text-sm font-medium">{option}</span>
                </label>
              ))}
            </div>
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );
      }

      case "select":
      case "dropdown": {
        const rawOptions = (
          Array.isArray(field.options)
            ? field.options
            : typeof field.options === "string"
            ? field.options.split(",").map((s) => s.trim())
            : []
        )
          .map(String)
          .filter((opt) => opt.trim().length > 0);

        return (
          <div key={field.id} className="space-y-1.5 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <Select
              value={typeof value === "string" && value ? value : undefined}
              onValueChange={updateValue}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full h-11 px-3.5 py-2.5 bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#FE760B] text-base sm:text-sm">
                <SelectValue
                  placeholder={field.placeholder || "Select"}
                />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-slate-900 dark:text-white shadow-2xl rounded-xl">
                {rawOptions.map((option, idx) => (
                  <SelectItem
                    key={`${field.id}_${idx}`}
                    value={String(option)}
                    className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-[#212327] text-sm cursor-pointer"
                  >
                    {String(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );
      }

      case "date":
        return (
          <div key={field.id} className="space-y-1.5 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
              {field.label || field.name || "Date of Birth / Date"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type="date"
                value={value || ""}
                onChange={(e) => updateValue(e.target.value)}
                disabled={isLoading}
                placeholder={field.placeholder || "YYYY-MM-DD"}
                className={`w-full px-3.5 py-2.5 h-11 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none transition-all text-base sm:text-sm ${
                  error
                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-slate-50 dark:bg-[#212327]"
                    : "border-slate-200 dark:border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] bg-slate-50 dark:bg-[#212327]"
                }`}
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {field.placeholder && (
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">{field.placeholder}</p>
            )}
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>
            )}
          </div>
        );

      case "checkbox": {
        const rawOptions = (
          Array.isArray(field.options)
            ? field.options
            : typeof field.options === "string"
            ? field.options.split(",").map((s) => s.trim())
            : []
        )
          .map(String)
          .filter((opt) => opt.trim().length > 0);

        const selectedArr = Array.isArray(value) ? value : value ? [String(value)] : [];
        return (
          <div key={field.id} className="space-y-2 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="space-y-2">
              {rawOptions.map((option, idx) => {
                const checked = selectedArr.includes(option);
                return (
                  <label
                    key={`${field.id}_${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      checked
                        ? "bg-[#FE760B]/10 border-[#FE760B] text-[#FE760B] font-medium"
                        : "bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:border-slate-300 dark:hover:border-[#3A3D42]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const newSelected = e.target.checked
                          ? [...selectedArr, option]
                          : selectedArr.filter((o) => o !== option);
                        updateValue(newSelected);
                      }}
                      disabled={isLoading}
                      className="w-4 h-4 rounded text-[#FE760B] border-slate-300 dark:border-[#2A2D31] focus:ring-[#FE760B]"
                    />
                    <span className="text-sm font-medium">{option}</span>
                  </label>
                );
              })}
            </div>
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );
      }

      case "file": {
        const isMultiple = Boolean(field.allowMultiple || field.multiple);
        const fileList = Array.isArray(value) ? value : value ? [value] : [];
        return (
          <div key={field.id} className="space-y-1.5 w-full">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
                {field.label || field.name || "File Upload"}{" "}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              <span className="text-[10px] text-slate-500 dark:text-[#9B9EA4] font-medium">
                {isMultiple ? "Multiple files allowed" : "Single file"}
              </span>
            </div>
            <div
              className={`p-4 rounded-xl border border-dashed transition-all ${
                error
                  ? "border-red-500 bg-red-500/5"
                  : "border-slate-300 dark:border-[#2A2D31] hover:border-[#FE760B] bg-slate-50 dark:bg-[#212327]"
              }`}
            >
              <input
                type="file"
                id={`file-input-${field.id}`}
                multiple={isMultiple}
                disabled={isLoading}
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  const processed = await Promise.all(
                    files.map(
                      (file) =>
                        new Promise((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            resolve({
                              name: file.name,
                              size: file.size,
                              type: file.type,
                              data: reader.result,
                            });
                          };
                          reader.onerror = () =>
                            resolve({ name: file.name, size: file.size });
                          reader.readAsDataURL(file);
                        })
                    )
                  );
                  if (isMultiple) {
                    const combined = [...fileList, ...processed];
                    updateValue(combined);
                  } else {
                    updateValue(processed.slice(0, 1));
                  }
                }}
              />
              <label
                htmlFor={`file-input-${field.id}`}
                className="flex flex-col items-center justify-center cursor-pointer text-center space-y-1.5"
              >
                <div className="w-9 h-9 rounded-xl bg-[#FE760B]/10 text-[#FE760B] flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  <span className="text-[#FE760B] font-semibold hover:underline">
                    Click to upload
                  </span>{" "}
                  or drag and drop
                </div>
                <p className="text-[10px] text-slate-500 dark:text-[#9B9EA4]">
                  {isMultiple
                    ? "Upload one or more documents (PDF, PNG, JPG up to 10MB each)"
                    : "Upload a document (PDF, PNG, JPG up to 10MB)"}
                </p>
              </label>

              {fileList.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-slate-200 dark:border-[#2A2D31] pt-2.5">
                  {fileList.map((f, fIdx) => (
                    <div
                      key={fIdx}
                      className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-xs text-slate-800 dark:text-slate-200"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                        <span className="truncate">
                          {typeof f === "string" ? f : f?.name || "Uploaded document"}
                        </span>
                        {f?.size && (
                          <span className="text-[10px] text-slate-400">
                            ({(f.size / 1024).toFixed(0)} KB)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          const updated = fileList.filter((_, i) => i !== fIdx);
                          updateValue(isMultiple ? updated : null);
                        }}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>
            )}
          </div>
        );
      }

      default: {
        return (
          <div key={field.id} className="space-y-1.5 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type={field.type || "text"}
              placeholder={
                field.placeholder ||
                `Enter ${String(field.label || field.name || "details").toLowerCase()}`
              }
              value={value ?? ""}
              onChange={(e) => updateValue(e.target.value)}
              disabled={isLoading}
              className={`w-full px-3.5 py-2.5 h-11 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none transition-all text-base sm:text-sm ${
                error
                  ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-slate-50 dark:bg-[#212327]"
                  : "border-slate-200 dark:border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] bg-slate-50 dark:bg-[#212327]"
              }`}
            />
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>
            )}
          </div>
        );
      }
    }
  };

  if (formLoadError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 max-w-md text-center">
          <X className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-400 mb-1">
            Failed to Load Form
          </h3>
          <p className="text-xs text-red-700 dark:text-red-300 mb-3">
            {formLoadError}
          </p>
          <Button
            onClick={() => setRetryCount((prev) => prev + 1)}
            className="bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs h-8 px-3"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!customForm) {
    return (
      <div className="flex items-center justify-center py-8 px-4">
        <BrandLoader message="Loading..." fullScreen={false} size="sm" />
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col space-y-4">
            {customForm.fields
              ?.filter((field) => field.id && field.type)
              .map((field) => renderField(field))}
          </div>

          {/* Coupon Code (only show for paid events) */}
          {isPaidEvent &&
            finalPayableAmount > 0 &&
            customForm?.enableCoupons !== false && (
              <div className="space-y-1.5 w-full">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
                  Coupon code
                </label>
                {!couponData ? (
                  <div className="flex gap-2">
                    <input
                      placeholder="Optional"
                      value={couponCode}
                      onChange={(e) =>
                        setCouponCode(e.target.value.toUpperCase())
                      }
                      disabled={isLoading || couponValidating}
                      className="flex-1 min-w-0 px-3.5 py-2 h-11 bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-base sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] transition-all uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={
                        isLoading || couponValidating || !couponCode.trim()
                      }
                      className="px-4 py-2 h-11 bg-slate-100 hover:bg-slate-200 dark:bg-[#212327] dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] text-slate-800 dark:text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center shrink-0"
                    >
                      {couponValidating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#FE760B]/10 border border-[#FE760B]/30 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#FE760B]" />
                          <span className="text-sm font-semibold text-[#FE760B]">
                            {couponCode}: {couponData.discountPercent}% OFF
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-xs text-slate-500 dark:text-[#9B9EA4] hover:text-slate-800 dark:hover:text-white underline ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
                {couponError && (
                  <p className="text-[11px] text-red-500 dark:text-red-400">
                    {couponError}
                  </p>
                )}
              </div>
            )}

          {/* Automatic Creator Campus Referral Field */}
          {referralEligible && (
            <div className="space-y-1.5 w-full">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
                Referral Code (Optional)
              </label>
              <input
                placeholder="Enter referral code (if you have one)"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                disabled={isLoading}
                className="w-full px-3.5 py-2 h-11 bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-base sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] transition-all uppercase font-mono"
              />
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                Have an ambassador referral code? Enter it here.
              </p>
            </div>
          )}

          {/* High Contrast Brand CTA Button or Closed for Registration */}
          {isClosedForRegistration ? (
            <button
              type="button"
              disabled
              className="w-full bg-slate-200 dark:bg-[#1E2024] text-slate-500 dark:text-[#9B9EA4] border border-slate-300 dark:border-[#2A2D31] cursor-not-allowed font-bold h-12 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base mt-4 opacity-80 shadow-none select-none transition-all"
            >
              <AlertCircle className="w-4 h-4 text-[#FE760B]" />
              <span>Registration Closed</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading || paymentProcessing}
              style={{
                backgroundColor: props.themeColor || currentEvent?.themeColor || currentEvent?.themeHex || "#FE760B",
              }}
              className="w-full hover:brightness-110 text-white disabled:opacity-50 disabled:cursor-not-allowed font-bold h-12 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base mt-4 cursor-pointer active:scale-[0.99]"
            >
              {isLoading || paymentProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{paymentProcessing ? "Processing Payment..." : "Registering..."}</span>
                </>
              ) : isPaidEvent ? (
                <span>
                  {`Pay ₹${finalPayableAmount} & register`}
                </span>
              ) : (
                <span>Register</span>
              )}
            </button>
          )}
          <p className="text-center text-xs text-slate-500 dark:text-[#9B9EA4] mt-2">
            Secure payment via Razorpay
          </p>
        </form>
      </div>

      {/* Login Modal for Existing Users */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl p-5 xs:p-6 sm:p-7 shadow-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto animate-scale-in text-white">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${themeColor}15`,
                    borderColor: `${themeColor}35`,
                    color: themeColor,
                  }}
                >
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Welcome Back!
                  </h3>
                  <p className="text-xs text-[#9B9EA4] mt-0.5">
                    Sign in to your account to complete registration
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginPassword("");
                  setIsLoading(false);
                }}
                className="p-1.5 rounded-lg text-[#9B9EA4] hover:text-white hover:bg-[#212327] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 sm:space-y-5 mb-6">
              {/* Email Display Card */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-3.5 sm:p-4">
                <p className="text-[11px] font-bold tracking-wider uppercase text-[#9B9EA4] mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" style={{ color: themeColor }} />
                  <span>Your Email Address</span>
                </p>
                <p className="font-mono text-sm sm:text-base font-bold text-white break-all">
                  {tempFormData?.email || "Email not found"}
                </p>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#D0D0D1]">
                  Enter Your Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your account password..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleExistingUserLogin()
                    }
                    className="h-11 sm:h-12 bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] text-white font-mono rounded-xl pl-3.5 pr-11 text-sm placeholder:text-[#9B9EA4]/50 transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9EA4] hover:text-white transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {loginPassword && loginPassword.length < 6 && (
                  <p className="text-xs text-red-400 mt-1">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Forgot Password Link */}
              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    router.push("/login");
                  }}
                  className="text-xs font-semibold text-[#FE760B] hover:text-[#FF8A2B] hover:underline transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  Forgot password? Reset it here
                </button>
              </div>

              {/* Official Note */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#FE760B] shrink-0 mt-0.5" />
                <p className="text-xs text-[#9B9EA4] leading-relaxed">
                  <strong className="text-white font-semibold">Note:</strong> Use the password you set when you first registered on TicketLelo.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExistingUserLogin}
                disabled={
                  isLoggingIn || !loginPassword || loginPassword.length < 6
                }
                style={{
                  backgroundColor: themeColor,
                }}
                className="flex-1 h-11 sm:h-12 text-[#131517] font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 active:scale-[0.99]"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
                    <span>Logging in...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-[#131517]" />
                    <span>Login &amp; Continue</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginPassword("");
                  setIsLoading(false);
                }}
                disabled={isLoggingIn}
                className="h-11 sm:h-12 px-5 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31] font-semibold rounded-xl transition-colors text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#1A1C1F] rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl max-w-lg w-full border border-[#2A2D31] max-h-[90dvh] overflow-y-auto animate-scale-in text-white">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2A2D31]">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: isPendingApproval ? "rgba(253,224,3,0.15)" : "rgba(61,214,140,0.15)",
                    borderColor: isPendingApproval ? "rgba(253,224,3,0.35)" : "rgba(61,214,140,0.35)",
                    color: isPendingApproval ? "#FDE003" : "#3DD68C",
                  }}
                >
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {isPendingApproval ? "Registration Submitted" : "Registration Successful!"}
                  </h3>
                  <p className="text-xs text-[#9B9EA4]">
                    {isPendingApproval ? "Pending organiser review" : "Your spot is confirmed"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="p-1.5 hover:bg-[#212327] rounded-lg text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Description Body */}
              <div className="space-y-2 text-sm text-[#D0D0D1] leading-relaxed">
                {emailDeliveryStatus === "failed" ? (
                  <p>
                    You&apos;re successfully registered for this event. We experienced a slight delay sending your confirmation email, but your registration is fully secured.
                  </p>
                ) : (
                  <p>
                    You&apos;re successfully registered for this event. Your ticket confirmation has been sent to your email.
                  </p>
                )}
                {isFirstTimeUser ? (
                  <p className="text-xs sm:text-sm text-[#E1E4EA] font-medium pt-1">
                    To access your ticket and manage all your registrations, set up your TicketLelo password using the link sent to your email.
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-[#D0D0D1] pt-1">
                    To access your ticket and manage all your registrations, log in with your TicketLelo password using your registered email address.
                  </p>
                )}
              </div>

              {/* Additional message box with Mail icon */}
              <div className="bg-[#131517] border border-[#2A2D31] rounded-xl p-3.5 sm:p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center shrink-0 text-[#FE760B]">
                  <Mail className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-[#D0D0D1]">
                  {emailDeliveryStatus === "failed"
                    ? "Check your dashboard or retry sending from account settings."
                    : "Check your inbox for your ticket confirmation email."}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#2A2D31]">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                style={{ backgroundColor: themeColor || "#FE760B" }}
                className="flex-1 h-11 sm:h-12 text-[#131517] font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer hover:brightness-105 active:scale-[0.99]"
              >
                Got It
              </button>
              {effectiveUser && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    router.push("/dashboard");
                  }}
                  className="h-11 sm:h-12 px-5 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31] font-semibold rounded-xl transition-colors text-sm cursor-pointer"
                >
                  View Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
