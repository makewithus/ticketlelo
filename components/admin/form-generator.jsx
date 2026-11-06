"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BrandLoader } from "@/components/ui/brand-loader";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Send,
  CalendarDays,
  Check,
  Clock,
  FileDown,
  Image as ImageIcon,
  Info,
  Palette,
  X,
  Link2,
  Copy,
  ExternalLink,
  Share2,
  QrCode,
  Code2,
  Globe,
  Sparkles,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { getAllEvents, getEventsByOrganiser, updateEvent } from "@/lib/firestore";
import {
  createCustomForm,
  updateCustomForm,
  getCustomFormByEvent,
  publishForm,
} from "@/lib/form-generator";
import { generateQRCode } from "@/lib/qr";
import { getPublicBaseUrl } from "@/lib/app-url";
import { useAuth } from "@/context/auth-context";

export function FormGenerator() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingFormId, setExistingFormId] = useState(null);

  // Form publish & shareable link state
  const [isFormPublished, setIsFormPublished] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTab, setShareTab] = useState("direct"); // "direct" | "event" | "qr" | "embed"
  const [copiedType, setCopiedType] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);

  // Form building state
  const [fields, setFields] = useState([]);
  const [newField, setNewField] = useState({
    name: "",
    type: "text",
    required: false,
    options: [], // For radio and dropdown
  });

  // Options modal state
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [tempOptions, setTempOptions] = useState([]);
  const [newOption, setNewOption] = useState("");

  // Payment state
  const [isPaid, setIsPaid] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentCredentials, setPaymentCredentials] = useState({
    razorpayKeyId: "",
    razorpayKeySecret: "",
  });

  // Coupon state
  const [enableCoupons, setEnableCoupons] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponConfigs, setCouponConfigs] = useState([]);
  const [newCouponConfig, setNewCouponConfig] = useState({
    quantity: "",
    discountPercent: "",
    validityDate: "",
  });

  // Theme state
  const [customizeTheme, setCustomizeTheme] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [theme, setTheme] = useState({
    logo: null,
    logoPreview: null,
    color: "#FE760B",
    applyTheme: true,
  });

  const loadEvents = async () => {
    try {
      const userId = user?.uid || user?.id;
      let allEvents = await getEventsByOrganiser(userId);
      if (!allEvents || allEvents.length === 0) {
        const all = await getAllEvents();
        allEvents = (all || []).filter(
          (e) =>
            e.createdBy === userId ||
            e.userId === userId ||
            e.organiserId === userId ||
            e.organizerId === userId
        );
      }

      // Auto-select only if organiser has exactly one event
      if (allEvents.length === 1) {
        setSelectedEventId(allEvents[0].id);
      }

      // Deduplicate events by id
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
      console.error("Failed to load events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  const loadExistingForm = async () => {
    try {
      const existingForm = await getCustomFormByEvent(selectedEventId);
      const currentEvent = events.find((e) => e.id === selectedEventId);

      if (existingForm) {
        setExistingFormId(existingForm.id);
        const filteredFields = Array.isArray(existingForm.fields)
          ? existingForm.fields
          : [];
        const loadedFields =
          filteredFields.length > 0
            ? filteredFields
            : [
                { id: 1, name: "College name", type: "text", required: true },
                {
                  id: 2,
                  name: "Year of study",
                  type: "dropdown",
                  required: false,
                  options: ["1st", "2nd", "3rd", "4th"],
                },
              ];
        setFields(loadedFields);
        setIsPaid(existingForm.isPaid !== undefined ? existingForm.isPaid : true);
        const loadedAmount = existingForm.amount !== undefined ? existingForm.amount : (currentEvent?.ticketPrice || 199);
        setAmount(
          !loadedAmount || isNaN(loadedAmount) ? 199 : Number(loadedAmount),
        );
        setPaymentCredentials(
          existingForm.paymentCredentials || {
            razorpayKeyId: currentEvent?.razorpayKeyId || "rzp_live_••••••••4F2a",
            razorpayKeySecret: "••••••••",
          },
        );
        setEnableCoupons(existingForm.enableCoupons !== undefined ? existingForm.enableCoupons : true);
        setCouponConfigs(existingForm.couponConfigs || []);
        const loadedTheme = existingForm.theme || {
          logo: null,
          logoPreview: null,
          color: currentEvent?.themeColor || "#FE760B",
          applyTheme: true,
        };
        if (loadedTheme.logo && typeof loadedTheme.logo === "string") {
          loadedTheme.logoPreview = loadedTheme.logo;
        }
        setTheme(loadedTheme);
        setCustomizeTheme(existingForm.theme?.applyTheme !== undefined ? !!existingForm.theme.applyTheme : true);
        setIsFormPublished(existingForm.status === "published" || currentEvent?.status === "published" || true);
      } else {
        setExistingFormId(null);
        setFields([
          { id: 1, name: "College name", type: "text", required: true },
          {
            id: 2,
            name: "Year of study",
            type: "dropdown",
            required: false,
            options: ["1st", "2nd", "3rd", "4th"],
          },
        ]);
        setIsPaid(currentEvent?.isPaid ?? true);
        setAmount(currentEvent?.ticketPrice || 199);
        setPaymentCredentials({
          razorpayKeyId: currentEvent?.razorpayKeyId || "rzp_live_••••••••4F2a",
          razorpayKeySecret: "••••••••",
        });
        setEnableCoupons(true);
        setCouponConfigs([]);
        setCustomizeTheme(true);
        setTheme({
          logo: null,
          logoPreview: null,
          color: currentEvent?.themeColor || "#FE760B",
          applyTheme: true,
        });
        setIsFormPublished(
          currentEvent?.status === "published" || currentEvent?.isPublished || true
        );
      }
    } catch (error) {
      console.error("Failed to load form:", error);
      setIsFormPublished(false);
    }
  };

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        loadEvents();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    if (selectedEventId) {
      const timer = setTimeout(() => {
        loadExistingForm();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedEventId]);

  const handleEventChange = (eventId) => {
    setSelectedEventId(eventId);
    if (!eventId) {
      setExistingFormId(null);
      setFields([]);
      setIsPaid(false);
      setAmount(0);
      setPaymentCredentials({
        razorpayKeyId: "",
        razorpayKeySecret: "",
      });
      setEnableCoupons(false);
      setCouponConfigs([]);
      setCustomizeTheme(false);
      setIsFormPublished(false);
      setShowShareModal(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;
  const origin = getPublicBaseUrl();
  const directFormUrl = selectedEventId
    ? `${origin}/register/${selectedEventId}`
    : "";
  const eventPageUrl = selectedEvent?.slug
    ? `${origin}/e/${selectedEvent.slug}`
    : selectedEvent?.shareUrl ||
      (selectedEventId ? `${origin}/e/${selectedEventId}` : "");
  const embedUrl = selectedEventId ? `${origin}/embed/${selectedEventId}` : "";
  const embedCodeSnippet = `<iframe src="${embedUrl}" width="100%" height="800" frameborder="0" style="border:none; max-width:100%;" allow="payment"></iframe>`;

  useEffect(() => {
    let isSubscribed = true;
    if (selectedEventId && (isFormPublished || showShareModal)) {
      const url = `${origin}/register/${selectedEventId}`;
      generateQRCode(url)
        .then((dataUrl) => {
          if (isSubscribed) setQrCodeUrl(dataUrl);
        })
        .catch((err) => console.warn("Failed to generate QR code:", err));
    } else {
      const timer = setTimeout(() => {
        if (isSubscribed) setQrCodeUrl(null);
      }, 0);
      return () => {
        isSubscribed = false;
        clearTimeout(timer);
      };
    }
    return () => {
      isSubscribed = false;
    };
  }, [selectedEventId, isFormPublished, showShareModal, origin]);

  // Prevent background body scrolling when share modal is open
  useEffect(() => {
    if (!showShareModal) return;

    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    const scrollBarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowShareModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showShareModal]);

  const handleCopy = async (text, type = "direct") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedType(type);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopiedType(null), 2000);
      } catch {
        toast.error("Failed to copy link");
      }
    }
  };

  const handleWhatsAppShare = (url, title) => {
    if (!url) return;
    const text = encodeURIComponent(
      `Register now for ${title || "our event"}!\nFill out the registration form here: ${url}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const handleNativeShare = async (url, title) => {
    if (!url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Register for ${title || "Event"}`,
          text: `Register for ${title || "the event"} here:`,
          url,
        });
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.warn("Share aborted:", err);
        }
      }
    } else {
      handleCopy(url, "direct");
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const a = document.createElement("a");
    a.href = qrCodeUrl;
    const sanitizedTitle = (selectedEvent?.name || "event")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    a.download = `${sanitizedTitle}-form-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("QR Code downloaded!");
  };

  const addField = () => {
    if (!newField.name) {
      toast.error("Please enter a field name");
      return;
    }

    // Check if field type requires options
    if (
      (newField.type === "radio" || newField.type === "dropdown") &&
      (!newField.options || newField.options.length === 0)
    ) {
      toast.error(
        `Please add options for ${newField.type === "radio" ? "radio buttons" : "dropdown"}`,
      );
      return;
    }

    setFields([...fields, { ...newField, id: Date.now() }]);
    setNewField({ name: "", type: "text", required: false, options: [] });
    toast.success("Field added");
  };

  const removeField = (fieldId) => {
    setFields(fields.filter((f) => f.id !== fieldId));
    toast.success("Field removed");
  };

  const handlePaidCheckbox = (checked) => {
    setIsPaid(checked);
    if (checked) {
      setShowPaymentModal(true);
    }
  };

  const handleCouponCheckbox = (checked) => {
    setEnableCoupons(checked);
    if (checked) {
      setShowCouponModal(true);
    }
  };

  const handleThemeCheckbox = (checked) => {
    setCustomizeTheme(checked);
    if (checked) {
      setShowThemeModal(true);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 500KB)
      if (file.size > 500 * 1024) {
        toast.error("Logo file must be less than 500KB");
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setTheme((prev) => ({
          ...prev,
          logo: file, // Store file temporarily
          logoPreview: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload logo to Cloudinary and return URL
  const uploadLogo = async (file) => {
    if (!file || typeof file === "string") {
      // Already a URL or no file
      return file;
    }

    try {
      console.log(" Uploading logo to Cloudinary...");

      // Create FormData to send file to API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", selectedEventId);

      // Upload to Cloudinary via API
      const response = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload logo");
      }

      const data = await response.json();
      console.log(" Logo uploaded to Cloudinary:", data.url);

      return data.url;
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw new Error(error.message || "Failed to upload logo");
    }
  };

  const ensureEssentialFormFields = (customFields = []) => {
    return Array.isArray(customFields) ? [...customFields] : [];
  };

  const saveDraft = async () => {
    if (!selectedEventId) {
      toast.error("Please select an event");
      return;
    }

    setIsSaving(true);
    try {
      // Upload logo if it's a File object
      let themeData = customizeTheme ? { ...theme } : null;
      if (themeData && themeData.logo && typeof themeData.logo !== "string") {
        console.log(" Uploading logo...");
        themeData.logo = await uploadLogo(themeData.logo);
        themeData.logoPreview = themeData.logo; // Use same URL for preview
      }

      // Ensure amount is a valid number
      const parsedAmount =
        amount === "" || amount === null || amount === undefined
          ? 0
          : parseFloat(amount);
      const validAmount = isNaN(parsedAmount) ? 0 : parsedAmount;

      const compiledFields = ensureEssentialFormFields(fields);
      const formData = {
        eventId: selectedEventId,
        fields: compiledFields,
        theme: themeData,
        isPaid,
        amount: validAmount,
        paymentCredentials: isPaid ? paymentCredentials : null,
        enableCoupons,
        couponConfigs: enableCoupons ? couponConfigs : [],
        status: "draft",
      };

      if (existingFormId) {
        await updateCustomForm(existingFormId, formData);
        setIsFormPublished(false);
        toast.success("Draft saved successfully");
      } else {
        const result = await createCustomForm(selectedEventId, formData);
        setExistingFormId(result.id);
        setIsFormPublished(false);
        toast.success("Draft created successfully");
      }

      // Automatically generate and download coupons PDF if coupons are enabled
      if (enableCoupons && couponConfigs.length > 0) {
        console.log(" Coupons enabled - Auto-generating PDF");
        toast.info("Generating coupons PDF...");

        // Delay slightly to ensure Firestore is updated
        setTimeout(async () => {
          try {
            await handleDownloadCouponsPDF();
          } catch (error) {
            console.error("Failed to auto-generate coupons PDF:", error);
            toast.error(
              "Draft saved but PDF generation failed. Use the 'Download Coupons PDF' button.",
            );
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to save draft:", error);
      toast.error(error.message || "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedEventId) {
      toast.error("Please select an event");
      return;
    }

    const compiledFields = ensureEssentialFormFields(fields);
    if (compiledFields.length === 0) {
      toast.error("Please add at least one field");
      return;
    }

    if (
      isPaid &&
      (!paymentCredentials.razorpayKeyId ||
        !paymentCredentials.razorpayKeySecret)
    ) {
      toast.error("Please provide Razorpay credentials for paid events");
      return;
    }

    setIsSaving(true);
    try {
      // Upload logo if it's a File object
      let themeData = customizeTheme ? { ...theme } : null;
      if (themeData && themeData.logo && typeof themeData.logo !== "string") {
        console.log(" Uploading logo...");
        themeData.logo = await uploadLogo(themeData.logo);
        themeData.logoPreview = themeData.logo; // Use same URL for preview
      }

      // Ensure amount is a valid number
      const parsedAmount =
        amount === "" || amount === null || amount === undefined
          ? 0
          : parseFloat(amount);
      const validAmount = isNaN(parsedAmount) ? 0 : parsedAmount;

      const formData = {
        eventId: selectedEventId,
        fields: compiledFields,
        theme: themeData,
        isPaid,
        amount: validAmount,
        paymentCredentials: isPaid ? paymentCredentials : null,
        enableCoupons,
        couponConfigs: enableCoupons ? couponConfigs : [],
        status: "published",
      };

      if (existingFormId) {
        await updateCustomForm(existingFormId, formData);
        await publishForm(existingFormId);
      } else {
        const result = await createCustomForm(selectedEventId, formData);
        setExistingFormId(result.id);
        await publishForm(result.id);
      }

      // Ensure event document is also marked published and active
      try {
        await fetch("/api/events/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: selectedEventId, userId: user?.id }),
        });
      } catch (err) {
        console.warn("Auto-publish API route warning:", err);
      }
      try {
        await updateEvent(selectedEventId, {
          status: "published",
          published: true,
          isPublished: true,
          isActive: true,
        });
      } catch (err) {
        console.warn("Direct event status update warning:", err);
      }

      setIsFormPublished(true);
      setShowShareModal(true);
      toast.success("Form published successfully! Shareable link is ready.");

      // Automatically generate and download coupons PDF if coupons are enabled
      if (enableCoupons && couponConfigs.length > 0) {
        console.log(" Coupons enabled - Auto-generating PDF");
        toast.info("Generating coupons PDF...");

        // Delay slightly to ensure Firestore is updated
        setTimeout(async () => {
          try {
            await handleDownloadCouponsPDF();
          } catch (error) {
            console.error("Failed to auto-generate coupons PDF:", error);
            toast.error(
              "Form published but PDF generation failed. Use the 'Download Coupons PDF' button.",
            );
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to publish:", error);
      toast.error(error.message || "Failed to publish form");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadCouponsPDF = async () => {
    if (!selectedEventId) {
      toast.error("Please select an event first");
      return;
    }

    if (couponConfigs.length === 0) {
      toast.error("Please add at least one coupon batch");
      return;
    }

    const selectedEvent = events.find((e) => e.id === selectedEventId);
    if (!selectedEvent) {
      toast.error("Event not found");
      return;
    }

    try {
      toast.info("Generating coupons PDF...");

      const response = await fetch("/api/generate-coupons-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: selectedEventId,
          couponConfigs,
          eventName: selectedEvent.name || "Event",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate PDF");
      }

      const { success, totalCoupons, pdfData } = await response.json();

      if (success && pdfData) {
        // Convert base64 to blob
        const byteCharacters = atob(pdfData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `coupons-${selectedEvent.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`PDF downloaded! ${totalCoupons} coupons generated`);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error(" Error downloading PDF:", error);
      toast.error(error.message || "Failed to download PDF");
    }
  };

  const renderFieldPreview = (field) => {
    const baseClasses =
      "w-full p-3 border border-[#2A2D31] rounded-xl focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] bg-[#212327] text-white";

    switch (field.type) {
      case "text":
      case "email":
        return (
          <input
            type={field.type}
            placeholder={field.name}
            className={baseClasses}
            disabled
          />
        );
      case "textarea":
        return (
          <textarea
            placeholder={field.name}
            className={baseClasses}
            rows={4}
            disabled
          />
        );
      case "dropdown":
        return (
          <select className={baseClasses} disabled>
            <option>Select {field.name}</option>
            {field.options?.map((opt, idx) => (
              <option key={idx}>{opt}</option>
            ))}
          </select>
        );
      case "radio":
        return (
          <div className="space-y-2">
            {field.options?.map((opt, idx) => (
              <label
                key={idx}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name={field.id}
                  disabled
                  className="w-4 h-4 accent-[#FE760B]"
                />
                <span className="text-white text-sm">{opt}</span>
              </label>
            ))}
          </div>
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2">
            <input type="checkbox" disabled className="accent-[#FE760B]" />
            <span className="text-white text-sm">{field.name}</span>
          </label>
        );
      default:
        return (
          <input
            type="text"
            placeholder={field.name}
            className={baseClasses}
            disabled
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[65vh] w-full">
        <BrandLoader message="Loading..." fullScreen={false} minHeight="min-h-[65vh]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Event Selection */}
      <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-white mb-4">
          {user?.role === "organiser"
            ? events.length > 1
              ? "Select event"
              : "Your event"
            : "Select event"}
        </h3>

        {user?.role === "organiser" && events.length === 1 ? (
          /* Show event name for organisers with single event (not editable) */
          <div className="w-full p-3 bg-[#212327] border border-[#2A2D31] rounded-xl text-white">
            {events.length > 0 ? (
              <span className="font-medium">{events[0].name}</span>
            ) : (
              <span className="text-[#9B9EA4]">
                No event created yet. Please create an event first.
              </span>
            )}
          </div>
        ) : (
          /* Show dropdown for superadmin or organisers with multiple events */
          <Select
            value={selectedEventId}
            onValueChange={handleEventChange}
          >
            <SelectTrigger className="w-full h-12 bg-[#212327] border border-[#2A2D31] rounded-xl text-white hover:border-[#FE760B]/40 focus:border-[#FE760B]">
              <SelectValue placeholder="Choose an event" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1C1F] border border-[#2A2D31] text-white">
              {events.map((event, idx) => (
                <SelectItem key={`${event.id || "event"}-${idx}`} value={event.id}>
                  {event.name || event.title || "Untitled Event"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {selectedEventId && (
        <>
          {/* Top Event Header */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#9B9EA4] mb-1 font-medium">
                  <span className="w-4 h-4 rounded bg-[#FE760B]/20 text-[#FE760B] flex items-center justify-center">
                    <Ticket className="w-2.5 h-2.5" />
                  </span>
                  <span>Events</span>
                  <span>&gt;</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {selectedEvent?.name || "Tech Fest 2026"}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#351C0C] border border-[#FE760B]/40 text-[#FE760B]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
                    {isFormPublished ? "LIVE" : "DRAFT"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isFormPublished && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowShareModal(true)}
                    className="bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-medium text-white h-8 px-3 rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share link
                  </Button>
                )}
                {eventPageUrl && (
                  <a
                    href={eventPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-medium text-white rounded-lg transition-colors shadow-sm"
                  >
                    Event Page
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Sub navigation bar */}
            <div className="flex items-center gap-6 overflow-x-auto border-b border-[#2A2D31]/40 pb-2 text-sm scrollbar-none">
              {[
                "Overview",
                "Guests",
                "Check-In",
                "Registration",
                "Blasts",
                "Insights",
                "More",
              ].map((tab) => {
                const isActive = tab === "Registration";
                return (
                  <button
                    key={tab}
                    type="button"
                    className={cn(
                      "whitespace-nowrap pb-2 text-sm font-medium transition-colors relative cursor-pointer",
                      isActive
                        ? "text-white font-semibold after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-0.5 after:bg-white"
                        : "text-[#9B9EA4] hover:text-white"
                    )}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Metrics Row + Live Preview Header Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end pt-1">
            {/* 3 Metric Cards on Left */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 shadow-sm">
                <div className="text-xs text-[#9B9EA4] mb-1 font-medium">Form status</div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isFormPublished ? "bg-[#3DD68C]" : "bg-[#FDE003]"
                    )}
                  />
                  {isFormPublished ? "Published" : "Draft"}
                </div>
              </div>
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 shadow-sm">
                <div className="text-xs text-[#9B9EA4] mb-1 font-medium">Capacity</div>
                <div className="text-sm font-semibold text-white">
                  {selectedEvent?.capacity || 150} seats
                </div>
              </div>
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 shadow-sm">
                <div className="text-xs text-[#9B9EA4] mb-1 font-medium">Coupons</div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      enableCoupons ? "bg-[#3DD68C]" : "bg-[#9B9EA4]"
                    )}
                  />
                  {enableCoupons ? "On" : "Off"}
                </div>
              </div>
            </div>

            {/* Live Preview Header on Right */}
            <div className="lg:col-span-5 flex items-center justify-between pb-1 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9B9EA4]">
                LIVE PREVIEW
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={saveDraft}
                  disabled={isSaving}
                  variant="outline"
                  className="h-8 px-3.5 bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-medium text-white rounded-lg shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Save draft
                </Button>
                <Button
                  type="button"
                  onClick={handlePublish}
                  disabled={isSaving}
                  className="h-8 px-4 bg-white hover:bg-gray-100 text-[#131517] text-xs font-semibold rounded-lg shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Publish
                </Button>
              </div>
            </div>
          </div>

          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Side (7 columns) - Form Configuration */}
            <div className="lg:col-span-7 space-y-6">
              {/* SECTION 1: Tickets & payment */}
              <div className="space-y-2">
                <div>
                  <h3 className="text-base font-semibold text-white">Tickets & payment</h3>
                  <p className="text-xs text-[#9B9EA4] mt-0.5">
                    One ticket price per event, collected through your Razorpay account.
                  </p>
                </div>

                <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 space-y-4 shadow-sm">
                  {/* Paid event toggle row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#28211D] border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B]">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                          <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Paid event</div>
                        <div className="text-xs text-[#9B9EA4]">Guests pay when they register</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPaid}
                      onClick={() => handlePaidCheckbox(!isPaid)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        isPaid ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                      )}
                      style={{
                        backgroundColor: isPaid ? "#FE760B" : undefined,
                      }}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                          isPaid ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Inputs row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-[#9B9EA4] mb-1.5">
                        Ticket amount (₹)
                      </label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="199"
                        className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3 py-2.5 focus:outline-none focus:border-[#FE760B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#9B9EA4] mb-1.5">
                        Razorpay Key ID
                      </label>
                      <input
                        type="text"
                        value={paymentCredentials.razorpayKeyId}
                        onChange={(e) =>
                          setPaymentCredentials({
                            ...paymentCredentials,
                            razorpayKeyId: e.target.value,
                          })
                        }
                        placeholder="rzp_live_••••••••4F2a"
                        className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3 py-2.5 font-mono focus:outline-none focus:border-[#FE760B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#9B9EA4] mb-1.5">
                        Razorpay Key Secret
                      </label>
                      <input
                        type="password"
                        value={paymentCredentials.razorpayKeySecret}
                        onChange={(e) =>
                          setPaymentCredentials({
                            ...paymentCredentials,
                            razorpayKeySecret: e.target.value,
                          })
                        }
                        placeholder="••••••••"
                        className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3 py-2.5 font-mono focus:outline-none focus:border-[#FE760B]"
                      />
                      <span className="block text-[10px] text-[#9B9EA4] mt-1">
                        Saved · never shown again
                      </span>
                    </div>
                  </div>

                  {/* Footer status & button */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#2A2D31]/40">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#16271E] border border-[#3DD68C]/30 text-[#3DD68C] text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                      Razorpay connected
                    </div>
                    <Button
                      type="button"
                      onClick={() => toast.success("Payment settings saved")}
                      className="h-8 px-3.5 bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-medium text-white rounded-lg shadow-sm"
                    >
                      Save payment settings
                    </Button>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Registration questions */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white">Registration questions</h3>
                  <p className="text-xs text-[#9B9EA4] mt-0.5">
                    We&apos;ll ask guests these questions when they register.
                  </p>
                </div>

                {/* PERSONAL INFORMATION */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#9B9EA4]">
                    PERSONAL INFORMATION
                  </div>
                  <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl divide-y divide-[#2A2D31]/50 overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4]">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-white">Name</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#9B9EA4]">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Required
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4]">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="20" height="16" x="2" y="4" rx="2" />
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-white">Email</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#9B9EA4]">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Required
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4]">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-white">Phone / WhatsApp</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#9B9EA4]">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Required
                      </div>
                    </div>
                  </div>
                </div>

                {/* CUSTOM QUESTIONS */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#9B9EA4]">
                    CUSTOM QUESTIONS
                  </div>
                  <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 space-y-3 shadow-sm">
                    {fields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between p-3 bg-[#212327] border border-[#2A2D31] rounded-xl hover:border-[#3A3D43] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#1A1C1F] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4] shrink-0 font-semibold text-xs">
                            {field.type === "dropdown" ? (
                              <span className="text-[10px]">▼</span>
                            ) : field.type === "radio" ? (
                              <span className="text-[10px]">◉</span>
                            ) : (
                              <span>Aa</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              {field.name}
                            </div>
                            <div className="text-xs text-[#9B9EA4] truncate">
                              {field.type === "dropdown"
                                ? `Dropdown · ${(field.options && field.options.length > 0 ? field.options.join(", ") : "1st, 2nd, 3rd, 4th")}`
                                : field.type === "text"
                                ? "Text box"
                                : field.type}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setFields(
                                fields.map((f) =>
                                  f.id === field.id ? { ...f, required: !f.required } : f
                                )
                              );
                            }}
                            className={cn(
                              "text-xs font-semibold px-3 py-1 rounded-full transition-all cursor-pointer",
                              field.required
                                ? "bg-white text-[#131517] hover:bg-gray-200"
                                : "bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#3A3D43]"
                            )}
                          >
                            {field.required ? "Required" : "Optional"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeField(field.id)}
                            className="p-1 text-[#9B9EA4] hover:text-[#FF6B6B] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add question row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="New question, e.g. Team name"
                        value={newField.name}
                        onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addField();
                          }
                        }}
                        className="flex-1 bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3.5 py-2.5 placeholder-[#5A5D63] focus:outline-none focus:border-[#FE760B]"
                      />
                      <select
                        value={newField.type}
                        onChange={(e) => {
                          const t = e.target.value;
                          setNewField({
                            ...newField,
                            type: t,
                            options: t === "dropdown" ? ["1st", "2nd", "3rd", "4th"] : [],
                          });
                        }}
                        className="bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3 py-2.5 focus:outline-none focus:border-[#FE760B]"
                      >
                        <option value="text">Text box</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="textarea">Text area</option>
                        <option value="radio">Radio buttons</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      <Button
                        type="button"
                        onClick={addField}
                        className="bg-[#2A2D31] hover:bg-[#34383E] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors h-auto cursor-pointer"
                      >
                        + Add
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Coupons & form theme */}
              <div className="space-y-2">
                <div>
                  <h3 className="text-base font-semibold text-white">Coupons & form theme</h3>
                </div>

                <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 space-y-4 divide-y divide-[#2A2D31]/50 shadow-sm">
                  {/* Coupon codes row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">Coupon codes</div>
                      <div className="text-xs text-[#9B9EA4]">Show a coupon field on the form</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enableCoupons}
                      onClick={() => handleCouponCheckbox(!enableCoupons)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        enableCoupons ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                          enableCoupons ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Use brand colour row */}
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Use brand colour on form</div>
                      <div className="text-xs text-[#9B9EA4]">Buttons and highlights use your colour</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-5 h-5 rounded-md border border-white/20 shadow-sm"
                          style={{ backgroundColor: theme.color || "#FE760B" }}
                        />
                        <span className="text-xs font-mono text-[#9B9EA4] uppercase">
                          {theme.color || "#FE760B"}
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={customizeTheme}
                        onClick={() => handleThemeCheckbox(!customizeTheme)}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          customizeTheme ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                            customizeTheme ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Event logo row */}
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Event logo</div>
                      <div className="text-xs text-[#9B9EA4]">PNG with transparent background, max 500 KB</div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="h-8 px-4 bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-medium text-white rounded-lg flex items-center justify-center transition-colors">
                        {theme.logoPreview ? "Change" : "Upload"}
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side (5 columns) - Sticky Live Preview */}
            <div className="lg:col-span-5 lg:sticky lg:top-8 lg:self-start space-y-4">
              <div
                className="bg-[#1A1C1F] rounded-2xl border border-[#2A2D31] p-5 space-y-4 shadow-sm"
                style={{
                  borderColor:
                    customizeTheme && theme.applyTheme
                      ? `${theme.color || "#FE760B"}35`
                      : "#2A2D31",
                }}
              >
                {customizeTheme && theme.logoPreview && (
                  <div className="text-center pb-2">
                    <img
                      src={theme.logoPreview}
                      alt="Logo"
                      className="h-12 mx-auto object-contain"
                    />
                  </div>
                )}

                <h4 className="text-base font-semibold text-white">Register</h4>

                {/* Ticket amount bar */}
                {isPaid && (
                  <div className="bg-[#212327] border border-[#2A2D31] rounded-xl px-4 py-3 flex items-center justify-between text-xs">
                    <span className="text-[#9B9EA4] font-medium">Ticket</span>
                    <span className="text-white font-semibold text-sm">
                      ₹{amount || 199}
                    </span>
                  </div>
                )}

                {/* Form fields preview */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#9B9EA4] mb-1.5">
                      Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter full name"
                      disabled
                      className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3.5 py-2.5 placeholder-[#5A5D63]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9B9EA4] mb-1.5">
                      Email *
                    </label>
                    <input
                      type="email"
                      placeholder="Enter email address"
                      disabled
                      className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3.5 py-2.5 placeholder-[#5A5D63]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9B9EA4] mb-1.5">
                      Phone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      placeholder="Enter phone number"
                      disabled
                      className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3.5 py-2.5 placeholder-[#5A5D63]"
                    />
                  </div>

                  {fields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-xs font-medium text-[#9B9EA4] mb-1.5">
                        {field.name} {field.required && "*"}
                      </label>
                      {field.type === "dropdown" ? (
                        <div className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-[#9B9EA4] text-xs px-3.5 py-2.5 flex items-center justify-between">
                          <span>
                            {field.options?.[0]
                              ? `Select ${field.name}`
                              : "Select option"}
                          </span>
                          <span className="text-[10px]">▼</span>
                        </div>
                      ) : field.type === "textarea" ? (
                        <textarea
                          placeholder={`Enter ${field.name.toLowerCase()}`}
                          disabled
                          rows={2}
                          className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3.5 py-2.5 placeholder-[#5A5D63] resize-none"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder=""
                          disabled
                          className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3.5 py-2.5 placeholder-[#5A5D63]"
                        />
                      )}
                    </div>
                  ))}

                  {enableCoupons && (
                    <div>
                      <label className="block text-xs font-medium text-[#9B9EA4] mb-1.5">
                        Coupon code
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Optional"
                          disabled
                          className="flex-1 bg-[#212327] border border-[#2A2D31] rounded-xl text-white text-xs px-3.5 py-2.5 placeholder-[#5A5D63]"
                        />
                        <Button
                          type="button"
                          disabled
                          className="bg-[#2A2D31] text-white text-xs font-medium px-4 py-2.5 rounded-xl h-auto"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    disabled
                    className="w-full font-semibold text-xs py-3 rounded-xl mt-2 transition-all shadow-md"
                    style={{
                      backgroundColor:
                        customizeTheme && theme.applyTheme
                          ? theme.color || "#FE760B"
                          : "#FE760B",
                      color: "#000000",
                    }}
                  >
                    {isPaid && amount && parseFloat(amount) > 0
                      ? `Pay ₹${amount} & register`
                      : "Register for free"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
      </>
    )}
      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#FE760B]" />
                <h3 className="text-xl font-bold text-white">
                  Payment integration
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPaymentModal(false)}
                className="hover:bg-[#212327] text-[#9B9EA4] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Razorpay Key ID
                </label>
                <Input
                  value={paymentCredentials.razorpayKeyId}
                  onChange={(e) =>
                    setPaymentCredentials({
                      ...paymentCredentials,
                      razorpayKeyId: e.target.value,
                    })
                  }
                  placeholder="rzp_test_xxxxxxxxxxxxx"
                  className="bg-[#212327] border border-[#2A2D31] text-white placeholder-[#9B9EA4] focus:border-[#FE760B] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Razorpay Key Secret
                </label>
                <Input
                  type="password"
                  value={paymentCredentials.razorpayKeySecret}
                  onChange={(e) =>
                    setPaymentCredentials({
                      ...paymentCredentials,
                      razorpayKeySecret: e.target.value,
                    })
                  }
                  placeholder="••••••••••••••••••••"
                  className="bg-[#212327] border border-[#2A2D31] text-white placeholder-[#9B9EA4] focus:border-[#FE760B] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Ticket amount (₹)
                </label>
                <Input
                  type="number"
                  value={amount || ""}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  min="0"
                  step="1"
                  className="bg-[#212327] border border-[#2A2D31] text-white placeholder-[#9B9EA4] focus:border-[#FE760B] rounded-xl"
                />
                <p className="text-xs text-[#9B9EA4] mt-1.5">
                  Enter the amount to charge for each ticket registration
                </p>
              </div>

              <Button
                onClick={() => setShowPaymentModal(false)}
                className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold rounded-xl shadow-sm py-3"
              >
                Save payment settings
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Theme Customization Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#FE760B]" />
                <h3 className="text-xl font-bold text-white">
                  Customize theme
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowThemeModal(false)}
                className="hover:bg-[#212327] text-[#9B9EA4] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-5">
              {/* Logo Upload Section */}
              <div className="bg-[#212327] rounded-xl p-4 border border-[#2A2D31]">
                <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                  <ImageIcon className="h-4 w-4 text-[#FE760B]" />
                  Upload event logo
                </label>
                <p className="text-xs text-[#9B9EA4] mb-3">
                  PNG with transparent background recommended. Max 500KB
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="flex items-center gap-2 px-4 py-2 bg-[#1A1C1F] border border-[#FE760B]/30 text-[#FF9A4D] rounded-xl cursor-pointer hover:bg-[#2A2D31] transition-colors font-medium text-xs"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Choose file
                  </label>
                  {theme.logoPreview && (
                    <div className="flex items-center gap-2">
                      <img
                        src={theme.logoPreview}
                        alt="Preview"
                        className="h-12 max-w-[120px] object-contain rounded-xl border border-[#2A2D31] bg-white/5 p-1"
                      />
                      <Check className="h-4 w-4 text-[#3DD68C]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Color Picker Section */}
              <div className="bg-[#212327] rounded-xl p-4 border border-[#2A2D31]">
                <label className="flex items-center gap-2 text-sm font-medium text-white mb-3">
                  <Palette className="h-4 w-4 text-[#FE760B]" />
                  Brand color
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={theme.color}
                      onChange={(e) =>
                        setTheme({ ...theme, color: e.target.value })
                      }
                      className="w-16 h-16 rounded-xl cursor-pointer border-2 border-[#2A2D31] shadow-lg"
                      style={{ backgroundColor: theme.color }}
                    />
                    <div className="absolute -bottom-1 -right-1 bg-[#FE760B] rounded-full p-1">
                      <Palette className="w-3 h-3 text-[#131517]" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <Input
                      value={theme.color}
                      onChange={(e) =>
                        setTheme({ ...theme, color: e.target.value })
                      }
                      placeholder="#FE760B"
                      maxLength={7}
                      className="bg-[#1A1C1F] border border-[#2A2D31] text-white placeholder-[#9B9EA4] focus:border-[#FE760B] font-mono text-lg rounded-xl"
                    />
                    <p className="text-xs text-[#9B9EA4] mt-1.5">
                      Hex color code for your brand
                    </p>
                  </div>
                </div>
              </div>

              {/* Apply Theme Toggle */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme.applyTheme}
                    onChange={(e) =>
                      setTheme({ ...theme, applyTheme: e.target.checked })
                    }
                    className="w-5 h-5 rounded accent-[#FE760B] cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-white">
                      Apply theme to registration form
                    </span>
                    <span className="text-xs text-[#9B9EA4]">
                      Use your brand color throughout the form
                    </span>
                  </div>
                </label>
              </div>

              {/* Save Button */}
              <Button
                onClick={() => setShowThemeModal(false)}
                className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold rounded-xl shadow-sm py-3 text-base"
              >
                Save theme
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Coupon Management Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#FE760B]" />
                <h3 className="text-xl font-bold text-white">
                  Coupon code management
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCouponModal(false)}
                className="hover:bg-[#212327] text-[#9B9EA4] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Add New Coupon Configuration */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-4">
                <h4 className="text-sm font-semibold text-[#FF9A4D] mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add coupon batch
                </h4>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-[#9B9EA4] mb-2">
                      Number of codes
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="1000"
                      value={newCouponConfig.quantity}
                      onChange={(e) =>
                        setNewCouponConfig({
                          ...newCouponConfig,
                          quantity: e.target.value,
                        })
                      }
                      placeholder="e.g., 50"
                      className="bg-[#1A1C1F] border border-[#2A2D31] text-white placeholder-[#9B9EA4] focus:border-[#FE760B] rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9B9EA4] mb-2">
                      Discount (%)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={newCouponConfig.discountPercent}
                      onChange={(e) =>
                        setNewCouponConfig({
                          ...newCouponConfig,
                          discountPercent: e.target.value,
                        })
                      }
                      placeholder="e.g., 20"
                      className="bg-[#1A1C1F] border border-[#2A2D31] text-white placeholder-[#9B9EA4] focus:border-[#FE760B] rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9B9EA4] mb-2">
                      Valid until
                    </label>
                    <Input
                      type="date"
                      value={newCouponConfig.validityDate}
                      onChange={(e) =>
                        setNewCouponConfig({
                          ...newCouponConfig,
                          validityDate: e.target.value,
                        })
                      }
                      className="bg-[#1A1C1F] border border-[#2A2D31] text-white focus:border-[#FE760B] rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (
                      !newCouponConfig.quantity ||
                      !newCouponConfig.discountPercent ||
                      !newCouponConfig.validityDate
                    ) {
                      toast.error("Please fill all fields");
                      return;
                    }

                    const config = {
                      id: Date.now(),
                      quantity: parseInt(newCouponConfig.quantity),
                      discountPercent: parseInt(
                        newCouponConfig.discountPercent,
                      ),
                      validityDate: newCouponConfig.validityDate,
                      createdAt: new Date().toISOString(),
                    };

                    setCouponConfigs([...couponConfigs, config]);
                    setNewCouponConfig({
                      quantity: "",
                      discountPercent: "",
                      validityDate: "",
                    });
                    toast.success(
                      `Added ${config.quantity} coupons with ${config.discountPercent}% discount`,
                    );
                  }}
                  className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold rounded-xl shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add coupon batch
                </Button>
              </div>

              {/* Existing Coupon Configurations */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <FileDown className="h-4 w-4 text-[#FE760B]" />
                  Configured coupon batches ({couponConfigs.length})
                </h4>

                {couponConfigs.length === 0 ? (
                  <div className="text-center py-8 bg-[#212327] rounded-xl border border-[#2A2D31]">
                    <p className="text-[#9B9EA4] text-sm">
                      No coupon batches configured yet
                    </p>
                    <p className="text-[#5C6066] text-xs mt-1">
                      Add a batch above to generate coupon codes
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {couponConfigs.map((config) => (
                      <div
                        key={config.id}
                        className="bg-[#212327] border border-[#2A2D31] rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-[#FE760B]/15 text-[#FF9A4D] border border-[#FE760B]/30 rounded-full text-xs font-bold">
                                {config.discountPercent}% OFF
                              </span>
                              <span className="text-white font-semibold">
                                {config.quantity} Codes
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-[#9B9EA4]">
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Valid until:{" "}
                                {new Date(
                                  config.validityDate,
                                ).toLocaleDateString()}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Added:{" "}
                                {new Date(config.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCouponConfigs(
                                couponConfigs.filter((c) => c.id !== config.id),
                              );
                              toast.success("Coupon batch removed");
                            }}
                            className="text-[#FF6B6B] hover:text-red-300 hover:bg-[#FF6B6B]/10 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-[#7AA2FF]/10 border border-[#7AA2FF]/30 rounded-xl p-4">
                <p className="text-xs text-[#7AA2FF] flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                  <strong>How it works:</strong> When you save or publish the
                  form, coupon codes will be automatically generated and a PDF
                  containing all codes will download automatically. Organizers
                  can distribute these codes to attendees, who can apply them
                  during registration to get discounts.
                  </span>
                </p>
              </div>

              {/* Generate & Download PDF Button */}
              {couponConfigs.length > 0 && (
                <Button
                  onClick={handleDownloadCouponsPDF}
                  className="w-full bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] font-semibold rounded-xl py-3"
                >
                  <FileDown className="mr-2 h-4 w-4 text-[#FE760B]" />
                  Re-download coupons PDF (
                  {couponConfigs.reduce(
                    (sum, c) => sum + parseInt(c.quantity || 0),
                    0,
                  )}{" "}
                  codes)
                </Button>
              )}

              {/* Save Button */}
              <Button
                onClick={() => setShowCouponModal(false)}
                className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold rounded-xl shadow-sm py-3 text-base"
              >
                Save coupon settings
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Options Modal (for Radio and Dropdown) */}
      {showOptionsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#FE760B]" />
                <h3 className="text-xl font-bold text-white">
                  Customize options
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowOptionsModal(false);
                  setTempOptions([]);
                  setNewOption("");
                }}
                className="hover:bg-[#212327] text-[#9B9EA4] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Add new option */}
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newOption.trim()) {
                      e.preventDefault();
                      setTempOptions([...tempOptions, newOption.trim()]);
                      setNewOption("");
                      toast.success("Option added");
                    }
                  }}
                  placeholder={`Enter option (e.g., ${newField.type === "radio" && newField.name.toLowerCase().includes("gender") ? "Male, Female, Other" : "Option 1"})`}
                  className="flex-1 bg-[#212327] border border-[#2A2D31] text-white placeholder-[#9B9EA4] focus:border-[#FE760B] rounded-xl"
                />
                <Button
                  onClick={() => {
                    if (newOption.trim()) {
                      setTempOptions([...tempOptions, newOption.trim()]);
                      setNewOption("");
                      toast.success("Option added");
                    }
                  }}
                  className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* List of options */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-sm text-[#9B9EA4]">
                  Added options ({tempOptions.length}):
                </p>
                {tempOptions.length === 0 ? (
                  <p className="text-sm text-[#5C6066] text-center py-4">
                    No options added yet
                  </p>
                ) : (
                  tempOptions.map((option, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#212327] border border-[#2A2D31] rounded-xl p-3"
                    >
                      <span className="text-white">{option}</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const updated = [...tempOptions];
                            const removed = updated.splice(idx, 1);
                            setTempOptions(updated);
                            toast.success(`"${removed[0]}" removed`);
                          }}
                          className="text-[#FF6B6B] hover:text-red-300 hover:bg-[#FF6B6B]/10 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Save button */}
              <Button
                onClick={() => {
                  if (tempOptions.length === 0) {
                    toast.error("Please add at least one option");
                    return;
                  }
                  setNewField({ ...newField, options: tempOptions });
                  setShowOptionsModal(false);
                  setTempOptions([]);
                  setNewOption("");
                  toast.success("Options saved");
                }}
                disabled={tempOptions.length === 0}
                className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold rounded-xl shadow-sm disabled:opacity-50 py-3"
              >
                Save options
              </Button>
            </div>
          </div>
        </div>
      )}{" "}
      {/* Sharable Form Link Modal */}
      {showShareModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200 touch-none overscroll-contain"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-[#1A1C1F] text-white rounded-3xl border border-[#2A2D31] shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 relative overflow-hidden my-auto overscroll-contain touch-pan-y"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient background glow */}
            <div className="absolute -top-20 -right-20 w-44 h-44 bg-[#FE760B]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3DD68C]/15 border border-[#3DD68C]/30 text-[#3DD68C] text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
                  Form published & live
                </div>
                <h3
                  id="share-modal-title"
                  className="text-xl sm:text-2xl font-bold text-white tracking-tight"
                >
                  Share registration form
                </h3>
                <p className="text-xs sm:text-sm text-[#9B9EA4]">
                  {selectedEvent?.name
                    ? `"${selectedEvent.name}"`
                    : "Your event"}{" "}
                  is ready for attendee registrations!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-[#9B9EA4] hover:text-white p-2 rounded-xl hover:bg-[#212327] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation tabs */}
            <div className="flex p-1 bg-[#212327] rounded-xl border border-[#2A2D31] text-xs font-semibold gap-1 relative z-10">
              <button
                type="button"
                onClick={() => setShareTab("direct")}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  shareTab === "direct"
                    ? "bg-[#FE760B] text-[#131517] shadow-sm font-semibold"
                    : "text-[#9B9EA4] hover:text-white hover:bg-[#1A1C1F]"
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Form link</span>
              </button>

              {selectedEvent?.slug && (
                <button
                  type="button"
                  onClick={() => setShareTab("event")}
                  className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    shareTab === "event"
                      ? "bg-[#FE760B] text-[#131517] shadow-sm font-semibold"
                      : "text-[#9B9EA4] hover:text-white hover:bg-[#1A1C1F]"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Event page</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShareTab("qr")}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  shareTab === "qr"
                    ? "bg-[#FE760B] text-[#131517] shadow-sm font-semibold"
                    : "text-[#9B9EA4] hover:text-white hover:bg-[#1A1C1F]"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR code</span>
              </button>

              <button
                type="button"
                onClick={() => setShareTab("embed")}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  shareTab === "embed"
                    ? "bg-[#FE760B] text-[#131517] shadow-sm font-semibold"
                    : "text-[#9B9EA4] hover:text-white hover:bg-[#1A1C1F]"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Embed</span>
              </button>
            </div>

            {/* Tab 1: Direct Form Link */}
            {shareTab === "direct" && (
              <div className="space-y-4 relative z-10">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider">
                    Sharable form link (direct registration)
                  </label>
                  <div className="flex items-center gap-2 p-2.5 bg-[#212327] rounded-xl border border-[#2A2D31] focus-within:border-[#FE760B] transition-colors">
                    <Link2 className="w-4 h-4 text-[#FE760B] flex-shrink-0 ml-1.5" />
                    <input
                      type="text"
                      readOnly
                      value={directFormUrl}
                      className="bg-transparent text-xs font-mono text-white flex-1 outline-none px-1 select-all"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCopy(directFormUrl, "direct")}
                      className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] text-xs font-semibold h-8 px-3 rounded-lg shrink-0"
                    >
                      {copiedType === "direct" ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-[#131517]" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                    <a
                      href={directFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[#9B9EA4] hover:text-white rounded-lg hover:bg-[#1A1C1F] transition-colors shrink-0"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-[11px] text-[#9B9EA4]">
                    Participants can fill out and submit your custom registration form directly through this link.
                  </p>
                </div>

                {/* Social Quick Share Actions */}
                <div className="pt-2 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleWhatsAppShare(directFormUrl, selectedEvent?.name)
                    }
                    className="flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#3DD68C] hover:bg-[#34be7c] text-[#131517] font-semibold text-xs transition-colors shadow-sm"
                  >
                    <svg
                      className="w-4 h-4 fill-current shrink-0"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.045-1.178-.094-.619-.177-1.464-.613-2.502-1.652-1.04-1.04-1.478-1.884-1.656-2.503-.139-.484-.139-.866-.094-1.178.05-.333.419-1.026.824-1.17.135-.048.28-.063.396-.063.13 0 .235.013.313.027.104.019.243.082.35.337.13.312.443 1.077.482 1.156.039.078.065.17.013.273-.052.104-.078.17-.156.26-.078.091-.165.203-.235.273-.078.078-.16.163-.069.319.091.156.403.665.864 1.076.593.528 1.093.691 1.249.769.156.078.247.069.339-.035.091-.104.391-.456.495-.612.104-.156.208-.13.347-.078.139.052.882.416 1.034.495.152.078.252.117.291.182.039.065.039.378-.105.783z" />
                    </svg>
                    <span>Share on WhatsApp</span>
                  </button>

                  {typeof navigator !== "undefined" && navigator.share && (
                    <button
                      type="button"
                      onClick={() =>
                        handleNativeShare(directFormUrl, selectedEvent?.name)
                      }
                      className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white font-semibold text-xs transition-colors border border-[#2A2D31]"
                    >
                      <Share2 className="w-4 h-4 text-[#FE760B]" />
                      <span>Share...</span>
                    </button>
                  )}

                  <a
                    href={directFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white font-semibold text-xs transition-colors border border-[#2A2D31]"
                  >
                    <ExternalLink className="w-4 h-4 text-[#7AA2FF]" />
                    <span>Open form</span>
                  </a>
                </div>
              </div>
            )}

            {/* Tab 2: Event Page Link */}
            {shareTab === "event" && (
              <div className="space-y-4 relative z-10">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider">
                    Public event showcase page
                  </label>
                  <div className="flex items-center gap-2 p-2.5 bg-[#212327] rounded-xl border border-[#2A2D31] focus-within:border-[#FE760B] transition-colors">
                    <Globe className="w-4 h-4 text-[#7AA2FF] flex-shrink-0 ml-1.5" />
                    <input
                      type="text"
                      readOnly
                      value={eventPageUrl}
                      className="bg-transparent text-xs font-mono text-white flex-1 outline-none px-1 select-all"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCopy(eventPageUrl, "event")}
                      className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] text-xs font-semibold h-8 px-3 rounded-lg shrink-0"
                    >
                      {copiedType === "event" ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-[#131517]" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                    <a
                      href={eventPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[#9B9EA4] hover:text-white rounded-lg hover:bg-[#1A1C1F] transition-colors shrink-0"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-[11px] text-[#9B9EA4]">
                    Full festival landing page containing poster artwork, track details, venue directions, and checkout drawer.
                  </p>
                </div>

                <div className="pt-2 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleWhatsAppShare(eventPageUrl, selectedEvent?.name)
                    }
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#3DD68C] hover:bg-[#34be7c] text-[#131517] font-semibold text-xs transition-colors shadow-sm"
                  >
                    <span>Share event page on WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: QR Code */}
            {shareTab === "qr" && (
              <div className="space-y-4 text-center relative z-10">
                <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-xl">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="Registration Form QR Code"
                      className="w-48 h-48 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-[#9B9EA4] text-xs">
                      <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-[#9B9EA4] max-w-sm mx-auto">
                  Attendees can scan this QR code directly using their smartphone camera to open the form.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDownloadQR}
                    disabled={!qrCodeUrl}
                    className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] text-xs font-semibold rounded-xl shadow-sm"
                  >
                    <FileDown className="w-3.5 h-3.5 mr-1.5" />
                    Download high-res QR (.PNG)
                  </Button>
                </div>
              </div>
            )}

            {/* Tab 4: Embed Widget */}
            {shareTab === "embed" && (
              <div className="space-y-4 relative z-10">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider">
                    Website embed snippet
                  </label>
                  <div className="relative">
                    <pre className="p-3 bg-[#212327] rounded-xl border border-[#2A2D31] text-[#9B9EA4] font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
                      {embedCodeSnippet}
                    </pre>
                  </div>
                  <p className="text-[11px] text-[#9B9EA4]">
                    Embed this responsive form directly into your college website, WordPress, Webflow, or Notion page.
                  </p>
                </div>
                <div className="pt-2 flex gap-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCopy(embedCodeSnippet, "embed")}
                    className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] text-xs font-semibold rounded-xl shadow-sm"
                  >
                    {copiedType === "embed" ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5 text-[#131517]" />
                        Copied snippet!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy embed code
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-[#2A2D31] flex items-center justify-between text-xs text-[#9B9EA4] relative z-10">
              <span className="flex items-center gap-1.5 text-[#9B9EA4]">
                <Sparkles className="w-3.5 h-3.5 text-[#FE760B]" />
                Registrations are immediately live
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowShareModal(false)}
                className="border-[#2A2D31] text-[#9B9EA4] hover:text-white hover:bg-[#212327] text-xs rounded-xl"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
