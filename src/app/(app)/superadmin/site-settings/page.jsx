"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_COUNTDOWN_AT = "2026-11-04T18:30:00+05:30";

function toLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getMinimumDateTime() {
  const nextMinute = new Date(Math.ceil(Date.now() / 60_000) * 60_000);
  return toLocalInput(nextMinute.toISOString());
}

export default function SiteSettingsPage() {
  const [countdownAt, setCountdownAt] = useState("");
  const [minimumDateTime, setMinimumDateTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const refreshMinimum = () => {
      const minimum = getMinimumDateTime();
      setMinimumDateTime(minimum);
      setCountdownAt((current) => (current && current < minimum ? minimum : current));
    };
    refreshMinimum();
    const minimumInterval = window.setInterval(refreshMinimum, 60_000);
    let active = true;
    fetch("/api/site-settings/countdown", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the saved countdown date.");
        return response.json();
      })
      .then((settings) => {
        if (active) {
          const minimum = getMinimumDateTime();
          setMinimumDateTime(minimum);
          const configured = toLocalInput(settings.countdownAt || DEFAULT_COUNTDOWN_AT);
          setCountdownAt(configured < minimum ? minimum : configured);
        }
      })
      .catch((error) => {
        if (active) {
          const minimum = getMinimumDateTime();
          setMinimumDateTime(minimum);
          const configured = toLocalInput(DEFAULT_COUNTDOWN_AT);
          setCountdownAt(configured < minimum ? minimum : configured);
          toast.error(error.message);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      window.clearInterval(minimumInterval);
    };
  }, []);

  const saveSettings = async (event) => {
    event.preventDefault();
    if (
      !countdownAt ||
      Number.isNaN(new Date(countdownAt).getTime()) ||
      new Date(countdownAt).getTime() < Date.now()
    ) {
      toast.error("Choose a future date and time.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/site-settings/countdown", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countdownAt: new Date(countdownAt).toISOString() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save homepage settings.");
      toast.success("Homepage countdown updated.");
    } catch (error) {
      toast.error(error.message || "Could not save homepage settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">Site Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Manage the homepage countdown date and time.</p>
      </header>

      <form onSubmit={saveSettings} className="tl-auth-card space-y-5 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3157ff]/10 text-[#3157ff]"><CalendarClock size={20} /></span>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-slate-100">Homepage countdown</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Set when the countdown on the public homepage should end.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="countdownAt" className="block text-sm font-semibold text-gray-700 dark:text-slate-300">End date and time</label>
          <input
            id="countdownAt"
            name="countdownAt"
            type="datetime-local"
            required
            min={minimumDateTime}
            value={countdownAt}
            onChange={(event) => setCountdownAt(event.target.value)}
            disabled={loading || saving}
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-gray-900 shadow-sm outline-none focus:border-[#3157ff] focus:ring-2 focus:ring-[#3157ff]/20 disabled:opacity-60 dark:[color-scheme:dark]"
          />
          <p className="text-xs text-gray-500 dark:text-slate-400">Selected using your device&apos;s local timezone; visitors see the same moment in their timezone.</p>
        </div>

        <button type="submit" disabled={loading || saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#3157ff] px-5 font-semibold text-white transition hover:bg-[#2447e8] disabled:cursor-not-allowed disabled:opacity-60">
          {loading || saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
