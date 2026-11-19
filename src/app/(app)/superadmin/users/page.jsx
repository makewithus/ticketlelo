"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Search,
  Shield,
  ShieldAlert,
  Building2,
  UserCheck,
  LogIn,
  ExternalLink,
  Loader2,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { authFetch, establishServerSession } from "@/lib/auth";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { BrandLoader } from "@/components/ui/brand-loader";
import { SuperAdminTableSkeleton } from "@/components/ui/skeleton";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";
import { validatePhoneNumber, formatPhoneDisplay } from "@/lib/phone-validation";

function getPaginationRange(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function SuperAdminUsersPage() {
  const router = useRouter();

  // Synchronous cache hydration for instant zero-lag rendering
  const [users, setUsers] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = getCachedItem("superadmin_users_list");
        if (Array.isArray(cached) && cached.length > 0) return cached;
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => users.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // "all" | "user" | "organiser" | "superAdmin"
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalMatching, setTotalMatching] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    attendees: 0,
    organisers: 0,
    superAdmins: 0,
  });

  const [impersonatingId, setImpersonatingId] = useState(null);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);

  // Modal State for Create User
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: "user",
  });
  const [phoneError, setPhoneError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchUsers = useCallback(
    async (page = currentPage, size = pageSize, role = roleFilter, search = searchQuery, isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else if (users.length === 0) setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(size),
          role,
          search: search.trim(),
        });

        const res = await authFetch(`/api/superadmin/users?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load users list");
        }
        const data = await res.json();
        if (data.users) {
          setUsers(data.users);
          setTotalMatching(data.total ?? data.users.length);
          setTotalPages(data.totalPages ?? 1);
          if (data.stats) {
            setStats(data.stats);
          }
          setCachedItem("superadmin_users_list", data.users, 15 * 60 * 1000);
        }
      } catch (err) {
        console.error("[UsersPage] Error fetching users:", err);
        toast.error(err.message || "Could not fetch users");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentPage, pageSize, roleFilter, searchQuery, users.length]
  );

  // Search debounce and query execution
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchUsers(1, pageSize, roleFilter, val);
    }, 300);
  };

  const handleRoleFilterChange = (newRole) => {
    setRoleFilter(newRole);
    setCurrentPage(1);
    fetchUsers(1, pageSize, newRole, searchQuery);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchUsers(newPage, pageSize, roleFilter, searchQuery);
  };

  const handlePageSizeChange = (newSize) => {
    const size = parseInt(newSize, 10);
    setPageSize(size);
    setCurrentPage(1);
    fetchUsers(1, size, roleFilter, searchQuery);
  };

  useEffect(() => {
    fetchUsers(currentPage, pageSize, roleFilter, searchQuery);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Displayed users (server-side paginated slice)
  const filteredUsers = useMemo(() => {
    return users;
  }, [users]);

  // Super Admin: Change user role
  const handleRoleChange = async (userId, newRole) => {
    setUpdatingRoleId(userId);
    try {
      const res = await authFetch("/api/superadmin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success(`Role updated to '${newRole}' successfully.`);
      fetchUsers(currentPage, pageSize, roleFilter, searchQuery, true);
    } catch (err) {
      console.error("[UsersPage] Role update error:", err);
      toast.error(err.message || "Failed to update role");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Super Admin: Impersonate user & open dashboard
  const handleImpersonate = async (targetUser) => {
    const targetUid = targetUser.uid || targetUser.id;
    setImpersonatingId(targetUid);
    try {
      const res = await authFetch("/api/superadmin/users/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log in as user");
      }

      if (!data.customToken) {
        throw new Error("No custom token received");
      }

      // Seamlessly sign in with custom token
      const cred = await signInWithCustomToken(auth, data.customToken);
      if (cred?.user) {
        await establishServerSession(cred.user);
      }

      toast.success(
        `Accessing portal for ${targetUser.fullName || targetUser.email}! Redirecting...`
      );

      // Transition to target user's appropriate portal
      setTimeout(() => {
        router.push(data.redirectUrl || "/dashboard");
      }, 700);
    } catch (err) {
      console.error("[UsersPage] Impersonate error:", err);
      toast.error(err.message || "Portal access failed");
      setImpersonatingId(null);
    }
  };

  // Super Admin: Create new user with phone validation
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setPhoneError("");

    if (!createForm.email.trim() || !createForm.password.trim()) {
      toast.error("Email and password are required.");
      return;
    }
    if (createForm.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (createForm.phone.trim()) {
      const phoneValidation = validatePhoneNumber(createForm.phone, { required: false });
      if (!phoneValidation.isValid) {
        setPhoneError(phoneValidation.error || "Invalid phone number format");
        toast.error(phoneValidation.error || "Please enter a valid phone number.");
        return;
      }
    }

    setCreateSubmitting(true);
    try {
      const res = await authFetch("/api/superadmin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      toast.success(`User '${createForm.email}' created successfully!`);
      setIsCreateModalOpen(false);
      setCreateForm({
        fullName: "",
        email: "",
        password: "",
        phone: "",
        role: "user",
      });
      setPhoneError("");
      // Refresh user list
      fetchUsers(1, pageSize, roleFilter, searchQuery, true);
    } catch (err) {
      console.error("[UsersPage] Create user error:", err);
      toast.error(err.message || "Failed to create user");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + users.length, totalMatching);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-[#2A2D31]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Users Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#212327] text-slate-700 dark:text-[#9B9EA4] border border-slate-200 dark:border-[#2A2D31]">
              {stats.total || users.length} Total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] mt-1">
            Complete system directory. Manage roles, provision accounts, and access user dashboards.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => fetchUsers(currentPage, pageSize, roleFilter, searchQuery, true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] text-slate-700 dark:text-[#D0D0D1] hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setPhoneError("");
              setIsCreateModalOpen(true);
            }}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-sm shadow-md shadow-[#FE760B]/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => handleRoleFilterChange("all")}
          className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            roleFilter === "all"
              ? "bg-[#FE760B]/10 border-[#FE760B]/60 ring-1 ring-[#FE760B]/30 shadow-sm"
              : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#3A3D42] hover:bg-slate-50 dark:hover:bg-[#212327]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-500 dark:text-[#9B9EA4] uppercase">ALL USERS</span>
            <Users className="w-4 h-4 text-slate-400 dark:text-[#9B9EA4]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {stats.total}
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleRoleFilterChange("user")}
          className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            roleFilter === "user"
              ? "bg-blue-500/10 border-blue-500/60 ring-1 ring-blue-500/30 shadow-sm"
              : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#3A3D42] hover:bg-slate-50 dark:hover:bg-[#212327]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase">ATTENDEES</span>
            <UserCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {stats.attendees}
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleRoleFilterChange("organiser")}
          className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            roleFilter === "organiser"
              ? "bg-[#FE760B]/10 border-[#FE760B]/60 ring-1 ring-[#FE760B]/30 shadow-sm"
              : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#3A3D42] hover:bg-slate-50 dark:hover:bg-[#212327]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-[#FE760B] uppercase">ORGANISERS</span>
            <Building2 className="w-4 h-4 text-[#FE760B]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {stats.organisers}
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleRoleFilterChange("superAdmin")}
          className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            roleFilter === "superAdmin"
              ? "bg-red-500/10 border-red-500/60 ring-1 ring-red-500/30 shadow-sm"
              : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#3A3D42] hover:bg-slate-50 dark:hover:bg-[#212327]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-red-500 dark:text-red-400 uppercase">SUPER ADMINS</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {stats.superAdmins}
          </div>
        </button>
      </div>

      {/* ── Controls: Search & Role Filter Tabs ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#9B9EA4]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] text-sm focus:outline-none focus:border-[#FE760B] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Unified Role Filter Controls */}
        <div className="flex items-center gap-2">
          {/* Mobile dropdown selector */}
          <div className="sm:hidden w-full">
            <StyledDropdown
              icon={Shield}
              label="Role"
              value={roleFilter}
              options={[
                { value: "all", label: `All Roles (${stats.total})` },
                { value: "user", label: `Attendees (${stats.attendees})` },
                { value: "organiser", label: `Organisers (${stats.organisers})` },
                { value: "superAdmin", label: `Super Admins (${stats.superAdmins})` },
              ]}
              onChange={(val) => handleRoleFilterChange(val)}
              className="w-full"
            />
          </div>

          {/* Clean Segmented Pill Tabs */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-[#1A1C1F] p-1 rounded-xl border border-slate-200 dark:border-[#2A2D31]">
            {[
              { id: "all", label: `All (${stats.total})` },
              { id: "user", label: `Attendees (${stats.attendees})` },
              { id: "organiser", label: `Organisers (${stats.organisers})` },
              { id: "superAdmin", label: `Super Admins (${stats.superAdmins})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleRoleFilterChange(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  roleFilter === tab.id
                    ? "bg-[#FE760B] text-[#131517] font-bold shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#212327]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className="border border-slate-200 dark:border-[#2A2D31] rounded-2xl bg-white dark:bg-[#1A1C1F] shadow-sm min-h-[340px] overflow-hidden flex flex-col justify-between">
        <div>
          {loading && users.length === 0 ? (
            <div className="p-4 sm:p-6 space-y-4">
              <SuperAdminTableSkeleton />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-slate-400 dark:text-[#9B9EA4] mb-3 opacity-50" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No users found</h3>
              <p className="text-sm text-slate-500 dark:text-[#9B9EA4] mt-1">
                {searchQuery
                  ? "Try adjusting your search criteria"
                  : "No users registered under this role filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-t-2xl min-h-[340px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/70 dark:bg-[#131517]/50 text-slate-500 dark:text-[#9B9EA4] text-[12px] uppercase font-semibold tracking-[0.6px] border-b border-slate-200 dark:border-[#2A2D31]">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">User / Identity</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4 hidden md:table-cell">Joined</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#2A2D31]/60">
                  {filteredUsers.map((u, idx) => {
                    const uid = u.uid || u.id;
                    const isSuper = u.role === "superAdmin";
                    const isOrganiser = u.role === "organiser" || u.role === "organizer";
                    const initial = (u.fullName || u.email || "U")[0].toUpperCase();
                    const isCurrentlyImpersonating = impersonatingId === uid;
                    const isCurrentlyUpdating = updatingRoleId === uid;
                    const rawPhone = u.whatsappPhone || u.phone;
                    const formattedPhone = u.displayPhone || formatPhoneDisplay(rawPhone);

                    return (
                      <tr
                        key={uid}
                        className="hover:bg-slate-50 dark:hover:bg-[#212327]/30 transition-colors"
                      >
                        {/* User Info */}
                        <td className="py-4 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none ${
                                isSuper
                                  ? "bg-red-500/20 text-red-500 border border-red-500/30"
                                  : isOrganiser
                                  ? "bg-[#FE760B]/20 text-[#FE760B] border border-[#FE760B]/30"
                                  : "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                              }`}
                            >
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span className="truncate">{u.fullName || "Unnamed User"}</span>
                                {isSuper && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                    SUPER
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-[#9B9EA4] truncate flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span>{u.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-4 px-4 text-xs text-slate-600 dark:text-[#D0D0D1]">
                          {rawPhone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-[#9B9EA4] shrink-0" />
                              <span className="font-mono text-xs">{formattedPhone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-[#6C7075]">—</span>
                          )}
                        </td>

                        {/* Role Selector Dropdown */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <StyledDropdown
                              value={u.role || "user"}
                              disabled={isCurrentlyUpdating}
                              onChange={(newRole) => handleRoleChange(uid, newRole)}
                              dropDirection={filteredUsers.length >= 4 && idx >= filteredUsers.length - 2 && idx > 0 ? "up" : "down"}
                              options={[
                                { value: "user", label: "User (Attendee)" },
                                { value: "organiser", label: "Organiser (Host)" },
                                { value: "superAdmin", label: "Super Admin" },
                              ]}
                              buttonClassName={`h-8 px-2.5 rounded-lg text-xs font-semibold border ${
                                isSuper
                                  ? "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20"
                                  : isOrganiser
                                  ? "bg-[#FE760B]/10 border-[#FE760B]/30 text-[#FE760B] hover:bg-[#FE760B]/20"
                                  : "bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                              }`}
                              align="left"
                            />
                            {isCurrentlyUpdating && (
                              <span className="text-[11px] text-[#FE760B] animate-pulse whitespace-nowrap">
                                Updating...
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Joined Date */}
                        <td className="py-4 px-4 text-xs text-slate-500 dark:text-[#9B9EA4] hidden md:table-cell">
                          {u.createdAt ? (
                            new Date(u.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          ) : (
                            <span>—</span>
                          )}
                        </td>

                        {/* Actions: Impersonate / Open user portal */}
                        <td className="py-4 px-4 sm:px-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleImpersonate(u)}
                            disabled={isCurrentlyImpersonating}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2D31] transition-all cursor-pointer disabled:opacity-50"
                            title={`Open portal for ${u.fullName || u.email}`}
                          >
                            {isCurrentlyImpersonating ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FE760B]" />
                                <span>Switching...</span>
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-3.5 h-3.5 text-[#FE760B]" />
                                <span>Open Portal</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Scalable Server-Side Pagination Bar ── */}
        {totalMatching > 0 && (
          <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#131517]/50 text-xs text-slate-500 dark:text-[#9B9EA4]">
            <div className="flex items-center gap-3">
              <span>
                Showing <span className="font-semibold text-slate-900 dark:text-white">{startIndex + 1}</span> to{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{endIndex}</span> of{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{totalMatching}</span> matching users
                {totalMatching !== stats.total && (
                  <span className="ml-1 opacity-70">({stats.total} total)</span>
                )}
              </span>

              {/* Page size dropdown */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-[#2A2D31]">
                <span className="text-[11px] text-slate-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] focus:outline-none focus:border-[#FE760B] cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-[#212327] disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {getPaginationRange(currentPage, totalPages).map((item, idx) => {
                  if (item === "...") {
                    return (
                      <span key={`dots-${idx}`} className="px-2 py-1 text-slate-400 dark:text-[#9B9EA4]">
                        …
                      </span>
                    );
                  }
                  const isCurrent = currentPage === item;
                  return (
                    <button
                      key={`page-${item}`}
                      type="button"
                      disabled={loading}
                      onClick={() => handlePageChange(item)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-[#FE760B] text-[#131517] font-bold shadow-xs"
                          : "bg-white dark:bg-[#1A1C1F] text-slate-700 dark:text-[#D0D0D1] hover:bg-slate-100 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31]"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-[#212327] disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create User Modal with Strict Phone Validation ── */}
      {isCreateModalOpen && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsCreateModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2A2D31]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#FE760B]/10 text-[#FE760B]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Create New System User
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                    Super Admin direct account provisioning
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-slate-50 dark:bg-[#212327] text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#FE760B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="Enter email address"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-slate-50 dark:bg-[#212327] text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#FE760B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] mb-1">
                  Password * (Min 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-slate-50 dark:bg-[#212327] text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#FE760B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
                    WhatsApp / Phone Number (Optional)
                  </label>
                  <span className="text-[10px] text-slate-400">10-digit or +Country</span>
                </div>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, phone: e.target.value });
                    if (phoneError) setPhoneError("");
                  }}
                  placeholder="e.g. 9876543210 or +91 98765 43210"
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${
                    phoneError
                      ? "border-red-500 focus:border-red-500 ring-1 ring-red-500/20"
                      : "border-slate-200 dark:border-[#2A2D31] focus:border-[#FE760B]"
                  } bg-slate-50 dark:bg-[#212327] text-slate-900 dark:text-white text-sm focus:outline-none`}
                />
                {phoneError ? (
                  <p className="text-[11px] text-red-500 mt-1">{phoneError}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-[#9B9EA4] mt-1">
                    Normalized to international E.164. Letters and non-standard lengths are rejected.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] mb-1.5">
                  Assign Role *
                </label>
                <StyledDropdown
                  value={createForm.role}
                  onChange={(val) => setCreateForm({ ...createForm, role: val })}
                  options={[
                    { value: "user", label: "User (Attendee)" },
                    { value: "organiser", label: "Organiser (Event Host)" },
                    { value: "superAdmin", label: "Super Admin (System Administrator)" },
                  ]}
                  className="w-full"
                  buttonClassName="w-full h-11 px-3.5 bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2D31] text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-sm shadow-md shadow-[#FE760B]/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {createSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
