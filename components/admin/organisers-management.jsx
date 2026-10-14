"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const PAGE_SIZE_OPTIONS = [5, 10, 20];

export function OrganisersManagement() {
  const [organisers, setOrganisers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCredentials, setShowCredentials] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    loadOrganisers();
  }, []);

  const loadOrganisers = async () => {
    try {
      // Get all approved hosting requests
      const hostingRequestsRef = collection(db, "hostingRequests");
      const q = query(hostingRequestsRef, where("status", "==", "approved"));
      const querySnapshot = await getDocs(q);

      const orgList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort in memory to avoid index requirement
      orgList.sort((a, b) => {
        const aTime = a.approvedAt?.toDate?.() || new Date(0);
        const bTime = b.approvedAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      setOrganisers(orgList);
    } catch (error) {
      console.error("Failed to load organisers:", error);
      toast.error("Failed to load organisers");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowPassword = (organiserId) => {
    setShowCredentials((prev) => ({
      ...prev,
      [organiserId]: !prev[organiserId],
    }));
  };

  const filteredOrganisers = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();

    return organisers.filter((organiser) => {
      const searchable = [
        organiser.eventTitle,
        organiser.name,
        organiser.email,
        organiser.phone,
        organiser.college,
        organiser.organiserEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !queryText || searchable.includes(queryText);
      const matchesFilter =
        filter === "all" ||
        (filter === "paid" && organiser.isPaid) ||
        (filter === "free" && !organiser.isPaid) ||
        (filter === "credentials" && organiser.organiserEmail);

      return matchesSearch && matchesFilter;
    });
  }, [filter, organisers, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredOrganisers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrganisers = filteredOrganisers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [filter, pageSize, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#061a3f]">
            Approved Organisers ({organisers.length})
          </h2>
          <p className="text-sm text-[rgba(6,26,63,0.64)]">
            Search, filter, and review organiser credentials.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(220px,1fr)_160px_120px] lg:w-[620px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(6,26,63,0.5)]" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search organisers"
              className="h-11 rounded-lg border-[var(--tl-line)] bg-white pl-10 text-[#061a3f] placeholder:text-[rgba(6,26,63,0.45)]"
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(6,26,63,0.5)]" />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-11 w-full appearance-none rounded-lg border border-[var(--tl-line)] bg-white pl-10 pr-3 text-sm font-medium text-[#061a3f] outline-none focus:border-[#3157ff]"
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="free">Free</option>
              <option value="credentials">Credentials</option>
            </select>
          </div>

          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="h-11 rounded-lg border border-[var(--tl-line)] bg-white px-3 text-sm font-medium text-[#061a3f] outline-none focus:border-[#3157ff]"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {organisers.length === 0 ? (
        <p className="text-[rgba(6,26,63,0.56)] text-center py-8">No organisers yet</p>
      ) : paginatedOrganisers.length === 0 ? (
        <p className="text-[rgba(6,26,63,0.56)] text-center py-8">No organisers match your filters</p>
      ) : (
        paginatedOrganisers.map((organiser) => (
          <div
            key={organiser.id}
            className="tl-auth-card p-6 border-l-4 border-l-[#008d46]"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-[#061a3f]">
                  {organiser.eventTitle}
                </h3>
                <p className="text-sm text-[rgba(6,26,63,0.64)] mt-1">
                  Organiser: {organiser.name}
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Approved
                </span>
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
              <div className="flex items-center gap-2 text-[rgba(6,26,63,0.72)]">
                <Mail className="w-4 h-4" />
                {organiser.email}
              </div>
              <div className="flex items-center gap-2 text-[rgba(6,26,63,0.72)]">
                <Phone className="w-4 h-4" />
                {organiser.phone}
              </div>
              {organiser.college && (
                <div className="flex items-center gap-2 text-[rgba(6,26,63,0.72)]">
                  <MapPin className="w-4 h-4" />
                  {organiser.college}
                </div>
              )}
              <div className="flex items-center gap-2 text-[rgba(6,26,63,0.72)]">
                <Calendar className="w-4 h-4" />
                Approved:{" "}
                {organiser.approvedAt?.toDate
                  ? new Date(organiser.approvedAt.toDate()).toLocaleDateString()
                  : "N/A"}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--tl-line)] bg-[#f8fafc] p-4 space-y-3">
              <h4 className="font-semibold text-[#061a3f] flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#3157ff]" />
                Login Credentials
              </h4>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-[rgba(6,26,63,0.56)]">Email</p>
                  <p className="font-mono text-sm text-[#061a3f]">
                    {organiser.organiserEmail}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[rgba(6,26,63,0.56)]">Password</p>
                    <p className="font-mono text-sm text-[#061a3f]">
                      {showCredentials[organiser.id]
                        ? organiser.organiserPassword
                        : "••••••••••••"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleShowPassword(organiser.id)}
                  >
                    {showCredentials[organiser.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {organiser.description && (
              <p className="mt-4 text-[rgba(6,26,63,0.72)] text-sm">
                {organiser.description}
              </p>
            )}

            <div className="mt-4 flex items-center gap-4">
              {organiser.isPaid && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  Paid Event
                </span>
              )}
              <span className="text-xs text-[rgba(6,26,63,0.56)]">
                {organiser.numberOfTickets} tickets
              </span>
            </div>
          </div>
        ))
      )}

      {organisers.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--tl-line)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[rgba(6,26,63,0.64)]">
            Showing{" "}
            <span className="font-semibold text-[#061a3f]">
              {filteredOrganisers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              -
              {Math.min(currentPage * pageSize, filteredOrganisers.length)}
            </span>{" "}
            of <span className="font-semibold text-[#061a3f]">{filteredOrganisers.length}</span>
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="border-[var(--tl-line)] bg-white text-[#061a3f] hover:bg-[#3157ff]/10"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="min-w-20 text-center text-sm font-semibold text-[#061a3f]">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="border-[var(--tl-line)] bg-white text-[#061a3f] hover:bg-[#3157ff]/10"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
