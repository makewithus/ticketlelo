"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  LogOut,
  Ticket,
  Filter,
  CalendarDays,
  TicketCheck,
  Search,
} from "lucide-react";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { useAuth } from "@/context/auth-context";
import { getEvent, subscribeToUserRegistrations } from "@/lib/firestore";
import Link from "next/link";

const LOGO_SRC = "/logo/Ticket%E0%A4%B2%E0%A5%87%E0%A4%B2%E0%A5%8B-final.png";

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    console.log(" DASHBOARD - User state from useAuth():");
    console.log("   User:", user);
    console.log("   User Email:", user?.email);
    console.log("   User ID:", user?.id);
    console.log("   User Role:", user?.role);
    console.log("   Auth Loading:", authLoading);

    if (!authLoading && !user) {
      console.log(" No user found, redirecting to user login");
      router.push("/user-login");
    }

    // Redirect super admin to super admin panel
    if (!authLoading && user && user.role === "superAdmin") {
      console.log(" Super Admin detected, redirecting to super admin panel");
      router.push("/superadmin");
    }

    // Redirect organiser to admin panel (ONLY if role is explicitly "organiser")
    if (!authLoading && user && user.role === "organiser") {
      console.log(" Organiser detected, redirecting to admin panel");
      router.push("/admin/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !user.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribe = subscribeToUserRegistrations(user.id, async (regs) => {
      setRegistrations(regs);
      const eventsMap = new Map();
      for (const reg of regs) {
        if (!eventsMap.has(reg.eventId)) {
          const event = await getEvent(reg.eventId);
          if (event) eventsMap.set(reg.eventId, event);
        }
      }
      setEvents(eventsMap);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  if (authLoading || isLoading) {
    return (
      <main className="tl-system-theme flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 opacity-0 animate-fade-in">
          <div className="tl-auth-icon flex h-16 w-16 items-center justify-center animate-pulse-glow">
            <Ticket className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-[#3157ff]" />
          <p className="text-[rgba(6,26,63,0.64)]">Loading your tickets...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const filteredRegistrations = registrations.filter((reg) => {
    if (filter === "All") return true;
    return reg.status === filter;
  });

  const unusedCount = registrations.filter((r) => r.status === "Unused").length;
  const usedCount = registrations.filter((r) => r.status === "Used").length;

  return (
    <main className="tl-system-theme min-h-screen transition-colors">
      {/* Header */}
      <header className="sticky top-0 inset-x-0 z-50 border-b border-[var(--tl-line)] bg-[var(--tl-paper)]/95 backdrop-blur">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <img src={LOGO_SRC} alt="TicketLelo" className="h-12 w-auto object-contain" />
          </Link>
          <div className="flex gap-3 items-center">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3157ff]/10 border border-[#3157ff]/20">
              <div className="w-2 h-2 rounded-full bg-[#3157ff] animate-pulse" />
              <span className="text-sm text-[rgba(6,26,63,0.72)]">{user.email}</span>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="h-10 gap-2 border-[var(--tl-line)] text-[#061a3f] hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all rounded-lg"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </nav>
      </header>

      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Welcome */}
          <div className="mb-10 opacity-0 animate-fade-in-up">
            <h1 className="text-4xl font-extrabold mb-2 text-[#061a3f]">
              Welcome, <span className="text-[#ff0084]">{user.fullName}</span>
            </h1>
            <p className="text-[rgba(6,26,63,0.64)] text-lg">
              Your event tickets, all in one place.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              {
                label: "Total Tickets",
                value: registrations.length,
                icon: Ticket,
                iconBg: "bg-[#3157ff]",
              },
              {
                label: "Upcoming",
                value: unusedCount,
                icon: CalendarDays,
                iconBg: "bg-[#ff0084]",
              },
              {
                label: "Used",
                value: usedCount,
                icon: TicketCheck,
                iconBg: "bg-[#008d46]",
              },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`tl-auth-card p-5 opacity-0 animate-fade-in-up stagger-${i + 1}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[rgba(6,26,63,0.64)] mb-1">{stat.label}</p>
                    <p className="text-3xl font-extrabold text-[#061a3f]">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-lg ${stat.iconBg} flex items-center justify-center shadow-lg`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-3 mb-8 opacity-0 animate-fade-in-up stagger-4">
            <Filter className="w-4 h-4 text-[rgba(6,26,63,0.56)]" />
            {[
              { key: "All", label: `All (${registrations.length})` },
              { key: "Unused", label: `Upcoming (${unusedCount})` },
              { key: "Used", label: `Used (${usedCount})` },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filter === f.key
                    ? "bg-[#3157ff] text-white border border-[#3157ff]"
                    : "text-[rgba(6,26,63,0.68)] hover:text-[#061a3f] border border-transparent hover:border-[#3157ff]/20 hover:bg-[#3157ff]/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Tickets Grid */}
          {filteredRegistrations.length === 0 ? (
            <div className="text-center py-20 opacity-0 animate-fade-in">
              <div className="w-20 h-20 rounded-lg bg-[#3157ff]/10 flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-[#3157ff]" />
              </div>
              <h3 className="text-2xl font-bold text-[#061a3f] mb-2">
                No tickets found
              </h3>
              <p className="text-[rgba(6,26,63,0.64)] mb-6">
                {filter === "All"
                  ? "You haven't registered for any events yet."
                  : `No ${filter.toLowerCase()} tickets.`}
              </p>
              {filter === "All" && (
                <Link href="/">
                  <Button className="tl-primary-action h-11 font-bold gap-2">
                    Browse Events
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRegistrations.map((registration, i) => {
                const event = events.get(registration.eventId);
                if (!event) return null;
                return (
                  <div
                    key={registration.id}
                    className={`opacity-0 animate-fade-in-up stagger-${Math.min(i + 1, 6)} h-full`}
                  >
                    <TicketCard registration={registration} event={event} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
