"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCertificate } from "@/lib/certificates";

export default function VerifyCertificatePage() {
  const { id } = useParams();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getCertificate(id);
        if (!data) {
          setError("Certificate not found in TicketLelo verification database.");
        } else {
          setCert(data);
        }
      } catch (err) {
        setError(err.message || "Failed to load certificate");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDownloadPDF = () => {
    if (!id) return;
    window.open(`/api/certificates/${id}/download`, "_blank");
  };

  const formattedDate = cert?.issuedAt?.toDate
    ? cert.issuedAt.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Verified on platform";

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="text-sm text-slate-400">Verifying credential against registry...</p>
          </div>
        ) : error || !cert ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
            <p className="text-sm text-slate-400 mb-6">{error || "Invalid Certificate ID."}</p>
            <Link href="/">
              <Button variant="outline" className="text-slate-300 border-slate-700">
                <ArrowLeft className="w-4 h-4 mr-2" /> Return to TicketLelo Home
              </Button>
            </Link>
          </div>
        ) : (
          <div>
            {/* Header Status Badge */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-700/60 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    Verified Credential
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </h1>
                  <p className="text-xs text-slate-400 font-mono">{cert.certificateId || cert.id}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Official Record
              </span>
            </div>

            {/* Recipient Details */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Recipient Name
                </label>
                <p className="text-2xl font-extrabold text-blue-400">{cert.buyerName}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Event
                  </label>
                  <p className="text-sm font-medium text-slate-200">{cert.eventTitle}</p>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Track / Recognition
                  </label>
                  <p className="text-sm font-medium text-slate-200">{cert.subEventTitle || "All Access"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Issue Date
                  </label>
                  <p className="text-sm font-medium text-slate-300 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formattedDate}
                  </p>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Issuer
                  </label>
                  <p className="text-sm font-medium text-slate-300 flex items-center gap-1.5 mt-0.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    {cert.issuerName || "TicketLelo Operations"}
                  </p>
                </div>
              </div>
            </div>

            {/* Download and Share Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-700/60">
              <Button
                onClick={handleDownloadPDF}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Download Official PDF
              </Button>
              <Link href="/" className="sm:w-auto">
                <Button variant="outline" className="w-full text-slate-300 border-slate-700 hover:bg-slate-800">
                  TicketLelo Platform
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
