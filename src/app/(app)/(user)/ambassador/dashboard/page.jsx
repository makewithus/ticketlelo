"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Copy,
  Check,
  Share2,
  DollarSign,
  Users,
  MousePointer,
  ShoppingBag,
  Clock,
  CheckCircle,
  FileText,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { getAmbassadorByUserId, submitAmbassadorApplication } from "@/lib/ambassadors";
import { getAmbassadorCommissions } from "@/lib/commissions";

export default function AmbassadorDashboardPage() {
  const { user } = useAuth();
  const [ambassador, setAmbassador] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(null);

  // Application form state
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    whatsappPhone: "",
    college: "",
    department: "",
    yearOfStudy: "3rd Year",
    city: "",
    socialProfile: "",
    clubRoles: "",
    priorExperience: "",
    promotionPitch: "",
  });

  const loadAmbassadorData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const ambData = await getAmbassadorByUserId(user.id);
      setAmbassador(ambData);

      if (ambData) {
        const commList = await getAmbassadorCommissions(ambData.id);
        setCommissions(commList);
      }
    } catch (err) {
      console.error("Failed to load ambassador portal data:", err);
      toast.error("Could not load ambassador data.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        loadAmbassadorData();
      }, 0);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, loadAmbassadorData]);

  const handleApply = async (e) => {
    e.preventDefault();
    const fullName = (formData.fullName || user?.displayName || user?.name || "").trim();
    const email = (formData.email || user?.email || "").trim();
    const whatsappPhone = (formData.whatsappPhone || user?.phone || user?.phoneNumber || "").trim();
    const college = (formData.college || "").trim();

    if (!fullName || !email || !whatsappPhone || !college) {
      toast.error("Please fill in your name, email, WhatsApp phone, and college.");
      return;
    }
    setSubmitting(true);
    try {
      await submitAmbassadorApplication({
        userId: user.id,
        programId: "prog_praroha_2027",
        parentEventId: "praroha-2027",
        fullName,
        email,
        whatsappPhone,
        college,
        answers: {
          department: formData.department,
          yearOfStudy: formData.yearOfStudy,
          city: formData.city,
          socialProfile: formData.socialProfile,
          clubRoles: formData.clubRoles,
          priorExperience: formData.priorExperience,
          promotionPitch: formData.promotionPitch,
        },
      });
      toast.success("Application submitted successfully! It is now in the organizer review queue.");
      await loadAmbassadorData();
    } catch (err) {
      toast.error(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const referralUrl = ambassador
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/e/praroha-2027?ref=${ambassador.referralCode}`
    : "";

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success("Referral URL copied to clipboard!");
    } else if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast.success("Promo code copied!");
    } else {
      setCopiedTemplate(type);
      setTimeout(() => setCopiedTemplate(null), 2000);
      toast.success("Marketing template copied!");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B132B] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!ambassador) {
    return (
      <div className="min-h-screen bg-[#0B132B] text-slate-100 p-6 md:p-12 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full bg-slate-900/90 border border-slate-800 p-6 sm:p-10 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/30">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Campus Ambassador Program</h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
              Join the official PRAROHA 2027 Ambassador Network. Promote the fest on your campus, track verified referral ticket sales, and earn direct commissions.
            </p>
          </div>

          <form onSubmit={handleApply} className="space-y-4 pt-2">
            {/* Student Identity */}
            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400">1. Student Identity</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">Full Name *</label>
                  <Input
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Adil Mohammed"
                    className="bg-slate-800/80 border-slate-700 text-xs h-9 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Verified Email *</label>
                  <Input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="adil@cusat.ac.in"
                    className="bg-slate-800/80 border-slate-700 text-xs h-9 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">WhatsApp Contact *</label>
                  <Input
                    required
                    value={formData.whatsappPhone}
                    onChange={(e) => setFormData({ ...formData, whatsappPhone: e.target.value })}
                    placeholder="9876543210"
                    className="bg-slate-800/80 border-slate-700 text-xs h-9 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Academic Affiliation */}
            <div className="space-y-1 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400">2. Academic Affiliation</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">College / University *</label>
                  <Input
                    required
                    value={formData.college}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                    placeholder="CUSAT"
                    className="bg-slate-800/80 border-slate-700 text-xs h-9 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Branch / Department</label>
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Computer Science"
                    className="bg-slate-800/80 border-slate-700 text-xs h-9 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Year of Study</label>
                  <Input
                    value={formData.yearOfStudy}
                    onChange={(e) => setFormData({ ...formData, yearOfStudy: e.target.value })}
                    placeholder="3rd Year B.Tech"
                    className="bg-slate-800/80 border-slate-700 text-xs h-9 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Campus Reach */}
            <div className="space-y-1 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400">3. Campus Reach</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">Current City</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Kochi"
                    className="bg-slate-800/80 border-slate-700 text-xs h-9 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Instagram / LinkedIn URL</label>
                  <Input
                    value={formData.socialProfile}
                    onChange={(e) => setFormData({ ...formData, socialProfile: e.target.value })}
                    placeholder="instagram.com/adil_m"
                    className="bg-slate-800/80 border-slate-700 text-xs h-9 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Student Club Roles</label>
                  <Input
                    value={formData.clubRoles}
                    onChange={(e) => setFormData({ ...formData, clubRoles: e.target.value })}
                    placeholder="Tech Club Lead"
                    className="bg-slate-800/80 border-slate-700 text-xs h-9 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Prior Experience & Pitch */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-blue-400 block mb-1">
                  4. Prior Experience
                </label>
                <textarea
                  value={formData.priorExperience}
                  onChange={(e) => setFormData({ ...formData, priorExperience: e.target.value })}
                  placeholder="Past fest coordinator or ambassador history..."
                  rows={2}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-blue-400 block mb-1">
                  5. Promotion Pitch *
                </label>
                <textarea
                  required
                  value={formData.promotionPitch}
                  onChange={(e) => setFormData({ ...formData, promotionPitch: e.target.value })}
                  placeholder="How do you plan to promote PRAROHA on your campus?"
                  rows={2}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 transition-all mt-4"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Ambassador Application"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Calculate financial ledger totals
  const totalEarned = commissions.reduce((sum, c) => (c.status !== "reversed" ? sum + (c.commissionAmount || 0) : sum), 0);
  const totalHeld = commissions.reduce((sum, c) => (c.status === "held" ? sum + (c.commissionAmount || 0) : sum), 0);
  const totalPaid = commissions.reduce((sum, c) => (c.status === "paid" ? sum + (c.commissionAmount || 0) : sum), 0);

  const whatsappTemplate = `Hey! Join us at PRAROHA 2027, the flagship national technical fest! Get workshops, hackathons, and pro show tickets here: ${referralUrl} (Use code ${ambassador.referralCode} for exclusive discounts!)`;
  const instagramTemplate = `Excited to be a Campus Ambassador for PRAROHA 2027! Grab your fest passes & track combos with code [${ambassador.referralCode}] at ${referralUrl}. Link in bio!`;

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-100 p-6 md:p-10 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/60 border border-blue-800/40 px-2.5 py-0.5 rounded-full">
              Official Campus Ambassador
            </span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Approved
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            Welcome, {ambassador.fullName}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            College: <strong className="text-slate-300">{ambassador.college || "Campus Partner"}</strong> | Program: PRAROHA 2027 Ambassador Network
          </p>
        </div>

        {/* Promo code badge */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Your Referral Code</div>
            <div className="text-lg font-mono font-bold text-emerald-400">{ambassador.referralCode}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCopy(ambassador.referralCode, "code")}
            className="border-slate-700 text-xs h-8 text-slate-300 hover:text-white"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Share Link Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/50 to-slate-900 border border-blue-900/40 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-300">
          <Share2 className="w-4 h-4 text-blue-400" />
          <span>Your Unique Referral Link</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            readOnly
            value={referralUrl}
            className="bg-slate-900/90 border-slate-700 text-xs text-slate-200 font-mono h-10"
          />
          <Button
            onClick={() => handleCopy(referralUrl, "link")}
            className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold h-10 whitespace-nowrap"
          >
            {copiedLink ? (
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Copied!</span>
            ) : (
              <span className="flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Copy Link</span>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-slate-400">
          Share this link with your college peers. Registrations and ticket purchases made via this link are automatically attributed to your account.
        </p>
      </div>

      {/* Professional KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Referral Clicks</span>
            <MousePointer className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{ambassador.metrics?.clicks || 0}</div>
          <div className="text-[11px] text-slate-500">Total verified visits</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Paid Tickets Sold</span>
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{ambassador.metrics?.paidOrders || 0}</div>
          <div className="text-[11px] text-slate-500">Confirmed orders</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Attributed Revenue</span>
            <DollarSign className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">₹{ambassador.metrics?.attributedRevenue || 0}</div>
          <div className="text-[11px] text-slate-500">Gross ticket volume</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Earned Commission</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">₹{totalEarned}</div>
          <div className="text-[11px] text-slate-500">₹{totalHeld} in 7-day holding</div>
        </div>
      </div>

      {/* Commission Ledger Table */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Commission Ledger &amp; Attributed Orders</h3>
            <p className="text-xs text-slate-400">
              Subject to standard 7-day fraud and refund holding period (AMB-010).
            </p>
          </div>
        </div>

        {commissions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No attributed orders recorded yet. Start sharing your referral link with students!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Buyer</th>
                  <th className="py-2.5 px-3">Order Amount</th>
                  <th className="py-2.5 px-3">Commission</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Maturity Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{c.orderId}</td>
                    <td className="py-2.5 px-3">{c.buyerName || "Attendee"}</td>
                    <td className="py-2.5 px-3">₹{c.orderAmount}</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-400">₹{c.commissionAmount}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        c.status === "paid"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                          : c.status === "held"
                          ? "bg-amber-950 text-amber-400 border border-amber-800/40"
                          : c.status === "reversed"
                          ? "bg-red-950 text-red-400 border border-red-800/40"
                          : "bg-blue-950 text-blue-400 border border-blue-800/40"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {c.matureAt?.toDate ? c.matureAt.toDate().toLocaleDateString("en-IN") : "Matured"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approved Marketing Copy Templates */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white">Approved Promotional Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WhatsApp Template */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> WhatsApp Message
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(whatsappTemplate, "whatsapp")}
                className="text-xs text-slate-400 hover:text-white h-7 px-2"
              >
                {copiedTemplate === "whatsapp" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg font-mono whitespace-pre-wrap">
              {whatsappTemplate}
            </p>
          </div>

          {/* Instagram Story Template */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Instagram Story / Bio
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(instagramTemplate, "instagram")}
                className="text-xs text-slate-400 hover:text-white h-7 px-2"
              >
                {copiedTemplate === "instagram" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg font-mono whitespace-pre-wrap">
              {instagramTemplate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
