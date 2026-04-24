"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Send,
  Image as ImageIcon,
  Palette,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getAllEvents, getEventsByOrganiser } from "@/lib/firestore";
import {
  createCustomForm,
  updateCustomForm,
  getCustomFormByEvent,
  publishForm,
} from "@/lib/form-generator";
import { useAuth } from "@/context/auth-context";

export function FormGenerator() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingFormId, setExistingFormId] = useState(null);

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
    color: "#10b981",
    applyTheme: true,
  });

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user]);

  useEffect(() => {
    if (selectedEventId) {
      loadExistingForm();
    }
  }, [selectedEventId]);

  const loadEvents = async () => {
    try {
      let allEvents;

      // SuperAdmin sees all events
      if (user?.role === "superAdmin") {
        allEvents = await getAllEvents();
      } else if (user?.role === "organiser") {
        // Organisers only see their own event
        allEvents = await getEventsByOrganiser(user.id);

        // Auto-select only if organiser has exactly one event
        if (allEvents.length === 1) {
          setSelectedEventId(allEvents[0].id);
        }
      } else {
        allEvents = [];
      }

      setEvents(allEvents);
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
      if (existingForm) {
        setExistingFormId(existingForm.id);
        setFields(existingForm.fields || []);
        setIsPaid(existingForm.isPaid || false);
        // Ensure amount is always a valid number
        const loadedAmount = existingForm.amount;
        setAmount(
          !loadedAmount || isNaN(loadedAmount) ? 0 : Number(loadedAmount),
        );
        setPaymentCredentials(
          existingForm.paymentCredentials || {
            razorpayKeyId: "",
            razorpayKeySecret: "",
          },
        );
        setEnableCoupons(existingForm.enableCoupons || false);
        setCouponConfigs(existingForm.couponConfigs || []);
        // Load theme with logo URL (not File object)
        const loadedTheme = existingForm.theme || {
          logo: null,
          logoPreview: null,
          color: "#10b981",
          applyTheme: true,
        };
        // If logo exists as URL, use it for both logo and logoPreview
        if (loadedTheme.logo && typeof loadedTheme.logo === "string") {
          loadedTheme.logoPreview = loadedTheme.logo;
        }
        setTheme(loadedTheme);
        setCustomizeTheme(!!existingForm.theme?.applyTheme);
      }
    } catch (error) {
      console.error("Failed to load form:", error);
    }
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
      console.log("📤 Uploading logo to Cloudinary...");

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
      console.log("✅ Logo uploaded to Cloudinary:", data.url);

      return data.url;
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw new Error(error.message || "Failed to upload logo");
    }
  };

  const saveDraft = async () => {
    if (!selectedEventId) {
      toast.error("Please select an event");
      return;
    }

    if (fields.length === 0) {
      toast.error("Please add at least one field");
      return;
    }

    setIsSaving(true);
    try {
      // Upload logo if it's a File object
      let themeData = customizeTheme ? { ...theme } : null;
      if (themeData && themeData.logo && typeof themeData.logo !== "string") {
        console.log("📤 Uploading logo...");
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
        fields,
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
        toast.success("Draft saved successfully");
      } else {
        const result = await createCustomForm(selectedEventId, formData);
        setExistingFormId(result.id);
        toast.success("Draft created successfully");
      }

      // Automatically generate and download coupons PDF if coupons are enabled
      if (enableCoupons && couponConfigs.length > 0) {
        console.log("🎟️ Coupons enabled - Auto-generating PDF");
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

    if (fields.length === 0) {
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
        console.log("📤 Uploading logo...");
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
        fields,
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
        await publishForm(result.id);
      }

      toast.success("Form published successfully!");

      // Automatically generate and download coupons PDF if coupons are enabled
      if (enableCoupons && couponConfigs.length > 0) {
        console.log("🎟️ Coupons enabled - Auto-generating PDF");
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
      console.error("❌ Error downloading PDF:", error);
      toast.error(error.message || "Failed to download PDF");
    }
  };

  const renderFieldPreview = (field) => {
    const baseClasses =
      "w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00] bg-white text-slate-900";

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
                  className="w-4 h-4"
                />
                <span className="text-white text-sm">{opt}</span>
              </label>
            ))}
          </div>
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2">
            <input type="checkbox" disabled />
            <span className="text-slate-900">{field.name}</span>
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6A00]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Event Selection */}
      <div className="bg-slate-900/60 dark:bg-slate-900/60 rounded-lg shadow border border-[#FF6A00]/10 p-6">
        <h3 className="text-lg font-semibold text-slate-100 dark:text-slate-100 mb-4">
          {user?.role === "organiser"
            ? events.length > 1
              ? "Select Event"
              : "Your Event"
            : "Select Event"}
        </h3>

        {user?.role === "organiser" && events.length === 1 ? (
          /* Show event name for organisers with single event (not editable) */
          <div className="w-full p-3 bg-black/50 border border-[#FF6A00]/30 rounded-lg text-white">
            {events.length > 0 ? (
              <span className="font-medium">{events[0].name}</span>
            ) : (
              <span className="text-gray-400">
                No event created yet. Please create an event first.
              </span>
            )}
          </div>
        ) : (
          /* Show dropdown for superadmin or organisers with multiple events */
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full p-3 bg-black/50 border border-[#FF6A00]/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-[#FF6A00] transition-colors"
          >
            <option value="" className="bg-slate-900 text-gray-400">
              Choose an event
            </option>
            {events.map((event) => (
              <option
                key={event.id}
                value={event.id}
                className="bg-slate-900 text-white"
              >
                {event.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {selectedEventId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side - Form Builder */}
          <div className="space-y-6">
            <div className="bg-slate-900/60 dark:bg-slate-900/60 rounded-lg shadow border border-[#FF6A00]/10 p-6">
              <h3 className="text-lg font-semibold text-slate-100 dark:text-slate-100 mb-4">
                Form Builder
              </h3>

              {/* Add Field */}
              <div className="space-y-4 mb-6">
                <Input
                  placeholder="Field Name (e.g., College Name)"
                  value={newField.name}
                  onChange={(e) =>
                    setNewField({ ...newField, name: e.target.value })
                  }
                />

                <select
                  value={newField.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    // Reset options when changing type
                    setNewField({ ...newField, type: newType, options: [] });
                  }}
                  className="w-full p-3 bg-black/50 border border-[#FF6A00]/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-[#FF6A00] transition-colors"
                >
                  <option value="text" className="bg-slate-900 text-white">
                    Text Box
                  </option>
                  <option value="email" className="bg-slate-900 text-white">
                    Email
                  </option>
                  <option value="textarea" className="bg-slate-900 text-white">
                    Text Area
                  </option>
                  <option value="dropdown" className="bg-slate-900 text-white">
                    Dropdown
                  </option>
                  <option value="radio" className="bg-slate-900 text-white">
                    Radio Buttons
                  </option>
                  <option value="checkbox" className="bg-slate-900 text-white">
                    Checkbox
                  </option>
                </select>

                {/* Show options button for radio and dropdown */}
                {(newField.type === "radio" ||
                  newField.type === "dropdown") && (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setTempOptions(newField.options || []);
                        setNewOption("");
                        setShowOptionsModal(true);
                      }}
                      className="w-full bg-[#FF6A00]/20 hover:bg-[#FF6A00]/30 border border-[#FF6A00]/40 text-[#FF6A00]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {newField.options?.length > 0
                        ? `Edit Options (${newField.options.length})`
                        : `Add Options (Required)`}
                    </Button>
                    {newField.options?.length > 0 && (
                      <div className="text-xs text-[#FF6A00] space-y-1">
                        {newField.options.map((opt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 bg-black/30 rounded px-2 py-1"
                          >
                            <span className="text-[#FF6A00]">•</span> {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newField.required}
                    onChange={(e) =>
                      setNewField({ ...newField, required: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 dark:text-slate-300">
                    Required Field
                  </span>
                </label>

                <Button
                  onClick={addField}
                  className="w-full bg-[#FF6A00] hover:bg-[#E65C00] text-white font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Field
                </Button>
              </div>

              {/* Field List */}
              <div className="space-y-2">
                <h4 className="font-medium text-slate-100 dark:text-slate-100">
                  Added Fields
                </h4>
                {fields.length === 0 ? (
                  <p className="text-slate-500 text-sm">No fields added yet</p>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between p-3 bg-slate-800/50 dark:bg-slate-800/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-slate-100 dark:text-slate-100">
                            {field.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {field.type} {field.required && "• Required"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeField(field.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="bg-slate-900/60 dark:bg-slate-900/60 rounded-lg shadow border border-[#FF6A00]/10 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-100 dark:text-slate-100">
                Options
              </h3>

              {/* Paid Event */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-300 dark:text-slate-300">
                  Paid Event
                </span>
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => handlePaidCheckbox(e.target.checked)}
                  className="w-5 h-5"
                />
              </label>

              {/* Enable Coupons */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-300 dark:text-slate-300">
                  Enable Coupons
                </span>
                <input
                  type="checkbox"
                  checked={enableCoupons}
                  onChange={(e) => handleCouponCheckbox(e.target.checked)}
                  className="w-5 h-5"
                />
              </label>

              {/* Customize Theme */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-300 dark:text-slate-300">
                  Customize Theme
                </span>
                <input
                  type="checkbox"
                  checked={customizeTheme}
                  onChange={(e) => handleThemeCheckbox(e.target.checked)}
                  className="w-5 h-5"
                />
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={saveDraft}
                disabled={isSaving}
                variant="outline"
                className="flex-1 text-white border-[#FF6A00]/30 hover:bg-[#FF6A00]/10 hover:text-white"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save as Draft
              </Button>
              <Button
                onClick={handlePublish}
                disabled={isSaving}
                className="flex-1 bg-[#FF6A00] hover:bg-[#E65C00] text-white font-bold"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Publish
              </Button>
            </div>
          </div>

          {/* Right Side - Live Preview */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div
              className="bg-slate-900/60 rounded-lg shadow border border-[#FF6A00]/10 p-6"
              style={{
                backgroundColor:
                  customizeTheme && theme.applyTheme
                    ? `${theme.color}10`
                    : "rgb(15 23 42 / 0.6)",
              }}
            >
              <h3 className="text-lg font-semibold text-slate-100 mb-4">
                Live Preview
              </h3>

              {/* Theme Preview */}
              {customizeTheme && theme.logoPreview && (
                <div className="mb-6 text-center">
                  <img
                    src={theme.logoPreview}
                    alt="Logo"
                    className="h-16 mx-auto object-contain"
                  />
                </div>
              )}

              {/* Form Preview */}
              <div className="space-y-4">
                {fields.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    Add fields to see preview
                  </p>
                ) : (
                  fields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300 dark:text-slate-300">
                        {field.name}
                        {field.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      {renderFieldPreview(field)}
                    </div>
                  ))
                )}

                {/* Amount Display */}
                {isPaid && amount && parseFloat(amount) > 0 && (
                  <div className="p-4 bg-[#FF6A00]/10 rounded-lg border border-[#FF6A00]/30">
                    <p className="text-sm font-medium text-[#FF6A00]">
                      Amount: ₹{amount}
                    </p>
                  </div>
                )}

                {/* Coupon Field */}
                {enableCoupons && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300 dark:text-slate-300">
                      Coupon Code (Optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter coupon code"
                        className="flex-1 p-3 border border-slate-300 rounded-lg"
                        disabled
                      />
                      <Button
                        disabled
                        className="bg-[#FF6A00] text-white font-bold"
                        style={{
                          backgroundColor:
                            customizeTheme && theme.applyTheme
                              ? theme.color
                              : "#10b981",
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                )}

                {/* Submit Button Preview */}
                {fields.length > 0 && (
                  <Button
                    disabled
                    className="w-full bg-[#FF6A00] text-white font-bold"
                    style={{
                      backgroundColor:
                        customizeTheme && theme.applyTheme
                          ? theme.color
                          : "#10b981",
                    }}
                  >
                    Register
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-#FF6A00]/20 rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#FF6A00]" />
                <h3 className="text-xl font-bold text-white">
                  Payment Integration
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPaymentModal(false)}
                className="hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-400" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="bg-black/30 border-#FF6A00]/20 text-white placeholder-gray-500 focus:border-#FF6A00]/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="bg-black/30 border-#FF6A00]/20 text-white placeholder-gray-500 focus:border-#FF6A00]/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ticket Amount (₹)
                </label>
                <Input
                  type="number"
                  value={amount || ""}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  min="0"
                  step="1"
                  className="bg-black/30 border-#FF6A00]/20 text-white placeholder-gray-500 focus:border-#FF6A00]/50"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Enter the amount to charge for each ticket registration
                </p>
              </div>

              <Button
                onClick={() => setShowPaymentModal(false)}
                className="w-full bg-[#FF6A00] hover:bg-[#E65C00] text-white font-bold shadow-lg shadow-[#FF6A00]/20"
              >
                Save Payment Settings
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Theme Customization Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-#FF6A00]/20 rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#FF6A00]" />
                <h3 className="text-xl font-bold text-white">
                  Customize Theme
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowThemeModal(false)}
                className="hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-400" />
              </Button>
            </div>

            <div className="space-y-5">
              {/* Logo Upload Section */}
              <div className="bg-black/30 rounded-xl p-4 border border-#FF6A00]/10">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  🖼️ Upload Event Logo
                </label>
                <p className="text-xs text-gray-400 mb-3">
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
                    className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00]/20 border border-[#FF6A00]/30 text-[#FF6A00] rounded-lg cursor-pointer hover:bg-[#FF6A00]/30 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Choose File
                  </label>
                  {theme.logoPreview && (
                    <div className="flex items-center gap-2">
                      <img
                        src={theme.logoPreview}
                        alt="Preview"
                        className="h-12 max-w-[120px] object-contain rounded border border-[#FF6A00]/20 bg-white/5 p-1"
                      />
                      <span className="text-xs text-[#FF6A00]">✓</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Color Picker Section */}
              <div className="bg-black/30 rounded-xl p-4 border border-#FF6A00]/10">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  🎨 Brand Color
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={theme.color}
                      onChange={(e) =>
                        setTheme({ ...theme, color: e.target.value })
                      }
                      className="w-16 h-16 rounded-lg cursor-pointer border-2 border-#FF6A00]/30 shadow-lg"
                      style={{ backgroundColor: theme.color }}
                    />
                    <div className="absolute -bottom-1 -right-1 bg-[#FF6A00] rounded-full p-1">
                      <Palette className="w-3 h-3 text-black" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <Input
                      value={theme.color}
                      onChange={(e) =>
                        setTheme({ ...theme, color: e.target.value })
                      }
                      placeholder="#10b981"
                      maxLength={7}
                      className="bg-black/50 border-#FF6A00]/20 text-white placeholder-gray-500 focus:border-#FF6A00]/50 font-mono text-lg"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      Hex color code for your brand
                    </p>
                  </div>
                </div>
              </div>

              {/* Apply Theme Toggle */}
              <div className="bg-#FF6A00]/10 border border-#FF6A00]/20 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme.applyTheme}
                    onChange={(e) =>
                      setTheme({ ...theme, applyTheme: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-#FF6A00]/30 bg-black/30 checked:bg-[#FF6A00] cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-white">
                      Apply theme to registration form
                    </span>
                    <span className="text-xs text-gray-400">
                      Use your brand color throughout the form
                    </span>
                  </div>
                </label>
              </div>

              {/* Save Button */}
              <Button
                onClick={() => setShowThemeModal(false)}
                className="w-full bg-[#FF6A00] hover:bg-[#E65C00] text-white font-semibold shadow-lg shadow-#FF6A00]/20 py-6 text-base"
              >
                Save Theme
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Coupon Management Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-#FF6A00]/20 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#FF6A00]" />
                <h3 className="text-xl font-bold text-white">
                  Coupon Code Management
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCouponModal(false)}
                className="hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-400" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Add New Coupon Configuration */}
              <div className="bg-#FF6A00]/10 border border-#FF6A00]/30 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-[#FF6A00] mb-4">
                  ➕ Add Coupon Batch
                </h4>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">
                      Number of Codes
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
                      className="bg-black/30 border-#FF6A00]/20 text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">
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
                      className="bg-black/30 border-#FF6A00]/20 text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">
                      Valid Until
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
                      className="bg-black/30 border-#FF6A00]/20 text-white"
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
                  className="w-full bg-[#FF6A00] hover:bg-[#E65C00] text-white font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Coupon Batch
                </Button>
              </div>

              {/* Existing Coupon Configurations */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  📋 Configured Coupon Batches ({couponConfigs.length})
                </h4>

                {couponConfigs.length === 0 ? (
                  <div className="text-center py-8 bg-black/20 rounded-xl border border-#FF6A00]/10">
                    <p className="text-gray-400 text-sm">
                      No coupon batches configured yet
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Add a batch above to generate coupon codes
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {couponConfigs.map((config) => (
                      <div
                        key={config.id}
                        className="bg-black/30 border border-purple-500/20 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-bold">
                                {config.discountPercent}% OFF
                              </span>
                              <span className="text-white font-semibold">
                                {config.quantity} Codes
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span>
                                📅 Valid until:{" "}
                                {new Date(
                                  config.validityDate,
                                ).toLocaleDateString()}
                              </span>
                              <span>
                                🕒 Added:{" "}
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
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-xs text-blue-400">
                  💡 <strong>How it works:</strong> When you save or publish the
                  form, coupon codes will be automatically generated and a PDF
                  containing all codes will download automatically. Organizers
                  can distribute these codes to attendees, who can apply them
                  during registration to get discounts.
                </p>
              </div>

              {/* Generate & Download PDF Button */}
              {couponConfigs.length > 0 && (
                <Button
                  onClick={handleDownloadCouponsPDF}
                  className="w-full bg-purple-500 hover:bg-purple-400 text-white font-semibold py-6"
                >
                  📄 Re-Download Coupons PDF (
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
                className="w-full bg-[#FF6A00] hover:bg-[#E65C00] text-white font-semibold py-6"
              >
                Save Coupon Settings
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Options Modal (for Radio and Dropdown) */}
      {showOptionsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-#FF6A00]/20 rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#FF6A00]" />
                <h3 className="text-xl font-bold text-white">
                  Customize Options
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
                className="hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-400" />
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
                  className="flex-1 bg-black/30 border-#FF6A00]/20 text-white placeholder-gray-500 focus:border-#FF6A00]/50"
                />
                <Button
                  onClick={() => {
                    if (newOption.trim()) {
                      setTempOptions([...tempOptions, newOption.trim()]);
                      setNewOption("");
                      toast.success("Option added");
                    }
                  }}
                  className="bg-[#FF6A00] hover:bg-[#E65C00] text-black"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* List of options */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-sm text-gray-400">
                  Added options ({tempOptions.length}):
                </p>
                {tempOptions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No options added yet
                  </p>
                ) : (
                  tempOptions.map((option, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-black/30 border border-#FF6A00]/10 rounded-lg p-3"
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
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
                className="w-full bg-[#FF6A00] hover:bg-[#E65C00] text-white font-semibold disabled:bg-gray-600 disabled:text-gray-400"
              >
                Save Options
              </Button>
            </div>
          </div>
        </div>
      )}{" "}
    </div>
  );
}
