"use client";

import { useState, useEffect, useMemo } from "react";
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
  Sparkles,
} from "lucide-react";
import { authFetch, establishServerSession } from "@/lib/auth";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { BrandLoader } from "@/components/ui/brand-loader";
import { StyledDropdown } from "@/components/ui/styled-dropdown";

export default function SuperAdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // "all" | "user" | "organiser" | "superAdmin"
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
  const [showPassword, setShowPassword] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const fetchUsers = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await authFetch("/api/superadmin/users");
      if (!res.ok) {
        throw new Error("Failed to load users list");
      }
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("[UsersPage] Error fetching users:", err);
      toast.error(err.message || "Could not fetch users");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search and role
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (u.fullName || "").toLowerCase().includes(query) ||
        (u.email || "").toLowerCase().includes(query) ||
        (u.whatsappPhone || u.phone || "").toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "user" && (u.role === "user" || !u.role)) ||
        (roleFilter === "organiser" && (u.role === "organiser" || u.role === "organizer")) ||
        (roleFilter === "superAdmin" && u.role === "superAdmin");

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Statistics counters
  const stats = useMemo(() => {
    const total = users.length;
    let attendees = 0;
    let organisers = 0;
    let superAdmins = 0;

    users.forEach((u) => {
      if (u.role === "superAdmin") superAdmins++;
      else if (u.role === "organiser" || u.role === "organizer") organisers++;
      else attendees++;
    });

    return { total, attendees, organisers, superAdmins };
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
        `Logged in as ${targetUser.fullName || targetUser.email}! Redirecting to dashboard...`
      );

      // Transition to target user's appropriate portal
      setTimeout(() => {
        router.push(data.redirectUrl || "/dashboard");
      }, 700);
    } catch (err) {
      console.error("[UsersPage] Impersonate error:", err);
      toast.error(err.message || "Impersonation failed");
      setImpersonatingId(null);
    }
  };

  // Super Admin: Create new user
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createForm.email.trim() || !createForm.password.trim()) {
      toast.error("Email and password are required.");
      return;
    }
    if (createForm.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
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
      // Refresh user list
      fetchUsers();
    } catch (err) {
      console.error("[UsersPage] Create user error:", err);
      toast.error(err.message || "Failed to create user");
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (loading) {
    return <BrandLoader message="Loading system users..." fullScreen />;
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-[#2A2D31]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Users Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/30">
              {users.length} Total
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-[#9B9EA4] mt-1">
            Complete system directory. Change roles, provision accounts, or login to any user dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] text-slate-700 dark:text-[#D0D0D1] hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors disabled:opacity-50"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#EA580C] text-white font-semibold text-sm shadow-md transition-all active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setRoleFilter("all")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            roleFilter === "all"
              ? "bg-[#FE760B]/12 border-[#FE760B]/50 ring-2 ring-[#FE760B]/25 shadow-sm"
              : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#3A3D42]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#9B9EA4]">ALL USERS</span>
            <Users className="w-4 h-4 text-slate-400 dark:text-[#9B9EA4]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.total}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter("user")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            roleFilter === "user"
              ? "bg-blue-500/15 border-blue-500/50 ring-2 ring-blue-500/25 shadow-sm"
              : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#3A3D42]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">ATTENDEES</span>
            <UserCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.attendees}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter("organiser")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            roleFilter === "organiser"
              ? "bg-[#FE760B]/12 border-[#FE760B]/50 ring-2 ring-[#FE760B]/25 shadow-sm"
              : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#3A3D42]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#FE760B]">ORGANISERS</span>
            <Building2 className="w-4 h-4 text-[#FE760B]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.organisers}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter("superAdmin")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            roleFilter === "superAdmin"
              ? "bg-red-500/15 border-red-500/50 ring-2 ring-red-500/25 shadow-sm"
              : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#3A3D42]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-500">SUPER ADMINS</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.superAdmins}
          </div>
        </button>
      </div>

      {/* ── Controls: Search & Role Filter Tabs ── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#9B9EA4]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] text-sm focus:outline-none focus:border-[#FE760B] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role Filter Dropdown + Quick Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <StyledDropdown
            icon={Shield}
            label="Filter Role"
            value={roleFilter}
            options={[
              { value: "all", label: `All Roles (${stats.total})` },
              { value: "user", label: `Attendees (${stats.attendees})` },
              { value: "organiser", label: `Organisers (${stats.organisers})` },
              { value: "superAdmin", label: `Super Admins (${stats.superAdmins})` },
            ]}
            onChange={(val) => setRoleFilter(val)}
            align="right"
          />

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: "all", label: `All (${stats.total})` },
              { id: "user", label: `Attendees (${stats.attendees})` },
              { id: "organiser", label: `Organisers (${stats.organisers})` },
              { id: "superAdmin", label: `Super Admins (${stats.superAdmins})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  roleFilter === tab.id
                    ? "bg-[#FE760B] text-black font-bold shadow-xs"
                    : "bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className="border border-slate-200 dark:border-[#2A2D31] rounded-2xl overflow-hidden bg-white dark:bg-[#1A1C1F] shadow-sm">
        {filteredUsers.length === 0 ? (
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#212327]/60 text-slate-500 dark:text-[#9B9EA4] text-xs uppercase font-semibold border-b border-slate-200 dark:border-[#2A2D31]">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">User / Identity</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Joined</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2A2D31]/60">
                {filteredUsers.map((u) => {
                  const uid = u.uid || u.id;
                  const isSuper = u.role === "superAdmin";
                  const isOrganiser = u.role === "organiser" || u.role === "organizer";
                  const initial = (u.fullName || u.email || "U")[0].toUpperCase();
                  const isCurrentlyImpersonating = impersonatingId === uid;
                  const isCurrentlyUpdating = updatingRoleId === uid;

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
                        {u.whatsappPhone || u.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-[#9B9EA4]" />
                            <span>{u.whatsappPhone || u.phone}</span>
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

                      {/* Actions: Impersonate / Login as user */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleImpersonate(u)}
                          disabled={isCurrentlyImpersonating}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-[#FE760B] hover:text-black text-slate-700 dark:bg-[#212327] dark:text-[#D0D0D1] dark:hover:bg-[#FE760B] dark:hover:text-black border border-slate-200 dark:border-[#2A2D31] transition-all cursor-pointer disabled:opacity-50"
                          title={`Log in as ${u.fullName || u.email}`}
                        >
                          {isCurrentlyImpersonating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Switching...</span>
                            </>
                          ) : (
                            <>
                              <LogIn className="w-3.5 h-3.5" />
                              <span>
                                {isSuper
                                  ? "Login as Admin"
                                  : isOrganiser
                                  ? "Login as Organiser"
                                  : "Login as Attendee"}
                              </span>
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

      {/* ── Create User Modal ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-6 shadow-2xl relative"
            role="dialog"
            aria-modal="true"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] mb-1">
                  WhatsApp / Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="Enter contact number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-slate-50 dark:bg-[#212327] text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#FE760B]"
                />
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
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-[#D0D0D1] hover:bg-slate-100 dark:hover:bg-[#212327] text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#EA580C] text-white font-semibold text-sm shadow-md transition-all disabled:opacity-50"
                >
                  {createSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

