"use client";

import { useState } from "react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { RegistrationStudio } from "@/components/admin/registration-studio";
import { FormGenerator } from "@/components/admin/form-generator";
import { Sliders, Sparkles } from "lucide-react";

export default function FormGeneratorPage() {
  const [viewMode, setViewMode] = useState("studio"); // "studio" | "advanced"

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-white selection:bg-[#FE760B] selection:text-white pb-16">
      {/* ── Standard Navigation Header (Registration Tab active) ── */}
      <EventControlHeader activeTab="Registration" />

      {/* Header and Mode Switcher */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Registration &amp; Tickets
          </h2>
          <p className="text-xs text-[#9B9EA4] mt-0.5">
            Configure attendee questions, ticket types, personal info requirements, and approval rules
          </p>
        </div>

        <button
          type="button"
          onClick={() => setViewMode(viewMode === "studio" ? "advanced" : "studio")}
          className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-[#D0D0D1] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Sliders size={13} className="text-[#FE760B]" />
          <span>{viewMode === "studio" ? "Advanced Settings" : "Standard View"}</span>
        </button>
      </div>

      {viewMode === "studio" ? <RegistrationStudio /> : <FormGenerator />}
    </div>
  );
}
