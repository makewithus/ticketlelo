"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/auth";
import {
  Users,
  Award,
  Share2,
  Copy,
  Check,
  QrCode,
  GraduationCap,
  Gift,
  ArrowRight,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  ExternalLink,
  Shield,
  Layers,
  ChevronRight,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLoader } from "@/components/ui/brand-loader";
import { getPublicBaseUrl } from "@/lib/app-url";

export default function AmbassadorDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);
  const [myApplications, setMyApplications] = useState([]);
  const [availablePrograms, setAvailablePrograms] = useState([]);

  // Active Tab: overview, ledger, rewards, leaderboard
  const [activeTab, setActiveTab] = useState("overview");

  // Copy Feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // QR Code Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Claim Reward Modal
  const [claimingReward, setClaimingReward] = useState(null);
  const [claimNotes, setClaimNotes] = useState("");
  const [processingClaim, setProcessingClaim] = useState(false);

  // Apply to Program Modal
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [applyProgram, setApplyProgram] = useState(null);
  const [applying, setApplying] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    whatsappPhone: "",
    college: "",
    department: "",
    yearOfStudy: "3rd Year",
    promotionPitch: "",
  });

  const isOrganiserOrAdmin =
    user?.role === "organiser" ||
    user?.role === "superAdmin" ||
    user?.isAdmin ||
    (user?.email || "").toLowerCase().includes("ticketlelo");

  const loadData = useCallback(async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setLoading(true);
    try {
      const res = await authFetch("/api/ambassador/me");
      if (!res.ok) {
        throw new Error("Failed to load ambassador profile");
      }
      const data = await res.json();
      setEnrollments(data.enrollments || []);
      setMyApplications(data.myApplications || []);
      setAvailablePrograms(data.availablePrograms || []);

      if (data.enrollments && data.enrollments.length > 0) {
        setSelectedEnrollmentId((prev) => prev || data.enrollments[0].id);
      }
    } catch (err) {
      console.error(err);
      if (showLoading) {
        toast.error("Could not load ambassador data");
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData(true);
    // Real-time background sync every 8s so when an organizer approves an application, the portal transitions automatically
    const timer = setInterval(() => {
      loadData(false);
    }, 8000);
    return () => clearInterval(timer);
  }, [loadData]);

  const activeEnrollment =
    enrollments.find((e) => e.id === selectedEnrollmentId) || enrollments[0] || null;

  const connectedEvents = activeEnrollment?.events || [];
  const [selectedEventId, setSelectedEventId] = useState("default");

  // Leaderboard tab state
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    if (activeTab === "leaderboard" && activeEnrollment?.programId) {
      setLoadingLeaderboard(true);
      fetch(`/api/public/leaderboard/${activeEnrollment.programId}`)
        .then((r) => r.json())
        .then((d) => {
          setLeaderboardData(d.leaderboard || []);
        })
        .catch((err) => {
          console.error("Failed to load leaderboard:", err);
        })
        .finally(() => setLoadingLeaderboard(false));
    }
  }, [activeTab, activeEnrollment?.programId]);

  const baseUrl = getPublicBaseUrl();
  const referralCode = activeEnrollment?.referralCode || "";

  // Target event calculation: direct to connected event page with #register, or /discover
  const chosenEvent =
    selectedEventId !== "all" && connectedEvents.length > 0
      ? connectedEvents.find((evt) => evt.id === selectedEventId) || connectedEvents[0]
      : selectedEventId === "all"
      ? null
      : connectedEvents[0] || null;

  const referralUrl = referralCode
    ? chosenEvent
      ? `${baseUrl}/e/${chosenEvent.slug || chosenEvent.id}?ref=${referralCode}#register`
      : `${baseUrl}/discover?ref=${referralCode}`
    : "";

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success("Referral link copied!");
    } else if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast.success("Referral code copied!");
    }
  };

  const handleClaimReward = async (reward) => {
    setProcessingClaim(true);
    try {
      const res = await authFetch(`/api/ambassador/rewards/${reward.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: claimNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");
      toast.success(`Reward claimed! Transaction: ${data.ledgerId}`);
      setClaimingReward(null);
      setClaimNotes("");
      loadData();
    } catch (err) {
      toast.error(err.message || "Could not claim reward");
    } finally {
      setProcessingClaim(false);
    }
  };

  const handleApplyToProgram = async (e) => {
    e.preventDefault();
    if (!applyProgram) return;

    const cleanName = (formData.fullName || user?.displayName || "").trim();
    const cleanEmail = (formData.email || user?.email || "").trim();
    const cleanPhone = formData.whatsappPhone.trim();
    const cleanCollege = formData.college.trim();

    if (!cleanName || !cleanEmail || !cleanPhone || !cleanCollege) {
      toast.error("Please fill in your name, email, WhatsApp phone, and college.");
      return;
    }

    if (/\d/.test(cleanName)) {
      toast.error("Full Name cannot contain numbers. Letters and spaces only.");
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      toast.error("WhatsApp phone number must be exactly 10 digits (no text or symbols).");
      return;
    }

    setApplying(true);
    try {
      const res = await authFetch(`/api/programs/${applyProgram.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          whatsappPhone: cleanPhone,
          college: cleanCollege,
          answers: {
            department: formData.department.trim(),
            yearOfStudy: formData.yearOfStudy,
            promotionPitch: formData.promotionPitch.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit application");
      toast.success("Application submitted! Our team will review your profile shortly.");
      setIsApplyOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || "Application submission failed");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <BrandLoader message="Loading ambassador portal..." fullScreen />;
  }

  // ── Case 1: User has NO active enrollments ──
  if (!activeEnrollment) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white p-6 md:p-12">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Organiser Portal Switch if applicable */}
          {isOrganiserOrAdmin && (
            <div className="flex justify-end">
              <Link href="/admin/dashboard">
                <Button variant="outline" className="text-xs h-9 gap-1.5 border-[#FE760B]/30 text-[#FE760B] hover:bg-[#FE760B]/10">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Switch to Organiser Dashboard</span>
                </Button>
              </Link>
            </div>
          )}

          {/* Pending Applications Status */}
          {myApplications.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Clock className="w-4 h-4" />
                <span>Application Under Review</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#9B9EA4]">
                You have submitted an ambassador application for{" "}
                <strong className="text-slate-900 dark:text-white">
                  {availablePrograms.find((p) => p.id === myApplications[0].programId)?.name ||
                    myApplications[0].programName ||
                    myApplications[0].programId}
                </strong>
                . The organizer will review your profile and issue your unique referral code.
              </p>
            </div>
          )}

          {/* Welcome & Join Programs Card */}
          <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-3xl p-6 sm:p-10 shadow-xl space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#FE760B]/14 text-[#FE760B] flex items-center justify-center mx-auto border border-[#FE760B]/30">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Creator Campus Ambassador Program
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] max-w-lg mx-auto">
                Represent official campus fests and workshops, share exclusive student invites with your unique code, earn points, and unlock VIP merchandise & passes.
              </p>
            </div>

            <div className="pt-4 space-y-4 text-left">
              <h2 className="text-xs font-bold text-slate-600 dark:text-[#9B9EA4] uppercase tracking-wider">
                Available Ambassador Programs
              </h2>
              {availablePrograms.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No public ambassador cohorts are currently accepting new applications. Please check back soon!
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {availablePrograms.map((prog) => {
                    const isPending = myApplications.some(
                      (a) => a.programId === prog.id && a.status === "pending"
                    );
                    const isApproved = enrollments.some((e) => e.programId === prog.id);

                    return (
                      <div
                        key={prog.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{prog.name}</h3>
                          <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                            {prog.college ? `Campus: ${prog.college} • ` : ""}{prog.description || "Earn rewards by referring attendees."}
                          </p>
                        </div>
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold shrink-0">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Enrolled Ambassador</span>
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-semibold shrink-0">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Application Under Review</span>
                          </span>
                        ) : (
                          <Button
                            onClick={() => {
                              setApplyProgram(prog);
                              setFormData({
                                fullName: user?.displayName || "",
                                email: user?.email || "",
                                whatsappPhone: user?.phone || "",
                                college: prog.college || "",
                                department: "",
                                yearOfStudy: "3rd Year",
                                promotionPitch: "",
                              });
                              setIsApplyOpen(true);
                            }}
                            className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-9 px-4 rounded-xl shrink-0 cursor-pointer"
                          >
                            Apply Now
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Application Form Modal */}
          {isApplyOpen && applyProgram && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[92dvh] overflow-y-auto my-auto p-4 sm:p-6 shadow-2xl space-y-4 text-white animate-scale-in custom-scrollbar">
                <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3.5">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                      Apply: {applyProgram.name}
                    </h3>
                    <p className="text-xs text-[#9B9EA4] mt-0.5">
                      Tell the organizers about your campus presence.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsApplyOpen(false)}
                    className="p-1.5 rounded-xl text-[#9B9EA4] hover:text-white hover:bg-[#212327] transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleApplyToProgram} className="space-y-4">
                  {/* 1. Full Name */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider">
                        Full Name <span className="text-[#FE760B]">*</span>
                      </label>
                      <span className="text-[10px] text-[#71767B]">Letters only, no numbers</span>
                    </div>
                    <Input
                      required
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fullName: e.target.value.replace(/[0-9]/g, ""),
                        })
                      }
                      placeholder="e.g. Rahul Sharma"
                      className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#71767B] h-10 rounded-xl focus:border-[#FE760B]"
                    />
                  </div>

                  {/* 2. WhatsApp Contact */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider">
                        WhatsApp Contact <span className="text-[#FE760B]">*</span>
                      </label>
                      <span className="text-[10px] text-[#71767B]">
                        {formData.whatsappPhone.length}/10 digits
                      </span>
                    </div>
                    <Input
                      required
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={formData.whatsappPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          whatsappPhone: e.target.value.replace(/\D/g, "").slice(0, 10),
                        })
                      }
                      placeholder="10-digit WhatsApp number (no country code or letters)"
                      className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#71767B] h-10 rounded-xl focus:border-[#FE760B]"
                    />
                  </div>

                  {/* 3. College / University */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                      College / University <span className="text-[#FE760B]">*</span>
                    </label>
                    <Input
                      required
                      value={formData.college}
                      onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                      placeholder="e.g. CUSAT / Delhi Technological University"
                      className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#71767B] h-10 rounded-xl focus:border-[#FE760B]"
                    />
                  </div>

                  {/* 4. Department / Branch */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                      Department / Branch
                    </label>
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="e.g. Computer Science & Engineering"
                      className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#71767B] h-10 rounded-xl focus:border-[#FE760B]"
                    />
                  </div>

                  {/* 5. Year of Study */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                      Year of Study
                    </label>
                    <select
                      value={formData.yearOfStudy}
                      onChange={(e) => setFormData({ ...formData, yearOfStudy: e.target.value })}
                      className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-xs sm:text-sm h-10 px-3 text-white focus:outline-none focus:border-[#FE760B] cursor-pointer"
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="Postgraduate">Postgraduate</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* 6. Promotion Strategy Pitch */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                      Promotion Strategy Pitch <span className="text-[#FE760B]">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={formData.promotionPitch}
                      onChange={(e) => setFormData({ ...formData, promotionPitch: e.target.value })}
                      placeholder="Describe how you plan to promote fest registrations across your campus..."
                      className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-xs sm:text-sm p-3 text-white placeholder:text-[#71767B] focus:outline-none focus:border-[#FE760B] resize-none"
                    />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3.5 border-t border-[#2A2D31]">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsApplyOpen(false)}
                      className="h-10 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={applying}
                      className="h-10 px-5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {applying ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : "Submit Application"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Case 2: User is Enrolled in an Ambassador Program ──
  const handleShareWhatsApp = () => {
    const message = `Hey! Register for ${chosenEvent?.name || "the event"} using my exclusive referral code ${referralCode}: ${referralUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ── Top Header Banner & Role Switcher ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2A2D31]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/25">
                <GraduationCap className="w-3 h-3" />
                Verified Campus Ambassador
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="w-3 h-3" />
                Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welcome, {user?.displayName || "Campus Ambassador"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
              Program: <strong className="text-slate-800 dark:text-[#D0D0D1]">{activeEnrollment.program?.name || "Ambassador Network"}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isOrganiserOrAdmin && (
              <Link href="/admin/dashboard">
                <Button variant="outline" className="text-xs h-9 gap-1.5 border-[#FE760B]/30 text-[#FE760B] hover:bg-[#FE760B]/10">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Organiser Suite</span>
                </Button>
              </Link>
            )}

            {enrollments.length > 1 && (
              <select
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-xs h-9 rounded-xl px-3"
              >
                {enrollments.map((enr) => (
                  <option key={enr.id} value={enr.id}>
                    {enr.program?.name || enr.referralCode}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Privacy-Compliant Ambassador Metrics ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9B9EA4]">
              <span>Total Points</span>
              <Award className="w-4 h-4 text-[#FE760B]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#FE760B] tabular-nums mt-1">
              {(activeEnrollment.totalPoints || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-[#9B9EA4] mt-0.5">Points Balance</div>
          </div>

          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9B9EA4]">
              <span>Leaderboard Rank</span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
              #{activeEnrollment.rank || 1}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-[#9B9EA4] mt-0.5">Campus Standing</div>
          </div>

          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9B9EA4]">
              <span>Available Rewards</span>
              <Gift className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
              {activeEnrollment.rewards?.length || 0}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-[#9B9EA4] mt-0.5">Claimable in Catalog</div>
          </div>

          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9B9EA4]">
              <span>Referral Code</span>
              <QrCode className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-slate-900 dark:text-white mt-1">
              {referralCode}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-[#9B9EA4] mt-0.5">Unique Ambassador Tag</div>
          </div>
        </div>

        {/* ── Referral Link & Share Promotion Card ── */}
        <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#FE760B]" />
                <span>Your Referral Link & Promotional Toolkit</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Share this link or your promo code on campus WhatsApp groups, club stories, and posters.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="h-9 px-3.5 gap-1.5 bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2D31] rounded-xl text-xs font-semibold flex items-center cursor-pointer transition-colors shadow-xs active:scale-[0.98]"
              >
                <QrCode className="w-3.5 h-3.5 text-[#FE760B]" />
                <span>Show QR</span>
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/35 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.712 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span>Share WhatsApp</span>
              </button>
            </div>
          </div>

          {connectedEvents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#2A2D31]">
              <span className="text-[11px] font-bold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">Target Event:</span>
              {connectedEvents.map((evt) => {
                const isSelected =
                  selectedEventId === evt.id ||
                  (selectedEventId === "default" && connectedEvents[0].id === evt.id);
                return (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => setSelectedEventId(evt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/40 font-bold shadow-xs"
                        : "bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2D31]"
                    }`}
                  >
                    <span>{evt.name}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedEventId("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedEventId === "all"
                    ? "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/40 font-bold shadow-xs"
                    : "bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2D31]"
                }`}
              >
                <span>All Events Catalog (/discover)</span>
                {selectedEventId === "all" && <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />}
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={referralUrl}
                className="flex-1 min-w-0 bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] font-mono text-xs h-10 text-slate-900 dark:text-[#D0D0D1] truncate"
              />
              <Button
                onClick={() => handleCopy(referralUrl, "link")}
                className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-10 px-3.5 sm:px-4 rounded-xl shrink-0 cursor-pointer shadow-xs transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 mr-1 text-[#131517]" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                <span className="hidden sm:inline">{copiedLink ? "Copied Link" : "Copy Link"}</span>
                <span className="sm:hidden">{copiedLink ? "Copied" : "Copy"}</span>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleCopy(referralCode, "code")}
                className="flex-1 sm:flex-initial text-xs h-9 px-3.5 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31] rounded-xl font-semibold cursor-pointer transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                <span>Code: <strong className="text-white font-mono">{referralCode}</strong></span>
              </Button>
              {referralCode && (
                <Link
                  href={chosenEvent ? `/e/${chosenEvent.slug || chosenEvent.id}?ref=${referralCode}#register` : `/discover?ref=${referralCode}`}
                  target="_blank"
                  className="shrink-0"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31] rounded-xl cursor-pointer transition-colors"
                    title="Preview referral link"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    <span className="text-xs">Preview</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#2A2D31] pb-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: "overview", label: "Overview" },
            { id: "ledger", label: `Points History (${activeEnrollment.ledger?.length || 0})` },
            { id: "rewards", label: `Rewards Catalog (${activeEnrollment.rewards?.length || 0})` },
            { id: "leaderboard", label: "Program Leaderboard" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? "bg-[#FE760B] text-[#131517]"
                  : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}
        {activeTab === "overview" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">How You Earn Points</h3>
              <ul className="text-xs text-slate-600 dark:text-[#9B9EA4] space-y-2 list-disc list-inside">
                <li>
                  <strong>Free Event Registrations:</strong> Earn {activeEnrollment.program?.pointsRules?.basePointsPerTicket || 10} points when an attendee registers using your link or code.
                </li>
                <li>
                  <strong>Paid Ticket Purchases:</strong> Earn {((activeEnrollment.program?.pointsRules?.basePointsPerTicket || 10) * (activeEnrollment.program?.pointsRules?.paidMultiplier || 2))} points per ticket on verified paid transactions.
                </li>
                <li>
                  <strong>Milestone Bonuses:</strong> Automatically unlock bulk bonus points as your referral count crosses tier targets.
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "ledger" && (
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-100 dark:border-[#2A2D31]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Points Audit Ledger</h3>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Append-only log of verified registrations, bonuses, and redeemed rewards.
              </p>
            </div>

            {(!activeEnrollment.ledger || activeEnrollment.ledger.length === 0) ? (
              <p className="text-xs text-slate-400 text-center py-8">No points activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#2A2D31]">
                {activeEnrollment.ledger.map((entry) => (
                  <div key={entry.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {entry.reason || entry.type || "Points Allocation"}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                        {new Date(entry.createdAt?.toDate ? entry.createdAt.toDate() : entry.createdAt || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className={`text-xs font-bold font-mono ${
                      entry.points >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {entry.points >= 0 ? `+${entry.points}` : entry.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "rewards" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Available Rewards</h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Redeem your accumulated points for exclusive perks and physical merchandise.
                </p>
              </div>
            </div>

            {(!activeEnrollment.rewards || activeEnrollment.rewards.length === 0) ? (
              <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-8 text-center text-xs text-slate-400">
                No rewards configured for this program yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeEnrollment.rewards.map((reward) => {
                  const canAfford = (activeEnrollment.totalPoints || 0) >= reward.pointsRequired;
                  const isOutOfStock = reward.totalInventory !== -1 && (reward.remainingInventory ?? reward.totalInventory) <= 0;

                  return (
                    <div
                      key={reward.id}
                      className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 flex flex-col justify-between space-y-3 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {reward.rewardType}
                          </span>
                          <span className="text-xs font-bold text-[#FE760B] tabular-nums">
                            {reward.pointsRequired} pts
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{reward.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1 line-clamp-2">
                          {reward.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-[#2A2D31] flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {isOutOfStock ? "Out of Stock" : `${reward.remainingInventory ?? reward.totalInventory} in stock`}
                        </span>
                        <Button
                          size="sm"
                          disabled={!canAfford || isOutOfStock}
                          onClick={() => setClaimingReward(reward)}
                          className={`text-xs h-8 px-3 rounded-lg ${
                            canAfford && !isOutOfStock
                              ? "bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold cursor-pointer"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          {canAfford ? "Claim Reward" : "Need Points"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Program Leaderboard</h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Top performing campus ambassadors ranked by verified ticket referrals.
                </p>
              </div>
              <Link href={`/leaderboard/${activeEnrollment.programId}`} target="_blank">
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 px-3 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31] rounded-xl font-semibold cursor-pointer transition-colors">
                  <span>Public View</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#212327] rounded-xl flex items-center justify-between border border-slate-200 dark:border-[#2A2D31]">
              <span className="text-xs font-bold text-[#FE760B]">Your Current Position:</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Rank #{activeEnrollment.rank || 1} • {activeEnrollment.totalPoints || 0} pts
              </span>
            </div>

            {loadingLeaderboard ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#FE760B]" />
              </div>
            ) : leaderboardData.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No verified ambassador referrals recorded yet. Be the first to refer!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#2A2D31] rounded-xl overflow-hidden border border-slate-100 dark:border-[#2A2D31]">
                {leaderboardData.slice(0, 10).map((amb) => {
                  const rankBadge = {
                    1: "bg-[#FE760B] text-black font-extrabold shadow-sm",
                    2: "bg-slate-300 text-black font-bold",
                    3: "bg-amber-700 text-white font-bold",
                  }[amb.rank] || "bg-[#212327] text-[#9B9EA4]";

                  return (
                    <div
                      key={amb.rank}
                      className={`p-3 sm:px-4 flex items-center justify-between gap-3 text-xs ${
                        amb.rank === 1 ? "bg-[#FE760B]/5" : "bg-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 ${rankBadge}`}>
                          {amb.rank}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {amb.displayName}
                        </span>
                      </div>
                      <span className="font-bold text-[#FE760B] font-mono">
                        {amb.totalPoints} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── QR Code Modal ── */}
        {isQrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-sm w-full max-h-[92dvh] overflow-y-auto my-auto p-5 sm:p-6 shadow-2xl text-center space-y-4 text-white animate-scale-in custom-scrollbar">
              <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-[#FE760B]" />
                  <h3 className="text-sm font-bold text-white">Ambassador Referral QR</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(false)}
                  className="p-1 rounded-xl text-[#9B9EA4] hover:text-white hover:bg-[#212327] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-white rounded-2xl flex items-center justify-center mx-auto w-44 h-44 sm:w-48 sm:h-48 border border-slate-200 shadow-inner">
                {/* Dynamically generated QR image via reliable public image provider */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(referralUrl)}`}
                  alt="Referral QR"
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-mono font-bold text-[#FE760B]">{referralCode}</p>
                <p className="text-[11px] text-[#9B9EA4]">
                  Scan with any phone camera to open event registration with this referral code auto-applied.
                </p>
              </div>

              <Button
                onClick={() => setIsQrModalOpen(false)}
                className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-10 rounded-xl cursor-pointer shadow-xs"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* ── Claim Confirmation Modal ── */}
        {claimingReward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-sm w-full max-h-[92dvh] overflow-y-auto my-auto p-5 sm:p-6 shadow-2xl space-y-4 text-white animate-scale-in custom-scrollbar">
              <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3.5">
                <h3 className="text-sm font-bold text-white tracking-tight">Confirm Reward Claim</h3>
                <button
                  type="button"
                  onClick={() => setClaimingReward(null)}
                  className="p-1.5 rounded-xl text-[#9B9EA4] hover:text-white hover:bg-[#212327] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="font-bold text-white text-sm">{claimingReward.title}</p>
                <p className="text-[#9B9EA4]">{claimingReward.description}</p>
                <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-400 font-semibold">
                  This will deduct {claimingReward.pointsRequired} points from your balance.
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                    Delivery Notes / Shirt Size (if applicable)
                  </label>
                  <Input
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    placeholder="Enter delivery notes or size details"
                    className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#71767B] h-10 rounded-xl focus:border-[#FE760B]"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-[#2A2D31]">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setClaimingReward(null)}
                  className="h-10 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={processingClaim}
                  onClick={() => handleClaimReward(claimingReward)}
                  className="h-10 px-5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {processingClaim ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : "Confirm Redemption"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
