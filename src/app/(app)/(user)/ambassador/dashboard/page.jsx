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
import { getPublicBaseUrl } from "@/lib/app-url";

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
    ? `${getPublicBaseUrl()}/e/praroha-2027?ref=${ambassador.referralCode}`
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
      <div className="min-h-screen bg-[#131517] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE760B]" />
      </div>
    );
  }

  if (!ambassador) {
    return (
      <div className="min-h-screen bg-[#131517] text-white p-6 md:p-12 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full bg-[#1A1C1F] border border-[#2A2D31] p-6 sm:p-10 rounded-3xl shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FE760B]/14 text-[#FE760B] flex items-center justify-center mx-auto border border-[#FE760B]/30">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Campus ambassador program</h1>
            <p className="text-xs sm:text-sm text-[#9B9EA4] max-w-lg mx-auto">
              Join the official PRAROHA 2027 Ambassador Network. Promote the fest on your campus, track verified referral ticket sales, and earn direct commissions.
            </p>
          </div>

          <form onSubmit={handleApply} className="space-y-4 pt-2">
            {/* Student Identity */}
            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#FE760B]">1. Student identity</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-[#9B9EA4]">Full name *</label>
                  <Input
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Adil Mohammed"
                    className="bg-[#212327] border-[#2A2D31] text-xs h-9 text-white placeholder:text-[#9B9EA4] focus:border-[#FE760B]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#9B9EA4]">Verified email *</label>
                  <Input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="adil@cusat.ac.in"
                    className="bg-[#212327] border-[#2A2D31] text-xs h-9 text-white placeholder:text-[#9B9EA4] focus:border-[#FE760B]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#9B9EA4]">WhatsApp contact *</label>
                  <Input
                    required
                    value={formData.whatsappPhone}
                    onChange={(e) => setFormData({ ...formData, whatsappPhone: e.target.value })}
                    placeholder="9876543210"
                    className="bg-[#212327] border-[#2A2D31] text-xs h-9 text-white placeholder:text-[#9B9EA4] focus:border-[#FE760B]"
                  />
                </div>
              </div>
            </div>

            {/* Academic Affiliation */}
            <div className="space-y-1 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#FE760B]">2. Academic affiliation</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-[#9B9EA4]">College / university *</label>
                  <Input
                    required
                    value={formData.college}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                    placeholder="CUSAT"
                    className="bg-[#212327] border-[#2A2D31] text-xs h-9 text-white placeholder:text-[#9B9EA4] focus:border-[#FE760B]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#9B9EA4]">Branch / department</label>
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Computer Science"
                    className="bg-[#212327] border-[#2A2D31] text-xs h-9 text-white placeholder:text-[#9B9EA4] focus:border-[#FE760B]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#9B9EA4]">Year of study</label>
                  <Input
                    value={formData.yearOfStudy}
                    onChange={(e) => setFormData({ ...formData, yearOfStudy: e.target.value })}
                    placeholder="3rd Year B.Tech"
                    className="bg-[#212327] border-[#2A2D31] text-xs h-9 text-white placeholder:text-[#9B9EA4] focus:border-[#FE760B]"
                  />
                </div>
              </div>
            </div>

            {/* Campus Reach */}
            <div className="space-y-1 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#FE760B]">3. Campus reach</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-[#9B9EA4]">Current city</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Kochi"
                    className="bg-[#212327] border-[#2A2D31] text-xs h-9 text-white placeholder:text-[#9B9EA4] focus:border-[#FE760B]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#9B9EA4]">Instagram / LinkedIn URL</label>
                  <Input
                    value={formData.socialProfile}
                    onChange={(e) => setFormData({ ...formData, socialProfile: e.target.value })}
                    placeholder="instagram.com/adil_m"
                    className="bg-[#212327] border-[#2A2D31] text-xs h-9 text-white placeholder:text-[#9B9EA4] focus:border-[#FE760B]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#9B9EA4]">Student club roles</label>
                  <Input
                    value={formData.clubRoles}
                    onChange={(e) => setFormData({ ...formData, clubRoles: e.target.value })}
                    placeholder="Tech Club Lead"
                    className="bg-[#212327] border-[#2A2D31] text-xs h-9 text-white placeholder:text-[#9B9EA4] focus:border-[#FE760B]"
                  />
                </div>
              </div>
            </div>

            {/* Prior Experience & Pitch */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] text-[#FE760B] font-semibold uppercase tracking-wider block mb-1">
                  4. Prior experience
                </label>
                <textarea
                  value={formData.priorExperience}
                  onChange={(e) => setFormData({ ...formData, priorExperience: e.target.value })}
                  placeholder="Past fest coordinator or ambassador history..."
                  rows={2}
                  className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl p-2.5 text-xs text-white placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#FE760B] font-semibold uppercase tracking-wider block mb-1">
                  5. Promotion pitch *
                </label>
                <textarea
                  required
                  value={formData.promotionPitch}
                  onChange={(e) => setFormData({ ...formData, promotionPitch: e.target.value })}
                  placeholder="How do you plan to promote PRAROHA on your campus?"
                  rows={2}
                  className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl p-2.5 text-xs text-white placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B]"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 font-semibold bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] rounded-xl shadow-sm transition-all mt-4 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : "Submit ambassador application"}
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
    <div className="min-h-screen bg-[#131517] text-white p-6 md:p-10 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#2A2D31]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#FE760B] bg-[#FE760B]/14 border border-[#FE760B]/30 px-2.5 py-0.5 rounded-full">
              Official campus ambassador
            </span>
            <span className="text-xs font-semibold text-[#3DD68C] bg-[#3DD68C]/12 border border-[#3DD68C]/25 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
              Approved
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            Welcome, {ambassador.fullName}
          </h1>
          <p className="text-xs md:text-sm text-[#9B9EA4] mt-1">
            College: <strong className="text-white">{ambassador.college || "Campus Partner"}</strong> | Program: PRAROHA 2027 Ambassador Network
          </p>
        </div>

        {/* Promo code badge */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-3 flex items-center gap-3">
          <div>
            <div className="text-[10px] text-[#9B9EA4] uppercase tracking-wider font-semibold">Your referral code</div>
            <div className="text-lg font-mono font-bold text-[#FE760B]">{ambassador.referralCode}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCopy(ambassador.referralCode, "code")}
            className="border-[#2A2D31] bg-[#212327] text-xs h-8 text-[#D0D0D1] hover:text-white"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-[#3DD68C]" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Share Link Card */}
      <div className="p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#FE760B]">
          <Share2 className="w-4 h-4 text-[#FE760B]" />
          <span>Your unique referral link</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            readOnly
            value={referralUrl}
            className="bg-[#212327] border-[#2A2D31] text-xs text-white font-mono h-10"
          />
          <Button
            onClick={() => handleCopy(referralUrl, "link")}
            className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] text-xs font-semibold h-10 whitespace-nowrap cursor-pointer shadow-sm"
          >
            {copiedLink ? (
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#131517]" /> Copied!</span>
            ) : (
              <span className="flex items-center gap-1.5"><Copy className="w-3.5 h-3.5 text-[#131517]" /> Copy link</span>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-[#9B9EA4]">
          Share this link with your college peers. Registrations and ticket purchases made via this link are automatically attributed to your account.
        </p>
      </div>

      {/* Professional KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] space-y-1">
          <div className="flex items-center justify-between text-[#9B9EA4] text-xs">
            <span>Referral clicks</span>
            <MousePointer className="w-4 h-4 text-[#7AA2FF]" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">{ambassador.metrics?.clicks || 0}</div>
          <div className="text-[11px] text-[#9B9EA4]">Total verified visits</div>
        </div>

        <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] space-y-1">
          <div className="flex items-center justify-between text-[#9B9EA4] text-xs">
            <span>Paid tickets sold</span>
            <ShoppingBag className="w-4 h-4 text-[#3DD68C]" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">{ambassador.metrics?.paidOrders || 0}</div>
          <div className="text-[11px] text-[#9B9EA4]">Confirmed orders</div>
        </div>

        <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] space-y-1">
          <div className="flex items-center justify-between text-[#9B9EA4] text-xs">
            <span>Attributed revenue</span>
            <DollarSign className="w-4 h-4 text-[#7AA2FF]" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">₹{ambassador.metrics?.attributedRevenue || 0}</div>
          <div className="text-[11px] text-[#9B9EA4]">Gross ticket volume</div>
        </div>

        <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] space-y-1">
          <div className="flex items-center justify-between text-[#9B9EA4] text-xs">
            <span>Earned commission</span>
            <Sparkles className="w-4 h-4 text-[#FDE003]" />
          </div>
          <div className="text-2xl font-bold text-[#3DD68C] tabular-nums">₹{totalEarned}</div>
          <div className="text-[11px] text-[#9B9EA4]">₹{totalHeld} in 7-day holding</div>
        </div>
      </div>

      {/* Commission Ledger Table */}
      <div className="p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Commission ledger &amp; attributed orders</h3>
            <p className="text-xs text-[#9B9EA4]">
              Subject to standard 7-day fraud and refund holding period (AMB-010).
            </p>
          </div>
        </div>

        {commissions.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#9B9EA4]">
            No attributed orders recorded yet. Start sharing your referral link with students!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2A2D31] text-[#9B9EA4] font-semibold">
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[100px]">Order ID</th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px]">Buyer</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Order amount</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Commission</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Maturity date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D31] text-[#D0D0D1]">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-[#212327]/50 transition">
                    <td className="py-2.5 px-3 font-mono text-[#9B9EA4]">{c.orderId}</td>
                    <td className="py-2.5 px-3 font-medium text-white">{c.buyerName || "Attendee"}</td>
                    <td className="py-2.5 px-3 tabular-nums">₹{c.orderAmount}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#3DD68C] tabular-nums">₹{c.commissionAmount}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1.5 ${
                        c.status === "paid"
                          ? "bg-[#3DD68C]/15 text-[#3DD68C] border border-[#3DD68C]/30"
                          : c.status === "held"
                          ? "bg-[#FDE003]/15 text-[#FDE003] border border-[#FDE003]/30"
                          : c.status === "reversed"
                          ? "bg-[#FF6B6B]/15 text-[#FF6B6B] border border-[#FF6B6B]/30"
                          : "bg-[#212327] text-[#9B9EA4] border border-[#2A2D31]"
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : "Pending"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#9B9EA4] tabular-nums">
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
        <h3 className="text-base font-bold text-white">Approved promotional templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WhatsApp Template */}
          <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3DD68C] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> WhatsApp message
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(whatsappTemplate, "whatsapp")}
                className="text-xs text-[#9B9EA4] hover:text-white hover:bg-[#212327] h-7 px-2"
              >
                {copiedTemplate === "whatsapp" ? <Check className="w-3 h-3 text-[#3DD68C]" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
            <p className="text-xs text-[#D0D0D1] bg-[#212327] border border-[#2A2D31] p-3 rounded-lg font-mono whitespace-pre-wrap">
              {whatsappTemplate}
            </p>
          </div>

          {/* Instagram Story Template */}
          <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#7AA2FF] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Instagram story / bio
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(instagramTemplate, "instagram")}
                className="text-xs text-[#9B9EA4] hover:text-white hover:bg-[#212327] h-7 px-2"
              >
                {copiedTemplate === "instagram" ? <Check className="w-3 h-3 text-[#3DD68C]" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
            <p className="text-xs text-[#D0D0D1] bg-[#212327] border border-[#2A2D31] p-3 rounded-lg font-mono whitespace-pre-wrap">
              {instagramTemplate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
