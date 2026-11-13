"use client";

import { useState, useEffect, useMemo, use } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Trophy,
  Award,
  Sparkles,
  Share2,
  ArrowLeft,
  Users,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Flame,
  ShieldCheck,
  GraduationCap,
  Calendar,
  Ticket,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function PublicProgramLeaderboardPage({ params }) {
  const unwrappedParams = use(params);
  const programId = unwrappedParams.programId;

  const [leaderboard, setLeaderboard] = useState([]);
  const [programInfo, setProgramInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const res = await fetch(`/api/public/leaderboard/${programId}`);
        if (!res.ok) {
          throw new Error("Failed to load program leaderboard");
        }
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setProgramInfo({
          name: data.programName || data.programTitle || "Campus Ambassador Leaderboard",
          description: data.description || "Live rankings of verified campus ambassadors based on verified ticket referrals and milestone achievement.",
          college: data.college || "",
          stats: data.stats || {
            totalAmbassadors: (data.leaderboard || []).length,
            totalPoints: (data.leaderboard || []).reduce((acc, curr) => acc + (curr.totalPoints || 0), 0),
          },
        });
      } catch (err) {
        setError(err.message || "Could not load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    loadLeaderboard();
  }, [programId]);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${programInfo?.name || "Campus Ambassador"} Leaderboard | TicketLelo`,
          text: `Check out the official rankings for ${programInfo?.name || "our program"} on TicketLelo!`,
          url,
        });
        return;
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("Share failed, falling back to copy:", err);
        }
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success("Leaderboard link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;
    const q = searchQuery.toLowerCase().trim();
    return leaderboard.filter(
      (a) =>
        (a.displayName || "").toLowerCase().includes(q) ||
        (a.college || "").toLowerCase().includes(q)
    );
  }, [leaderboard, searchQuery]);

  const top1 = leaderboard[0] || null;
  const top2 = leaderboard[1] || null;
  const top3 = leaderboard[2] || null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white selection:bg-[#FE760B] selection:text-white transition-colors">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#131517]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#2A2D31]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <Image
                src="/logo/ticketlelo-logo-nav.png"
                alt="TicketLelo"
                width={112}
                height={32}
                className="h-7 w-auto object-contain"
                priority
              />
            </Link>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-[#2A2D31] text-xs">
              <Link
                href="/discover"
                className="text-slate-600 dark:text-[#9B9EA4] hover:text-[#FE760B] dark:hover:text-[#FE760B] transition-colors"
              >
                Discover Events
              </Link>
              <span className="text-slate-300 dark:text-[#4A4E54]">•</span>
              <span className="text-slate-900 dark:text-white font-semibold">Campus Leaderboard</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="h-9 px-3 sm:px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2D31] transition-all shadow-xs cursor-pointer shrink-0"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5 text-[#FE760B]" />}
              <span className="hidden sm:inline">{copiedLink ? "Copied Link" : "Share"}</span>
            </button>
            <ThemeToggle />
            <Link href="/ambassador/dashboard" className="shrink-0">
              <button
                type="button"
                className="h-9 px-3 sm:px-4 rounded-xl text-xs font-bold bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <span className="hidden sm:inline">Ambassador Portal</span>
                <span className="sm:hidden">Portal</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
        {/* ── Hero Section ── */}
        <section className="relative rounded-3xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-6 sm:p-10 shadow-xl overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-48 bg-gradient-to-b from-[#FE760B]/12 via-[#FE760B]/5 to-transparent blur-2xl pointer-events-none" />

          <div className="relative z-10 text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/30">
              <Trophy className="w-3.5 h-3.5" />
              <span>Official Campus Rankings</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
              {programInfo?.name || "Campus Ambassador Leaderboard"}
            </h1>

            {programInfo?.college && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
                <GraduationCap className="w-4 h-4 text-[#FE760B]" />
                <span>Campus Focus: {programInfo.college}</span>
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] max-w-2xl mx-auto leading-relaxed">
              {programInfo?.description}
            </p>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 max-w-lg mx-auto">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4] block">
                  Ambassadors
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {programInfo?.stats?.totalAmbassadors || leaderboard.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4] block">
                  Total Points
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-[#FE760B] tabular-nums font-mono">
                  {(programInfo?.stats?.totalPoints || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-center flex flex-col justify-center items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4] block">
                  Status
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live in IST</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Podium Spotlight (Top 3) ── */}
        {!loading && leaderboard.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-[#9B9EA4] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FE760B]" />
                <span>Top Campus Leaders</span>
              </h2>
            </div>

            {/* If 1 ambassador only: Single Grand Hero Card */}
            {leaderboard.length === 1 && top1 && (
              <div className="relative rounded-3xl bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/10 dark:via-[#1A1C1F] dark:to-[#1A1C1F] border-2 border-amber-500/40 p-6 sm:p-8 shadow-xl max-w-xl mx-auto text-center space-y-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-black font-black text-2xl sm:text-3xl flex items-center justify-center mx-auto shadow-lg relative">
                  <span>{top1.avatarInitial || top1.displayName?.charAt(0) || "👑"}</span>
                  <span className="absolute -top-2.5 -right-1 text-xl sm:text-2xl drop-shadow-md">👑</span>
                </div>

                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-400 text-black shadow-xs">
                    Rank #1 • Top Creator
                  </span>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                    {top1.displayName}
                  </h3>
                  {top1.college && (
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] flex items-center justify-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span>{top1.college}</span>
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-amber-500/20 max-w-xs mx-auto">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#FE760B] font-mono tabular-nums">
                    {(top1.totalPoints || 0).toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-[#9B9EA4] block font-medium">
                    Verified Referral Points
                  </span>
                </div>
              </div>
            )}

            {/* If 2 or more ambassadors: Multi-Podium View */}
            {leaderboard.length >= 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-4">
                {/* 2nd Place */}
                {top2 && (
                  <div className="order-2 sm:order-1 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-5 shadow-lg text-center space-y-3 relative">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                      🥈 Rank #2
                    </span>
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-lg flex items-center justify-center mx-auto">
                      {top2.avatarInitial || top2.displayName?.charAt(0) || "2"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {top2.displayName}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate">
                        {top2.college || "Campus Ambassador"}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-[#2A2D31]">
                      <span className="text-lg font-bold text-[#FE760B] font-mono tabular-nums">
                        {(top2.totalPoints || 0).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-slate-400 block">points</span>
                    </div>
                  </div>
                )}

                {/* 1st Place (Center & Elevated on Desktop, Top on Mobile) */}
                {top1 && (
                  <div className="order-1 sm:order-2 rounded-2xl bg-gradient-to-b from-amber-500/15 to-white dark:to-[#1A1C1F] border-2 border-amber-500/40 p-6 shadow-xl text-center space-y-3 relative sm:-mt-4">
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-md flex items-center gap-1">
                      <span>👑</span>
                      <span>Rank #1</span>
                    </span>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-black font-extrabold text-xl flex items-center justify-center mx-auto shadow-md">
                      {top1.avatarInitial || top1.displayName?.charAt(0) || "1"}
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                        {top1.displayName}
                      </h4>
                      <p className="text-xs text-[#FE760B] font-semibold truncate">
                        {top1.college ? `${top1.college} • Top Creator` : "Top Creator"}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-amber-500/20">
                      <span className="text-2xl font-extrabold text-[#FE760B] font-mono tabular-nums">
                        {(top1.totalPoints || 0).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-[#9B9EA4] block font-medium">points</span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {top3 && (
                  <div className="order-3 sm:order-3 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-5 shadow-lg text-center space-y-3 relative">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-800 text-white border border-amber-700">
                      🥉 Rank #3
                    </span>
                    <div className="w-12 h-12 rounded-full bg-amber-800/20 text-amber-500 border border-amber-700/30 font-bold text-lg flex items-center justify-center mx-auto">
                      {top3.avatarInitial || top3.displayName?.charAt(0) || "3"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {top3.displayName}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate">
                        {top3.college || "Campus Ambassador"}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-[#2A2D31]">
                      <span className="text-lg font-bold text-[#FE760B] font-mono tabular-nums">
                        {(top3.totalPoints || 0).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-slate-400 block">points</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Rankings Table & Search ── */}
        <section className="bg-white dark:bg-[#1A1C1F] rounded-3xl border border-slate-200 dark:border-[#2A2D31] shadow-xl overflow-hidden space-y-4 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#2A2D31]">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Award className="w-4 h-4 text-[#FE760B]" />
                <span>Complete Standings</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                Verified ambassador referrals updated in real-time.
              </p>
            </div>

            {leaderboard.length > 3 && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ambassador..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#FE760B]"
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-[#FE760B] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-500 dark:text-[#9B9EA4]">Loading live standings...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm font-semibold text-rose-500">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-xs text-[#FE760B] hover:underline"
              >
                Try refreshing
              </button>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {searchQuery ? "No matching ambassadors" : "Leaderboard Open"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-sm mx-auto">
                {searchQuery
                  ? "Try searching with a different name or campus query."
                  : "No verified ambassador points have been recorded yet. Be the first to refer attendees!"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#2A2D31]">
              {filteredLeaderboard.map((amb) => {
                const isTop1 = amb.rank === 1;
                const isTop3 = amb.rank <= 3;
                const badgeColor =
                  amb.rank === 1
                    ? "bg-amber-400 text-black font-extrabold shadow-xs"
                    : amb.rank === 2
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold"
                    : amb.rank === 3
                    ? "bg-amber-800 text-white font-bold"
                    : "bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] font-semibold";

                return (
                  <div
                    key={amb.rank}
                    className={`py-3.5 px-3 sm:px-4 rounded-xl flex items-center justify-between gap-4 transition-colors ${
                      isTop1
                        ? "bg-amber-500/5 dark:bg-amber-500/5"
                        : "hover:bg-slate-50 dark:hover:bg-[#212327]/60"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${badgeColor}`}
                      >
                        {isTop1 ? "👑" : amb.rank}
                      </span>

                      <div className="w-8 h-8 rounded-full bg-[#FE760B]/12 text-[#FE760B] font-bold text-xs flex items-center justify-center shrink-0 border border-[#FE760B]/25">
                        {amb.avatarInitial || amb.displayName?.charAt(0) || "A"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {amb.displayName}
                          </p>
                          {isTop1 && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-500 border border-amber-400/30">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Top Creator</span>
                            </span>
                          )}
                        </div>
                        {amb.college && (
                          <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate">
                            {amb.college}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base sm:text-lg font-extrabold text-[#FE760B] tabular-nums font-mono">
                        {(amb.totalPoints || 0).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-[#9B9EA4] block">PTS</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── How Campus Ambassador Points Work ── */}
        <section className="rounded-3xl bg-slate-100/70 dark:bg-[#1A1C1F]/60 border border-slate-200 dark:border-[#2A2D31] p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FE760B]" />
                <span>How Points & Standings Work</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                Every verified ticket pass referred through an ambassador link or code awards points.
              </p>
            </div>
            <Link href="/ambassador/dashboard">
              <button
                type="button"
                className="text-xs font-bold text-[#FE760B] hover:text-[#FF8A2B] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Join Ambassador Program</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Ticket className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Free Event Registration</h4>
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                Earn <strong className="text-[#FE760B]">10 points</strong> per verified free event attendee registration.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Paid Ticket Pass</h4>
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                Earn <strong className="text-[#FE760B]">20 points</strong> for every paid ticket confirmed through checkout.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-[#FE760B]/10 text-[#FE760B] flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Milestones & Swag</h4>
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                Redeem points for exclusive campus badges, VIP passes, and organizer-sponsored merchandise.
              </p>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="text-center py-6 border-t border-slate-200 dark:border-[#2A2D31] text-xs text-slate-400 dark:text-[#9B9EA4] space-y-1">
          <p>
            Powered by <strong className="text-slate-700 dark:text-white">TicketLelo</strong> Campus Ambassador Network
          </p>
          <p className="text-[10px]">
            Rankings and point allocations are subject to event verification and anti-fraud policies.
          </p>
        </footer>
      </main>
    </div>
  );
}
