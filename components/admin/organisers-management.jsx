"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function OrganisersManagement() {
  const [organisers, setOrganisers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCredentials, setShowCredentials] = useState({});

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {organisers.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No organisers yet</p>
      ) : (
        organisers.map((organiser) => (
          <div
            key={organiser.id}
            className="bg-slate-900/60 dark:bg-slate-900/60 rounded-lg shadow border border-emerald-500/10 p-6 border-l-4 border-emerald-500"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-100">
                  {organiser.eventTitle}
                </h3>
                <p className="text-sm text-slate-300 mt-1">
                  Organiser: {organiser.name}
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                Active
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
              <div className="flex items-center gap-2 text-slate-300">
                <Mail className="w-4 h-4" />
                {organiser.email}
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4" />
                {organiser.phone}
              </div>
              {organiser.college && (
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4" />
                  {organiser.college}
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-4 h-4" />
                Approved:{" "}
                {organiser.approvedAt?.toDate
                  ? new Date(organiser.approvedAt.toDate()).toLocaleDateString()
                  : "N/A"}
              </div>
            </div>

            <div className="bg-slate-800/50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-slate-100">
                Login Credentials
              </h4>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="font-mono text-sm text-slate-100">
                    {organiser.organiserEmail}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Password</p>
                    <p className="font-mono text-sm text-slate-100">
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
              <p className="mt-4 text-slate-300 text-sm">
                {organiser.description}
              </p>
            )}

            <div className="mt-4 flex items-center gap-4">
              {organiser.isPaid && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  Paid Event
                </span>
              )}
              <span className="text-xs text-slate-400">
                {organiser.numberOfTickets} tickets
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
