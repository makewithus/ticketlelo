"use client";

import { useState, useEffect, use, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/auth";
import {
  Users,
  Award,
  CheckCircle2,
  Loader2,
  Building,
  GraduationCap,
  Phone,
  Mail,
  User,
  ExternalLink,
  ShieldCheck,
  Clock,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function EmbedProgramApplyPage({ params }) {
  const unwrappedParams = use(params);
  const programId = unwrappedParams.programId;

  const searchParams = useSearchParams();
  const themeParam = searchParams.get("theme") || "dark";

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (themeParam === "light") {
        document.documentElement.classList.remove("dark");
      } else {
        document.documentElement.classList.add("dark");
      }
    }
  }, [themeParam]);

  const { user } = useAuth();
  const cardRef = useRef(null);

  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingStatus, setExistingStatus] = useState(null); // null | "pending" | "approved"

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    whatsappPhone: "",
    college: "",
    department: "",
    yearOfStudy: "3rd Year",
    promotionPitch: "",
  });

  // Pre-fill fields if user is authenticated
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.displayName || user.name || "",
        email: prev.email || user.email || "",
        whatsappPhone: prev.whatsappPhone || user.phone || "",
      }));
    }
  }, [user]);

  // Fetch program details and check existing status
  useEffect(() => {
    async function fetchProgramDetails() {
      try {
        setLoading(true);
        const res = await fetch(`/api/programs/${programId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.program) {
            setProgram(data.program);
            if (data.program.college) {
              setFormData((prev) => ({
                ...prev,
                college: prev.college || data.program.college,
              }));
            }
          }
        }

        // If user is authenticated, check application status
        if (user) {
          try {
            const meRes = await authFetch("/api/ambassador/me");
            if (meRes.ok) {
              const meData = await meRes.json();
              const isApproved = (meData.enrollments || []).some(
                (e) => e.programId === programId
              );
              const isPending = (meData.myApplications || []).some(
                (a) => a.programId === programId && a.status === "pending"
              );
              if (isApproved) {
                setExistingStatus("approved");
              } else if (isPending) {
                setExistingStatus("pending");
              }
            }
          } catch (_) {}
        }
      } catch (err) {
        console.error("Embed apply fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    if (programId) {
      fetchProgramDetails();
    }
  }, [programId, user]);

  // Notify parent window of height changes for auto-resizing iframe
  useEffect(() => {
    const notifyHeight = () => {
      if (typeof window !== "undefined" && window.parent) {
        const card = cardRef.current;
        const height = card
          ? card.scrollHeight + 40
          : document.documentElement.scrollHeight || document.body.scrollHeight;
        window.parent.postMessage({ type: "ticketlelo:resize", height }, "*");
      }
    };

    notifyHeight();
    const timer = setTimeout(notifyHeight, 300);

    let observer = null;
    if (typeof ResizeObserver !== "undefined" && cardRef.current) {
      observer = new ResizeObserver(() => notifyHeight());
      observer.observe(cardRef.current);
    }

    window.addEventListener("resize", notifyHeight);
    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener("resize", notifyHeight);
    };
  }, [program, loading, submitted, existingStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = formData.fullName.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
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

    setSubmitting(true);
    try {
      const res = await fetch(`/api/programs/${programId}/apply`, {
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

      setSubmitted(true);
      toast.success("Application submitted successfully!");
    } catch (err) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const isLight = themeParam === "light";

  return (
    <div
      ref={cardRef}
      id="tl-embed-apply-card"
      className={`w-full min-h-[480px] p-3 sm:p-5 font-sans select-none transition-colors ${
        isLight
          ? "bg-transparent text-slate-900"
          : "bg-transparent text-white"
      }`}
    >
      <div
        className={`w-full max-w-xl mx-auto rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isLight
            ? "bg-white/95 border-slate-200 text-slate-900"
            : "bg-[#181A1D]/95 border-[#26292E] text-white"
        }`}
      >
        {/* ── Top Header Banner ── */}
        <div
          className={`p-5 sm:p-6 border-b transition-colors ${
            isLight
              ? "bg-slate-50/80 border-slate-200"
              : "bg-[#131517]/90 border-[#26292E]"
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/30">
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span>Campus Ambassador Application</span>
            </div>

            <Link
              href="https://ticketlelo.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-400 hover:text-[#FE760B] transition-colors inline-flex items-center gap-1"
            >
              <span>TicketLelo</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
            {program?.title || program?.name || "Campus Ambassador Program"}
          </h1>

          {program?.college && (
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#FE760B]" />
              <span>{program.college}</span>
            </p>
          )}

          <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-2">
            Represent your college fest. Share exclusive passes, earn milestone points, and unlock VIP access and rewards.
          </p>
        </div>

        {/* ── Body Content ── */}
        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#FE760B]" />
              <p className="text-xs text-slate-400">Loading application form...</p>
            </div>
          ) : existingStatus === "approved" ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                You Are an Active Ambassador!
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-sm mx-auto">
                Your application for <strong className="text-slate-800 dark:text-white">{program?.name || "this program"}</strong> has already been approved. Access your exclusive referral code, promo link, and leaderboard in your dashboard.
              </p>
              <Link
                href="https://ticketlelo.in/ambassador/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block pt-2"
              >
                <Button className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9 px-5 rounded-xl cursor-pointer shadow-md">
                  Open Ambassador Dashboard
                </Button>
              </Link>
            </div>
          ) : existingStatus === "pending" ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Application Under Review
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-sm mx-auto">
                You have already submitted an ambassador application for <strong className="text-slate-800 dark:text-white">{program?.name || "this program"}</strong>. The organizers will review your credentials and issue your unique referral code shortly.
              </p>
              <Link
                href="https://ticketlelo.in/ambassador/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block pt-2"
              >
                <Button className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9 px-5 rounded-xl cursor-pointer shadow-md">
                  Check Status in Portal
                </Button>
              </Link>
            </div>
          ) : submitted ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Application Received!
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-sm mx-auto">
                Thank you for applying to represent <strong className="text-slate-800 dark:text-white">{program?.name || "this program"}</strong>. The organizers will review your details and issue your personal campus referral link.
              </p>
              <Link
                href="https://ticketlelo.in/ambassador/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block pt-2"
              >
                <Button className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9 px-5 rounded-xl cursor-pointer shadow-md">
                  Go to Ambassador Portal
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Full Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-[#D0D0D1] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#FE760B]" />
                    <span>Full Name</span>
                    <span className="text-[#FE760B]">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-[#71767B]">Letters only, no numbers</span>
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
                  className={`text-xs h-10 rounded-xl transition-colors ${
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#FE760B]"
                      : "bg-[#212327] border-[#2A2D31] text-white focus:border-[#FE760B]"
                  }`}
                />
              </div>

              {/* 2. Verified Email */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-[#D0D0D1] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#FE760B]" />
                    <span>Email Address</span>
                    <span className="text-[#FE760B]">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-[#71767B]">Official or student email</span>
                </div>
                <Input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="student@college.edu"
                  className={`text-xs h-10 rounded-xl transition-colors ${
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#FE760B]"
                      : "bg-[#212327] border-[#2A2D31] text-white focus:border-[#FE760B]"
                  }`}
                />
              </div>

              {/* 3. WhatsApp Contact */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-[#D0D0D1] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#FE760B]" />
                    <span>WhatsApp Phone Number</span>
                    <span className="text-[#FE760B]">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-[#71767B]">10 digits only</span>
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
                  placeholder="10-digit mobile number"
                  className={`text-xs h-10 rounded-xl transition-colors ${
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#FE760B]"
                      : "bg-[#212327] border-[#2A2D31] text-white focus:border-[#FE760B]"
                  }`}
                />
              </div>

              {/* 4. College / Campus Name */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-[#D0D0D1] flex items-center gap-1.5 mb-1">
                  <Building className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>College / University</span>
                  <span className="text-[#FE760B]">*</span>
                </label>
                <Input
                  required
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  placeholder="e.g. CUSAT / Delhi Technological University"
                  className={`text-xs h-10 rounded-xl transition-colors ${
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#FE760B]"
                      : "bg-[#212327] border-[#2A2D31] text-white focus:border-[#FE760B]"
                  }`}
                />
              </div>

              {/* 5. Department / Branch */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-[#D0D0D1] flex items-center gap-1.5 mb-1">
                  <GraduationCap className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Department / Branch</span>
                </label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g. Computer Science & Engineering"
                  className={`text-xs h-10 rounded-xl transition-colors ${
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#FE760B]"
                      : "bg-[#212327] border-[#2A2D31] text-white focus:border-[#FE760B]"
                  }`}
                />
              </div>

              {/* 6. Year of Study */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-[#D0D0D1] flex items-center gap-1.5 mb-1">
                  <Users className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Year of Study</span>
                </label>
                <select
                  value={formData.yearOfStudy}
                  onChange={(e) => setFormData({ ...formData, yearOfStudy: e.target.value })}
                  className={`w-full text-xs h-10 px-3 rounded-xl border transition-colors cursor-pointer outline-none ${
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#FE760B]"
                      : "bg-[#212327] border-[#2A2D31] text-white focus:border-[#FE760B]"
                  }`}
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Postgraduate">Postgraduate</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* 7. Promotion Strategy Pitch */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-[#D0D0D1] block mb-1">
                  Promotion Strategy / Why You? <span className="text-[#FE760B]">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.promotionPitch}
                  onChange={(e) => setFormData({ ...formData, promotionPitch: e.target.value })}
                  placeholder="Describe your promotion plan across your campus, clubs, and WhatsApp groups..."
                  className={`w-full text-xs p-3 rounded-xl border transition-colors outline-none resize-none ${
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#FE760B]"
                      : "bg-[#212327] border-[#2A2D31] text-white focus:border-[#FE760B]"
                  }`}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-10 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-[#131517]" />
                    <span>Submit Ambassador Application</span>
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className={`py-3 px-5 border-t text-[11px] flex items-center justify-between transition-colors ${
            isLight
              ? "bg-slate-50/80 border-slate-200 text-slate-400"
              : "bg-[#131517]/80 border-[#26292E] text-[#9B9EA4]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Official Campus Ambassador Form</span>
          </div>

          <Link
            href="https://ticketlelo.in"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#FE760B] transition-colors"
          >
            Powered by TicketLelo
          </Link>
        </div>
      </div>
    </div>
  );
}
