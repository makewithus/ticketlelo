"use client";

import { useState } from "react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { RegistrationStudio } from "@/components/admin/registration-studio";
import { FormGenerator } from "@/components/admin/form-generator";
import { Sliders, Sparkles } from "lucide-react";

export default function FormGeneratorPage() {
  const [viewMode, setViewMode] = useState("studio"); // "studio" | "advanced"

  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-white selection:bg-[#FE760B] selection:text-white pb-16">
      {/* ── Standard Navigation Header (Registration Tab active) ── */}
      <EventControlHeader activeTab="Registration" />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Registration Form Builder
          </h2>
          <p className="text-xs text-[#9B9EA4] mt-0.5">
            Customize the attendee questions and registration requirements for this event
          </p>
        </div>
      </div>

      <RegistrationStudio />
    </div>
  );
}
