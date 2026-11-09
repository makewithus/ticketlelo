"use client";

import React from "react";

/**
 * Base Skeleton primitive
 * Smooth pulse animation with theme-adaptive colors.
 */
export function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200/80 dark:bg-[#212428] ${className}`}
      {...props}
    />
  );
}

/**
 * Event Control Sub-Navigation Header Skeleton
 * Matches the breadcrumbs, title, status pill, and sub-tabs in admin views.
 */
export function EventControlHeaderSkeleton({ activeTab = "Overview" }) {
  const tabs = ["Overview", "Guests", "Registration", "Blasts", "Insights", "Payouts", "More"];

  return (
    <div className="mb-6 space-y-4">
      {/* Breadcrumb line */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-14 rounded-md" />
        <span className="text-[#9B9EA4]/40 text-xs">&gt;</span>
        <Skeleton className="h-3 w-28 rounded-md" />
      </div>

      {/* Title & Top Right Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 sm:h-8 w-48 sm:w-64 rounded-xl" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>

      {/* Sub-tabs Row */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#2A2D31] pb-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <div
            key={tab}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              tab === activeTab
                ? "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30"
                : "text-slate-400 dark:text-[#71767B]"
            }`}
          >
            {tab}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Event Overview Page Skeleton
 * Matches `src/app/(app)/admin/overview/page.jsx`.
 */
export function OverviewSkeleton() {
  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full text-white pb-16 animate-fade-in">
      {/* Sub-Nav Header */}
      <EventControlHeaderSkeleton activeTab="Overview" />

      {/* 3 Top Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm"
          >
            <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Main Layout: Event Preview & When & Where */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left Card: Event Preview Card */}
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Poster Banner (Aspect square matching EventBanner) */}
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-[#131517] border border-slate-200/60 dark:border-[#2A2D31]">
              <Skeleton className="w-full h-full rounded-2xl" />
            </div>

            {/* Title & Details */}
            <div className="space-y-2">
              <Skeleton className="h-6 w-3/4 rounded-xl" />
              <Skeleton className="h-4 w-1/2 rounded-lg" />
              <Skeleton className="h-4 w-2/3 rounded-lg" />
            </div>

            {/* Registration Preview Box */}
            <div className="bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-3.5 space-y-2.5">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-3.5 w-48 rounded-md" />
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {/* Public Link Box */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] rounded-xl px-3 py-2">
              <Skeleton className="h-3.5 w-40 rounded-md" />
              <Skeleton className="h-6 w-14 rounded-lg shrink-0" />
            </div>

            {/* Social Share Row */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#2A2D31]">
              <Skeleton className="h-3 w-20 rounded-md" />
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="w-6 h-6 rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: When & Where */}
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <Skeleton className="h-4 w-28 rounded-md" />

            {/* Date Block */}
            <div className="flex items-start gap-3.5">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-3.5 w-48 rounded-md" />
              </div>
            </div>

            {/* Venue Row */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-3 w-32 rounded-md" />
              </div>
              <Skeleton className="h-6 w-14 rounded-lg shrink-0" />
            </div>

            {/* Map Preview Box */}
            <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-slate-100 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] flex flex-col justify-between p-3">
              <Skeleton className="h-6 w-28 rounded-lg" />
              <div className="space-y-2 opacity-50">
                <Skeleton className="h-2.5 w-3/4 rounded-full" />
                <Skeleton className="h-2 w-1/2 rounded-full" />
              </div>
              <Skeleton className="h-6 w-36 rounded-lg self-end" />
            </div>

            <Skeleton className="h-3 w-56 rounded-md mx-auto" />
          </div>

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-2.5">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Invites Section */}
      <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-5 shadow-sm flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-64 rounded-md" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Organiser Dashboard Events Skeleton
 * Matches `src/app/(app)/admin/dashboard/page.jsx` & `event-management.jsx`.
 */
export function DashboardEventsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 sm:h-8 w-44 rounded-xl" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 shadow-sm"
          >
            <Skeleton className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-3.5 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Event Management Section Header & Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Skeleton className="h-7 w-32 rounded-xl" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-48 sm:w-64 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>

        {/* Event Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
            >
              {/* Event Poster Banner */}
              <div className="w-full h-44 sm:h-48 bg-slate-100 dark:bg-[#131517] relative">
                <Skeleton className="w-full h-full rounded-none" />
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <Skeleton className="h-5 w-3/4 rounded-lg" />
                <Skeleton className="h-3.5 w-1/2 rounded-md" />

                {/* Capacity Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-20 rounded-md" />
                    <Skeleton className="h-3 w-14 rounded-md" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 border-t border-slate-100 dark:border-[#2A2D31] flex items-center justify-between gap-2">
                <Skeleton className="h-8 flex-1 rounded-xl" />
                <Skeleton className="h-8 w-20 rounded-xl" />
                <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Event Registrations & Guests Page Skeleton
 * Matches `src/app/(app)/admin/registrations/page.jsx`.
 */
export function RegistrationsSkeleton() {
  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full text-white pb-16 animate-fade-in">
      {/* Sub-Nav Header */}
      <EventControlHeaderSkeleton activeTab="Guests" />

      {/* 4 Metric Pill Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((k) => (
          <div
            key={k}
            className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-4 space-y-2 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="w-7 h-7 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        ))}
      </div>

      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <Skeleton className="h-10 w-full sm:w-72 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* Guest Table Container */}
      <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#2A2D31] flex items-center justify-between text-xs">
          <Skeleton className="h-4 w-28 rounded-md" />
          <div className="hidden sm:flex gap-16">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <Skeleton className="h-4 w-14 rounded-md" />
        </div>

        {/* 6 Shimmering Guest Rows */}
        <div className="divide-y divide-slate-100 dark:divide-[#2A2D31]/60">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div
              key={row}
              className="px-5 py-3.5 flex items-center justify-between gap-3"
            >
              {/* Attendee Avatar & Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Skeleton className="h-3.5 w-32 rounded-md" />
                  <Skeleton className="h-3 w-44 rounded-md" />
                </div>
              </div>

              {/* Ticket Type */}
              <div className="hidden sm:block w-28">
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>

              {/* Status Pill */}
              <div className="hidden md:block w-24">
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-16 rounded-lg" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Event Analytics Page Skeleton
 * Matches `src/app/(app)/admin/analytics/page.jsx`.
 */
export function AnalyticsSkeleton() {
  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full text-white pb-16 animate-fade-in">
      {/* Sub-Nav Header */}
      <EventControlHeaderSkeleton activeTab="Insights" />

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
            <Skeleton className="h-7 sm:h-8 w-20 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        ))}
      </div>

      {/* 2 Large Chart Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 1: Attendance Trends */}
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-xl" />
          </div>
          <div className="h-60 rounded-xl bg-slate-50 dark:bg-[#131517] p-4 flex items-end gap-3 justify-between">
            {[40, 65, 30, 80, 55, 90, 70, 85].map((h, idx) => (
              <div
                key={idx}
                className="flex-1 bg-slate-200 dark:bg-[#212428] rounded-t-lg animate-pulse"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Chart 2: Ticket Distribution */}
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-xl" />
          </div>
          <div className="h-60 rounded-xl bg-slate-50 dark:bg-[#131517] p-6 flex items-center justify-center">
            <div className="w-36 h-36 rounded-full border-8 border-slate-200 dark:border-[#212428] border-t-[#FE760B]/40 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Public Discover Events Skeleton
 * Matches `src/app/(app)/discover/page.jsx`.
 */
export function DiscoverSkeleton() {
  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Search & Hero Bar */}
      <div className="space-y-4 text-center max-w-2xl mx-auto">
        <Skeleton className="h-9 sm:h-10 w-64 rounded-xl mx-auto" />
        <Skeleton className="h-4 w-80 rounded-md mx-auto" />
        <Skeleton className="h-12 w-full rounded-2xl mx-auto" />
      </div>

      {/* Category Pills */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-2">
        {[1, 2, 3, 4, 5, 6].map((c) => (
          <Skeleton key={c} className="h-8 w-24 rounded-full shrink-0" />
        ))}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl overflow-hidden shadow-sm space-y-3 pb-4"
          >
            <div className="w-full h-44 bg-slate-100 dark:bg-[#131517]">
              <Skeleton className="w-full h-full rounded-none" />
            </div>
            <div className="px-4 space-y-2">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-5 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Super Admin Management Table Skeleton
 * Matches Organisers, Plans, Hosting requests, Payments, and Support.
 */
export function SuperAdminTableSkeleton() {
  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-5 space-y-2 shadow-sm"
          >
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Skeleton className="h-10 w-full sm:w-72 rounded-xl" />
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#2A2D31] flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-[#2A2D31]/60">
          {[1, 2, 3, 4, 5].map((r) => (
            <div key={r} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3 w-48 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * User Dashboard Page Skeleton
 * Matches `src/app/(app)/(user)/dashboard/page.jsx`.
 */
export function UserDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#131517] animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56 rounded-xl" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>

        {/* 4 Metric Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-4 space-y-2"
            >
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-7 w-12 rounded-md" />
            </div>
          ))}
        </div>

        {/* Ticket Stubs / Deck Skeleton */}
        <div className="max-w-xl mx-auto space-y-4 pt-4">
          {[1, 2].map((k) => (
            <div
              key={k}
              className="w-full h-48 rounded-3xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-5 flex items-center justify-between shadow-sm"
            >
              <div className="space-y-3 flex-1">
                <Skeleton className="h-5 w-3/4 rounded-lg" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
                <Skeleton className="h-3.5 w-1/3 rounded-md" />
              </div>
              <Skeleton className="w-24 h-24 rounded-2xl shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Public Event Page Skeleton
 * Matches `src/app/(app)/e/[slug]/page.jsx` & `register/[eventId]/page.jsx`.
 */
export function EventPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white animate-fade-in">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        {/* Top Mini Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-28 rounded-xl" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>

        {/* Event Poster Banner */}
        <div className="w-full aspect-video sm:aspect-[21/9] rounded-3xl bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] overflow-hidden">
          <Skeleton className="w-full h-full rounded-none" />
        </div>

        {/* Event Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-32 rounded-md" />
            </div>
            <Skeleton className="h-8 sm:h-10 w-3/4 rounded-2xl" />
            <div className="flex items-center gap-3 pt-2">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-md" />
              </div>
            </div>
            {/* Description placeholder */}
            <div className="space-y-2.5 pt-4">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
          </div>

          {/* Right Action Card */}
          <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-3xl p-5 sm:p-6 space-y-4 h-fit shadow-lg">
            <Skeleton className="h-5 w-32 rounded-md" />
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3.5 w-32 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3.5 w-36 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
              </div>
            </div>
            <Skeleton className="h-12 w-full rounded-2xl pt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Ticket Detail Page Skeleton
 * Matches `src/app/(app)/tickets/[ticketId]/page.jsx`.
 */
export function TicketDetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#131517] text-white flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="w-full max-w-xl space-y-6">
        {/* Top Back Action */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        {/* Main Ticket Stub Card */}
        <div className="w-full rounded-3xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-6 shadow-2xl flex flex-col sm:flex-row gap-6 items-center justify-between">
          <div className="space-y-3 flex-1 w-full">
            <Skeleton className="h-6 w-3/4 rounded-xl" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <div className="pt-2">
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
          </div>
          <Skeleton className="w-36 h-36 rounded-2xl shrink-0" />
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl col-span-2 sm:col-span-1" />
        </div>
      </div>
    </div>
  );
}

/**
 * More / Customize Event Settings Skeleton
 * Matches `src/app/(app)/admin/customize/page.jsx`.
 */
export function MoreSettingsSkeleton() {
  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full space-y-6 animate-fade-in pb-24">
      {/* Event Header & Nav Tabs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-64 rounded-xl" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#2A2D31]/80 pb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Public Link & Custom URL Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] p-6 space-y-4">
        <Skeleton className="h-5 w-40 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md" />
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-32 rounded-xl" />
        </div>
      </div>

      {/* Close Registration Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-48 rounded-lg" />
            <Skeleton className="h-4 w-80 rounded-md" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      </div>

      {/* Embed Button Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] p-6 space-y-4">
        <Skeleton className="h-5 w-36 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-md" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default Skeleton;
