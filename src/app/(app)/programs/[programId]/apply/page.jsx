"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/auth";
import {
  Sparkles,
  Users,
  Award,
  CheckCircle,
  Loader2,
  ArrowRight,
  Shield,
  Building,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PublicProgramApplyPage({ params }) {
  const unwrappedParams = use(params);
  const programId = unwrappedParams.programId;

  const { user } = useAuth();
  const router = useRouter();

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

  useEffect(() => {
    async function fetchProgramDetails() {
      try {
        const res = await fetch(`/api/programs/${programId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.program) {
            setProgram(data.program);
            if (data.program.college) {
              setFormData((prev) => ({ ...prev, college: prev.college || data.program.college }));
            }
          }
        }
        // If user is authenticated, check if already applied or approved
        if (user) {
          try {
            const meRes = await authFetch("/api/ambassador/me");
            if (meRes.ok) {
              const meData = await meRes.json();
              const isApproved = (meData.enrollments || []).some((e) => e.programId === programId);
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
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProgramDetails();
  }, [programId, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.whatsappPhone.trim() || !formData.college.trim()) {
      toast.error("Please fill in your name, email, WhatsApp phone, and college.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/programs/${programId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          whatsappPhone: formData.whatsappPhone.trim(),
          college: formData.college.trim(),
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#131517] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE760B]" />
      </div>
    );
  }

  if (existingStatus === "approved") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/25">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">You Are an Active Ambassador!</h2>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
            Your application for <strong className="text-slate-800 dark:text-white">{program?.name}</strong> is approved. Access your exclusive referral code, QR code, and rewards in the portal.
          </p>
          <Link href="/ambassador/dashboard">
            <Button className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-10 rounded-xl mt-2 cursor-pointer">
              Open Ambassador Portal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (existingStatus === "pending") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/25">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Application Already Under Review</h2>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
            You have already submitted an ambassador application for <strong className="text-slate-800 dark:text-white">{program?.name}</strong>. The organizer will review your profile and issue your unique referral code.
          </p>
          <Link href="/ambassador/dashboard">
            <Button className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-10 rounded-xl mt-2 cursor-pointer">
              Go to Ambassador Portal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/25">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Application Received!</h2>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
            Your application to represent <strong className="text-slate-800 dark:text-white">{program?.name}</strong> has been submitted. The organizers will review your credentials and issue your unique referral code.
          </p>
          <Link href="/ambassador/dashboard">
            <Button className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-10 rounded-xl mt-2 cursor-pointer">
              Go to Ambassador Portal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white py-6 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block">
            <Image
              src="/logo/ticketlelo-logo-nav.png"
              alt="TicketLelo"
              width={90}
              height={28}
              className="h-6 w-auto mx-auto object-contain"
              priority
            />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/25">
            <Sparkles className="w-3 h-3" />
            Campus Ambassador Application
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {program?.name || "Ambassador Program"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-md mx-auto">
            Become a campus creator. Share exclusive fest passes, earn milestone points, and unlock VIP access and rewards.
          </p>
        </div>

        {/* Application Card */}
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-3xl p-4 sm:p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-[#9B9EA4] block mb-1">
                  Full Name *
                </label>
                <Input
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter your full name"
                  className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-[#9B9EA4] block mb-1">
                  Verified Email *
                </label>
                <Input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email address"
                  className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-[#9B9EA4] block mb-1">
                  WhatsApp Contact *
                </label>
                <Input
                  required
                  value={formData.whatsappPhone}
                  onChange={(e) => setFormData({ ...formData, whatsappPhone: e.target.value })}
                  placeholder="Enter your WhatsApp number"
                  className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-[#9B9EA4] block mb-1">
                  College / University *
                </label>
                <Input
                  required
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  placeholder="Enter your college or university"
                  className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-[#9B9EA4] block mb-1">
                  Branch / Department
                </label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Enter your branch or department"
                  className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-[#9B9EA4] block mb-1">
                  Year of Study
                </label>
                <select
                  value={formData.yearOfStudy}
                  onChange={(e) => setFormData({ ...formData, yearOfStudy: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-xs h-10 px-3 text-slate-900 dark:text-white"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Postgraduate">Postgraduate</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-[#9B9EA4] block mb-1">
                Promotion Strategy / Why You? *
              </label>
              <textarea
                required
                rows={3}
                value={formData.promotionPitch}
                onChange={(e) => setFormData({ ...formData, promotionPitch: e.target.value })}
                placeholder="Describe your promotion plan for your campus"
                className="w-full bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-xs p-3 text-slate-900 dark:text-white focus:outline-none focus:border-[#FE760B]"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-11 rounded-xl shadow-xs transition-all cursor-pointer mt-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : "Submit Ambassador Application"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

