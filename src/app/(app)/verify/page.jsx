"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Award,
  Calendar,
  Download,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Search,
  Building2,
  User,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCertificate } from "@/lib/certificates";
import { BrandLoader } from "@/components/ui/brand-loader";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryId = searchParams?.get("id") || "";

  const [inputCertId, setInputCertId] = useState(queryId);
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  const performVerification = async (certId) => {
    if (!certId || !certId.trim()) return;
    const cleanId = certId.trim();
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const data = await getCertificate(cleanId);
      if (!data) {
        setError(`No official credential found matching "${cleanId}". Please verify the Certificate ID and try again.`);
        setCert(null);
      } else {
        setCert(data);
      }
    } catch (err) {
      setError(err.message || "Failed to query the credential verification database.");
      setCert(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!queryId) return;
    const timer = setTimeout(() => {
      performVerification(queryId);
    }, 0);
    return () => clearTimeout(timer);
  }, [queryId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputCertId.trim()) return;
    router.push(`/verify?id=${encodeURIComponent(inputCertId.trim())}`);
    performVerification(inputCertId.trim());
  };

  const handleDownloadPDF = () => {
    if (!cert?.id) return;
    window.open(`/api/certificates/${cert.id}/download`, "_blank");
  };

  const formattedDate = cert?.issuedAt?.toDate
    ? cert.issuedAt.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : cert?.issuedAt
    ? new Date(cert.issuedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Verified on TicketLelo";

  return (
    <div className="min-h-screen bg-[#131517] text-white flex flex-col items-center justify-center p-4 py-12 selection:bg-[#FE760B] selection:text-white">
      {/* Ambient faint top glow */}
      <div className="fixed top-0 inset-x-0 h-80 bg-gradient-to-b from-[#FE760B]/10 via-[#FE760B]/5 to-transparent pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl bg-[#1A1C1F] border border-[#2A2D31] rounded-3xl p-4 xs:p-6 sm:p-10 shadow-sm space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-[#FE760B]/14 border border-[#FE760B]/20 text-[#FE760B] mb-2">
            <Award className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Credential verification
          </h1>
          <p className="text-sm text-[#9B9EA4] max-w-md mx-auto">
            Public authenticity validator for verified student participant credentials, track achievements, and organizing certificates.
          </p>
        </div>

        {/* Search Bar Form */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9EA4]" />
            <Input
              value={inputCertId}
              onChange={(e) => setInputCertId(e.target.value)}
              placeholder="Enter Certificate ID"
              className="pl-10 h-12 bg-[#212327] border-[#2A2D31] text-white font-mono placeholder:font-sans placeholder:text-[#9B9EA4] rounded-xl focus:border-[#FE760B]"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !inputCertId.trim()}
            className="h-12 px-6 font-semibold bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] rounded-xl transition-colors shrink-0 shadow-none border-none cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : "Verify ID"}
          </Button>
        </form>

        {/* Verification Result Area */}
        {loading && (
          <div className="py-12 flex items-center justify-center">
            <BrandLoader message="Loading..." fullScreen={false} />
          </div>
        )}

        {!loading && searched && error && (
          <div className="p-5 rounded-2xl bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 text-center space-y-2 animate-in fade-in">
            <div className="w-10 h-10 rounded-full bg-[#FF6B6B]/15 text-[#FF9A9A] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#FF9A9A]">Verification failed</h3>
            <p className="text-xs text-[#FF9A9A]/80 leading-relaxed max-w-md mx-auto">{error}</p>
          </div>
        )}

        {!loading && cert && (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#212327] border border-[#2A2D31] space-y-6 animate-in fade-in">
            {/* Authenticity Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-[#2A2D31]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3DD68C]/15 text-[#3DD68C] flex items-center justify-center border border-[#3DD68C]/25">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Valid & authentic</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#3DD68C]/12 text-[#3DD68C]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                      Officially verified
                    </span>
                  </div>
                  <p className="text-xs text-[#9B9EA4] font-mono mt-0.5">{cert.certificateId || cert.id}</p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleDownloadPDF}
                className="gap-2 h-9 text-xs font-semibold bg-[#1A1C1F] hover:bg-[#2A2D31] text-white border border-[#2A2D31] rounded-xl shadow-none"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
            </div>

            {/* Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31]">
                <div className="flex items-center gap-2 text-xs text-[#9B9EA4] mb-1">
                  <User className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Awarded to</span>
                </div>
                <p className="text-base font-bold text-white">{cert.buyerName || "Verified attendee"}</p>
                {cert.buyerEmail && (
                  <p className="text-xs text-[#9B9EA4] font-mono mt-0.5">
                    {cert.buyerEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3")}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31]">
                <div className="flex items-center gap-2 text-xs text-[#9B9EA4] mb-1">
                  <Calendar className="w-3.5 h-3.5 text-[#FDE003]" />
                  <span>Date of issuance</span>
                </div>
                <p className="text-base font-bold text-white">{formattedDate}</p>
                <p className="text-xs text-[#9B9EA4] mt-0.5">Verified gate check-in confirmed</p>
              </div>

              <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31]">
                <div className="flex items-center gap-2 text-xs text-[#9B9EA4] mb-1">
                  <Building2 className="w-3.5 h-3.5 text-[#3DD68C]" />
                  <span>Host festival</span>
                </div>
                <p className="text-base font-bold text-white">{cert.eventTitle || "Flagship festival"}</p>
                <p className="text-xs text-[#9B9EA4] mt-0.5">Host Academic Council</p>
              </div>

              <div className="p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31]">
                <div className="flex items-center gap-2 text-xs text-[#9B9EA4] mb-1">
                  <Layers className="w-3.5 h-3.5 text-[#7AA2FF]" />
                  <span>Track / level</span>
                </div>
                <p className="text-base font-bold text-white">{cert.subEventTitle || "Festival completion"}</p>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  {cert.subEventId ? "Sub-event track credential" : "Parent major event credential"}
                </p>
              </div>
            </div>

            {/* Issuer Sign-off */}
            <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-center">
              <p className="text-xs text-[#D0D0D1]">
                Verified through the TicketLelo Gate Access & Attendance Protocol. Tamper-evident record linked to ticket pass.
              </p>
            </div>
          </div>
        )}

        {/* Footer Link */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs text-[#9B9EA4] hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            ← Return to TicketLelo homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<BrandLoader message="Loading..." fullScreen />}>
      <VerifyContent />
    </Suspense>
  );
}
