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
import { BrandLoader } from "@/components/ui/brand-loader";

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
    <div className="min-h-screen bg-[#131517] text-white flex flex-col items-center justify-center p-4 selection:bg-[#FE760B] selection:text-white">
      {/* Ambient faint top glow */}
      <div className="fixed top-0 inset-x-0 h-80 bg-gradient-to-b from-[#FE760B]/10 via-[#FE760B]/5 to-transparent pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 xs:p-6 sm:p-8 shadow-sm">
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <BrandLoader message="Loading..." fullScreen={false} />
          </div>
        ) : error || !cert ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full bg-[#FF6B6B]/15 border border-[#FF6B6B]/25 text-[#FF9A9A] flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verification failed</h1>
            <p className="text-sm text-[#9B9EA4] mb-6">{error || "Invalid Certificate ID."}</p>
            <Link href="/">
              <Button variant="outline" className="text-white border-[#2A2D31] bg-[#212327] hover:bg-[#2A2D31] rounded-xl text-xs">
                <ArrowLeft className="w-4 h-4 mr-2" /> Return to TicketLelo home
              </Button>
            </Link>
          </div>
        ) : (
          <div>
            {/* Header Status Badge */}
            <div className="flex items-center justify-between pb-6 border-b border-[#2A2D31] mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3DD68C]/15 border border-[#3DD68C]/25 text-[#3DD68C] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-white flex items-center gap-2">
                    Verified credential
                    <CheckCircle2 className="w-4 h-4 text-[#3DD68C]" />
                  </h1>
                  <p className="text-xs text-[#9B9EA4] font-mono">{cert.certificateId || cert.id}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#3DD68C]/12 text-[#3DD68C]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                Official record
              </span>
            </div>

            {/* Recipient Details */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs uppercase tracking-[0.6px] text-[#9B9EA4] font-semibold">
                  Recipient name
                </label>
                <p className="text-2xl font-bold text-white mt-0.5">{cert.buyerName}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.6px] text-[#9B9EA4] font-semibold">
                    Event
                  </label>
                  <p className="text-sm font-medium text-[#D0D0D1] mt-0.5">{cert.eventTitle}</p>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.6px] text-[#9B9EA4] font-semibold">
                    Track / recognition
                  </label>
                  <p className="text-sm font-medium text-[#D0D0D1] mt-0.5">{cert.subEventTitle || "All Access"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.6px] text-[#9B9EA4] font-semibold">
                    Issue date
                  </label>
                  <p className="text-sm font-medium text-[#D0D0D1] flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-[#FDE003]" />
                    {formattedDate}
                  </p>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.6px] text-[#9B9EA4] font-semibold">
                    Issuer
                  </label>
                  <p className="text-sm font-medium text-[#D0D0D1] flex items-center gap-1.5 mt-0.5">
                    <Award className="w-3.5 h-3.5 text-[#FE760B]" />
                    {cert.issuerName || "TicketLelo Operations"}
                  </p>
                </div>
              </div>
            </div>

            {/* Download and Share Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#2A2D31]">
              <Button
                onClick={handleDownloadPDF}
                className="flex-1 bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] font-semibold py-2.5 rounded-xl shadow-none transition-colors flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download official PDF
              </Button>
              <Link href="/" className="sm:w-auto">
                <Button variant="outline" className="w-full text-[#D0D0D1] hover:text-white border-[#2A2D31] bg-[#212327] hover:bg-[#2A2D31] rounded-xl text-xs">
                  TicketLelo platform
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
