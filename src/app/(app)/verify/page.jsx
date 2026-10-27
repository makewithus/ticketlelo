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
    <div className="min-h-screen bg-[#0B132B] text-slate-100 flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 mb-2">
            <Award className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            TicketLelo Credential Verification
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Public authenticity validator for verified student participant credentials, track achievements, and organizing certificates.
          </p>
        </div>

        {/* Search Bar Form */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={inputCertId}
              onChange={(e) => setInputCertId(e.target.value)}
              placeholder="Enter Certificate ID (e.g. TL-CERT-2027-8842)"
              className="pl-10 h-12 bg-slate-800/80 border-slate-700 text-white font-mono placeholder:font-sans placeholder:text-slate-500 rounded-xl focus:border-blue-500"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !inputCertId.trim()}
            className="h-12 px-6 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/25 transition-all shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify ID"}
          </Button>
        </form>

        {/* Verification Result Area */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs text-slate-400">Verifying credential against tamper-proof ledger...</p>
          </div>
        )}

        {!loading && searched && error && (
          <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-center space-y-2 animate-in fade-in">
            <div className="w-10 h-10 rounded-full bg-rose-900/50 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-rose-300">Verification Failed</h3>
            <p className="text-xs text-rose-200/80 leading-relaxed max-w-md mx-auto">{error}</p>
          </div>
        )}

        {!loading && cert && (
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-slate-700/80 space-y-6 animate-in fade-in">
            {/* Authenticity Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Valid & Authentic</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                      OFFICIALLY VERIFIED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{cert.certificateId || cert.id}</p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleDownloadPDF}
                className="gap-2 h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
            </div>

            {/* Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Awarded To</span>
                </div>
                <p className="text-base font-bold text-white">{cert.buyerName || "Verified Attendee"}</p>
                {cert.buyerEmail && (
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {cert.buyerEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3")}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Date of Issuance</span>
                </div>
                <p className="text-base font-bold text-white">{formattedDate}</p>
                <p className="text-xs text-slate-500 mt-0.5">Verified gate check-in confirmed</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Host Festival</span>
                </div>
                <p className="text-base font-bold text-white">{cert.eventTitle || "Flagship Festival"}</p>
                <p className="text-xs text-slate-500 mt-0.5">Host Academic Council</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Track / Level</span>
                </div>
                <p className="text-base font-bold text-white">{cert.subEventTitle || "Festival Completion"}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cert.subEventId ? "Sub-Event Track Credential" : "Parent Major Event Credential"}
                </p>
              </div>
            </div>

            {/* Issuer Sign-off */}
            <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-900/40 text-center">
              <p className="text-xs text-blue-300 font-medium">
                Verified through the TicketLelo Gate Access & Attendance Protocol. Tamper-evident record linked to ticket pass.
              </p>
            </div>
          </div>
        )}

        {/* Footer Link */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5"
          >
            ← Return to TicketLelo Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B132B] text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
