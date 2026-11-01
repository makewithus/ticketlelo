"use client";

import { EventControlHeader } from "@/components/admin/event-control-header";
import { FormGenerator } from "@/components/admin/form-generator";

export default function FormGeneratorPage() {
  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-white selection:bg-[#FE760B] selection:text-white pb-16">
      {/* ── Standard Navigation Header (Registration Tab active) ── */}
      <EventControlHeader activeTab="Registration" />

      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Form builder
        </h2>
        <p className="text-xs text-[#9B9EA4] mt-1">
          Customize the registration questions, custom fields, and form theme for your event attendees
        </p>
      </div>

      <FormGenerator />
    </div>
  );
}
