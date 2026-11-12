"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Info,
  RefreshCw,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { UPI_HANDLES, BANK_NAMES } from "@/lib/payments/payout-constants";

export function OrganizerPayoutDetailsForm({ organizerId = null, onSaved = null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Form State
  const [payoutMethod, setPayoutMethod] = useState("upi"); // "upi" | "bank"
  const [username, setUsername] = useState("");
  const [selectedHandle, setSelectedHandle] = useState("@ybl");
  const [customHandle, setCustomHandle] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [customBank, setCustomBank] = useState("");
  const [phone, setPhone] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [email, setEmail] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");

  // Validation Error State
  const [usernameError, setUsernameError] = useState("");
  const [customHandleError, setCustomHandleError] = useState("");
  const [bankError, setBankError] = useState("");
  const [accountNumberError, setAccountNumberError] = useState("");
  const [ifscError, setIfscError] = useState("");

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const url = `/api/organizer/payout-profile${organizerId ? `?organizerId=${organizerId}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          populateForm(data.profile);
          setIsEditing(false);
        } else {
          setIsEditing(true);
        }
      }
    } catch (err) {
      console.error("Failed to load payout profile:", err);
      toast.error("Could not load payout details. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (p) => {
    setUsername(p.upiUsername || (p.upiId ? p.upiId.split("@")[0] : ""));
    const handle = p.upiHandle || (p.upiId ? `@${p.upiId.split("@")[1]}` : "@ybl");
    if (UPI_HANDLES.includes(handle)) {
      setSelectedHandle(handle);
    } else {
      setSelectedHandle("Other");
      setCustomHandle(p.upiId || "");
    }

    if (BANK_NAMES.includes(p.bankName)) {
      setSelectedBank(p.bankName);
    } else if (p.bankName) {
      setSelectedBank("Other");
      setCustomBank(p.bankName);
    }
    setPhone(p.phone || "");
    setOrganizerName(p.organizerName || "");
    setEmail(p.email || "");
    setAccountHolderName(p.accountHolderName || p.organizerName || "");
    setAccountNumber(p.accountNumber || "");
    setIfsc(p.ifsc || "");
    if (p.payoutMethod === "BANK_TRANSFER" || (p.accountNumber && !p.upiId)) {
      setPayoutMethod("bank");
    } else {
      setPayoutMethod("upi");
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [organizerId]);

  // Real-time username validation
  const handleUsernameChange = (val) => {
    const clean = val.replace(/\s+/g, "").trim();
    setUsername(clean);

    if (!clean) {
      setUsernameError("UPI Username cannot be empty.");
    } else if (/[^a-zA-Z0-9.\-_]/.test(clean)) {
      setUsernameError("Only letters, numbers, dots, hyphens, and underscores are allowed.");
    } else if (clean.includes("@")) {
      setUsernameError("Do not include '@' in username. Please select the handle from dropdown.");
    } else if (clean.length < 2) {
      setUsernameError("Username must be at least 2 characters.");
    } else {
      setUsernameError("");
    }
  };

  // Real-time custom UPI validation
  const handleCustomHandleChange = (val) => {
    const clean = val.trim();
    setCustomHandle(clean);

    if (!clean) {
      setCustomHandleError("Please enter your complete UPI ID.");
    } else if (/^\d{10}$/.test(clean) || /^\+?91\d{10}$/.test(clean)) {
      setCustomHandleError("A 10-digit phone number alone is not a complete UPI ID. It must include a handle (e.g. 9876543210@paytm).");
    } else if (!clean.includes("@")) {
      setCustomHandleError("UPI ID must include an '@' followed by the provider handle (e.g. name@bank).");
    } else if (!/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9.\-_]{2,64}$/.test(clean)) {
      setCustomHandleError("Invalid UPI format. Expected: username@handle");
    } else {
      setCustomHandleError("");
    }
  };

  const handleBankChange = (val) => {
    setSelectedBank(val);
    setBankError("");
  };

  // Compute live UPI preview
  const previewUpiId =
    selectedHandle === "Other"
      ? customHandle.trim().toLowerCase()
      : username.trim()
      ? `${username.trim().toLowerCase()}${selectedHandle}`
      : "";

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset errors
    setAccountNumberError("");
    setIfscError("");
    setUsernameError("");
    setCustomHandleError("");
    setBankError("");

    if (payoutMethod === "upi") {
      if (selectedHandle !== "Other") {
        if (!username.trim()) {
          setUsernameError("UPI Username is required.");
          return;
        }
        if (usernameError) return;
      } else {
        if (!customHandle.trim()) {
          setCustomHandleError("Complete UPI ID is required.");
          return;
        }
        if (customHandleError) return;
      }
    } else {
      if (!accountNumber.trim()) {
        setAccountNumberError("Bank Account Number is required.");
        return;
      }
      if (!/^\d{8,18}$/.test(accountNumber.trim())) {
        setAccountNumberError("Account number must be 8 to 18 digits.");
        return;
      }
      if (!ifsc.trim()) {
        setIfscError("IFSC Code is required.");
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) {
        setIfscError("Invalid IFSC code format (e.g. HDFC0001234).");
        return;
      }
    }

    if (!selectedBank) {
      setBankError("Please select your bank.");
      return;
    }
    if (selectedBank === "Other" && !customBank.trim()) {
      setBankError("Please enter your bank name.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        organizerId,
        username: username.trim(),
        handle: selectedHandle,
        customHandle: customHandle.trim(),
        fullUpiId: selectedHandle === "Other" ? customHandle.trim() : (username.trim() ? `${username.trim()}${selectedHandle}` : null),
        bankName: selectedBank,
        customBankName: selectedBank === "Other" ? customBank.trim() : null,
        phone: phone.trim(),
        organizerName: (accountHolderName || organizerName).trim(),
        accountHolderName: (accountHolderName || organizerName).trim(),
        accountNumber: accountNumber.trim() || null,
        ifsc: ifsc.trim().toUpperCase() || null,
        email: email.trim(),
      };

      const res = await fetch("/api/organizer/payout-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save payout profile.");
      }

      setProfile(data.profile);
      setIsEditing(false);
      toast.success("Payout details saved successfully!");
      if (typeof onSaved === "function") onSaved(data.profile);
    } catch (err) {
      console.error("Payout profile save error:", err);
      toast.error(err.message || "Failed to save payout profile.");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUpi(true);
    toast.success("UPI ID copied to clipboard!");
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-8 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] text-center text-[#9E9E9F] text-xs flex items-center justify-center gap-2">
        <RefreshCw size={16} className="animate-spin text-[#FE760B]" />
        <span>Loading payout information...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Saved Payout Profile Card ── */}
      {profile && !isEditing ? (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1A1C1F] via-[#212327] to-[#1A1C1F] border border-[#2A2D31] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FE760B]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2D31] pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Active Payout Profile</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                    Eligible for UPI Payouts
                  </span>
                </div>
                <p className="text-xs text-[#9E9E9F] mt-0.5">
                  Disbursements are processed on T+4 working days to this verified address.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Edit3 size={14} className="text-[#FE760B]" />
              <span>Update Details</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-5 text-xs">
            {/* UPI ID Pill */}
            {profile.upiId ? (
              <div className="p-4 rounded-xl bg-[#131517] border border-[#2A2D31]/80 space-y-1">
                <span className="text-[11px] text-[#9E9E9F] font-medium block">UPI ID (Payee)</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-white text-sm truncate">{profile.upiId}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(profile.upiId)}
                    className="p-1 rounded-md hover:bg-[#212327] text-[#9E9E9F] hover:text-[#FE760B] transition-colors"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Bank Account Number & IFSC */}
            {profile.accountNumberMasked ? (
              <div className="p-4 rounded-xl bg-[#131517] border border-[#2A2D31]/80 space-y-1">
                <span className="text-[11px] text-[#9E9E9F] font-medium block">Bank Account & IFSC</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-white text-sm truncate">{profile.accountNumberMasked}</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">{profile.ifsc}</span>
                </div>
              </div>
            ) : null}

            {/* Bank Name */}
            <div className="p-4 rounded-xl bg-[#131517] border border-[#2A2D31]/80 space-y-1">
              <span className="text-[11px] text-[#9E9E9F] font-medium block">Destination Bank</span>
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-[#FE760B] shrink-0" />
                <span className="font-semibold text-white truncate">{profile.bankName}</span>
              </div>
            </div>

            {/* Payee Info */}
            <div className="p-4 rounded-xl bg-[#131517] border border-[#2A2D31]/80 space-y-1">
              <span className="text-[11px] text-[#9E9E9F] font-medium block">Account Holder</span>
              <span className="font-semibold text-white block truncate">{profile.accountHolderName || profile.organizerName || "Organizer"}</span>
              <span className="text-[10px] text-[#9E9E9F] block truncate">{profile.email}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#2A2D31]/50 flex items-center justify-between text-[11px] text-[#9E9E9F]">
            <span>
              Last updated:{" "}
              <strong className="text-white">
                {profile.lastUpdatedDate ? new Date(profile.lastUpdatedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recently"}
              </strong>
            </span>
            <span className="text-[#FE760B] text-[10px] font-medium flex items-center gap-1">
              <Info size={12} /> Changes are logged in audit ledger & notified to Super Admin
            </span>
          </div>
        </div>
      ) : null}

      {/* ── Form Card (Create / Edit) ── */}
      {isEditing || !profile ? (
        <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-xl space-y-6">
          <div className="border-b border-[#2A2D31] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="text-[#FE760B]" size={18} />
                <span>{profile ? "Update Organizer Payout Details" : "Set Up Organizer Payout Details"}</span>
              </h3>
              <p className="text-xs text-[#9E9E9F] mt-1">
                Required for settlements. Please ensure your UPI ID and Bank Name match your organization’s receiving bank account.
              </p>
            </div>
            {profile && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-[#9E9E9F] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="space-y-5">
            {/* Payout Method Toggle Tabs */}
            <div className="flex items-center gap-2 border-b border-[#2A2D31] pb-3">
              <button
                type="button"
                onClick={() => setPayoutMethod("upi")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  payoutMethod === "upi" ? "bg-[#FE760B] text-white" : "bg-[#212327] text-[#9E9E9F] hover:text-white"
                }`}
              >
                UPI ID (Instant Settlement)
              </button>
              <button
                type="button"
                onClick={() => setPayoutMethod("bank")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  payoutMethod === "bank" ? "bg-[#FE760B] text-white" : "bg-[#212327] text-[#9E9E9F] hover:text-white"
                }`}
              >
                Direct Bank Account (NEFT / IMPS)
              </button>
            </div>

            {/* 1. Combined UPI ID Input Component */}
            {payoutMethod === "upi" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#D0D0D1] flex items-center justify-between">
                <span>UPI ID (Instant Settlement Address) <span className="text-[#FE760B]">*</span></span>
                {previewUpiId && (
                  <span className="text-[11px] text-emerald-400 font-mono font-medium">
                    Resolved: {previewUpiId}
                  </span>
                )}
              </label>

              {/* Combined Input Row */}
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                {/* Username Input */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="Enter UPI username or phone number"
                    disabled={saving}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border text-xs text-white placeholder-[#9E9E9F] focus:outline-none transition-all ${
                      usernameError ? "border-rose-500 focus:border-rose-500" : "border-[#2A2D31] focus:border-[#FE760B]"
                    }`}
                  />
                </div>

                {/* Handle Dropdown */}
                <div className="sm:w-44">
                  <select
                    value={selectedHandle}
                    onChange={(e) => setSelectedHandle(e.target.value)}
                    disabled={saving}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white focus:outline-none focus:border-[#FE760B] transition-all font-mono"
                  >
                    {UPI_HANDLES.map((h) => (
                      <option key={h} value={h} className="bg-[#1A1C1F] text-white">
                        {h === "Other" ? "Other (Custom UPI)" : h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* If "Other" handle selected: show full custom UPI input */}
              {selectedHandle === "Other" && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={customHandle}
                    onChange={(e) => handleCustomHandleChange(e.target.value)}
                    placeholder="Enter complete UPI ID"
                    disabled={saving}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border text-xs text-white placeholder-[#9E9E9F] focus:outline-none transition-all ${
                      customHandleError ? "border-rose-500 focus:border-rose-500" : "border-[#2A2D31] focus:border-[#FE760B]"
                    }`}
                  />
                  {customHandleError && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle size={12} /> {customHandleError}
                    </p>
                  )}
                </div>
              )}

              {usernameError && selectedHandle !== "Other" && (
                <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle size={12} /> {usernameError}
                </p>
              )}

              {/* Disclaimer */}
              <div className="p-3 rounded-xl bg-[#212327]/60 border border-[#2A2D31] text-[11px] text-[#9E9E9F] flex items-start gap-2 leading-relaxed">
                <Info size={14} className="text-[#FE760B] shrink-0 mt-0.5" />
                <span>
                  <strong>Important:</strong> Format validation ensures correct syntax but does not verify account ownership or existence. Please double-check your UPI ID to prevent failed or misdirected transfers.
                </span>
              </div>
            </div>
            )}

            {/* Direct Bank Account Input Fields */}
            {payoutMethod === "bank" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#D0D0D1]">
                      Account Number <span className="text-[#FE760B]">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => {
                        setAccountNumber(e.target.value.replace(/\s+/g, ""));
                        setAccountNumberError("");
                      }}
                      placeholder="e.g. 50100234567890"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] font-mono"
                    />
                    {accountNumberError && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle size={12} /> {accountNumberError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#D0D0D1]">
                      IFSC Code <span className="text-[#FE760B]">*</span>
                    </label>
                    <input
                      type="text"
                      value={ifsc}
                      onChange={(e) => {
                        setIfsc(e.target.value.replace(/\s+/g, "").toUpperCase());
                        setIfscError("");
                      }}
                      placeholder="e.g. HDFC0001234"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] font-mono uppercase"
                    />
                    {ifscError && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle size={12} /> {ifscError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#D0D0D1]">
                    Account Holder Name <span className="text-[#FE760B]">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="Legal name as registered with the bank"
                    disabled={saving}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B]"
                  />
                </div>
              </div>
            )}

            {/* 2. Bank Name Dropdown */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#D0D0D1]">
                Bank Name <span className="text-[#FE760B]">*</span>
              </label>

              <select
                value={selectedBank}
                onChange={(e) => handleBankChange(e.target.value)}
                disabled={saving}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border text-xs text-white focus:outline-none transition-all ${
                  bankError ? "border-rose-500 focus:border-rose-500" : "border-[#2A2D31] focus:border-[#FE760B]"
                }`}
              >
                <option value="" className="bg-[#1A1C1F] text-[#9E9E9F]">
                  Select your receiving bank...
                </option>
                {BANK_NAMES.map((bank) => (
                  <option key={bank} value={bank} className="bg-[#1A1C1F] text-white">
                    {bank}
                  </option>
                ))}
              </select>

              {/* Custom Bank text input if "Other" selected */}
              {selectedBank === "Other" && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    placeholder="Enter your bank's official name"
                    disabled={saving}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-all"
                  />
                </div>
              )}

              {bankError && (
                <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle size={12} /> {bankError}
                </p>
              )}
            </div>

            {/* 3. Contact Details Confirmation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#D0D0D1]">Organizer / College Name</label>
                <input
                  type="text"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  placeholder="Organizer legal or display name"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#D0D0D1]">Finance Contact Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Primary contact number (for payment verification)"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2D31]">
            {profile && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#e06505] text-black font-bold text-xs transition-all shadow-md shadow-[#FE760B]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Saving Payout Profile...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save Payout Details</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

