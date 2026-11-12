"use client";

import { useState, useEffect, use } from "react";
import { Loader2, Award, Users } from "lucide-react";

export default function EmbedLeaderboardPage({ params }) {
  const unwrappedParams = use(params);
  const programId = unwrappedParams.programId;

  const [leaderboard, setLeaderboard] = useState([]);
  const [programName, setProgramName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/public/leaderboard/${programId}`);
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || []);
          setProgramName(data.programName || "Leaderboard");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [programId]);

  return (
    <div className="w-full h-full min-h-[400px] p-3 sm:p-4 bg-transparent text-slate-900 dark:text-white font-sans text-xs">
      <div className="bg-white/95 dark:bg-[#1A1C1F]/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-[#2A2D31] shadow-lg overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 dark:border-[#2A2D31] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FE760B] animate-pulse" />
            <h2 className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {programName}
            </h2>
          </div>
          <span className="text-[10px] uppercase font-bold text-[#FE760B] tracking-wider">
            Live Rankings
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
          </div>
        ) : leaderboard.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-xs">No ambassador points yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#2A2D31]/80 max-h-[500px] overflow-y-auto">
            {leaderboard.map((amb) => {
              const rankBadge = {
                1: "bg-amber-400 text-black font-extrabold",
                2: "bg-slate-300 text-black font-bold",
                3: "bg-amber-700 text-white font-bold",
              }[amb.rank] || "bg-slate-100 dark:bg-[#212327] text-slate-500 dark:text-[#9B9EA4]";

              return (
                <div key={amb.rank} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 ${rankBadge}`}>
                      {amb.rank}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {amb.displayName}
                    </span>
                  </div>
                  <span className="font-bold font-mono text-[#FE760B] tabular-nums shrink-0">
                    {amb.totalPoints?.toLocaleString("en-IN") || 0} pts
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-2 border-t border-slate-100 dark:border-[#2A2D31] text-[10px] text-center text-slate-400">
          Powered by TicketLelo
        </div>
      </div>
    </div>
  );
}

