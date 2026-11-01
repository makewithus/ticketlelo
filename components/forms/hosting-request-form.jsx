"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createHostingRequest } from "@/lib/hosting-requests";
import { useRouter } from "next/navigation";

export function HostingRequestForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    college: "",
    eventTitle: "",
    description: "",
    isPaid: false,
    numberOfTickets: 0,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validation
      if (
        !formData.name ||
        !formData.email ||
        !formData.phone ||
        !formData.eventTitle
      ) {
        toast.error("Please fill in all required fields");
        setIsLoading(false);
        return;
      }

      await createHostingRequest(formData);
      toast.success(
        "Hosting request submitted successfully! You'll receive an email once approved.",
      );
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting request:", error);
      toast.error(error.message || "Failed to submit hosting request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Branding, Title, Steps */}
        <div className="lg:col-span-5 space-y-6 pt-2">
          {/* Logo */}
          <div className="mb-4">
            <img
              src="/logo/ticketlelo-logo-nav.png"
              alt="TicketLelo"
              className="h-9 w-auto object-contain"
            />
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#FFFFFF] tracking-tight mb-3">
              Host your event<br className="hidden sm:inline" /> on TicketLelo
            </h1>
            <p className="text-[#9B9EA4] text-sm leading-relaxed">
              Send your details once. Our team reviews the request and emails you organiser login details.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-5 pt-4">
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-[#FE760B] mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Send this request</p>
                <p className="text-xs text-[#9B9EA4] mt-0.5">About two minutes</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-[#5C6066] mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#D0D0D1]">We review it</p>
                <p className="text-xs text-[#9B9EA4] mt-0.5">Approved or we follow up by email</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-[#5C6066] mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#D0D0D1]">Sign in & create your event</p>
                <p className="text-xs text-[#9B9EA4] mt-0.5">Tickets, questions, banner, QR check-in</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Form Card */}
        <div className="lg:col-span-7">
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 sm:p-8 shadow-xl">
            {submitted ? (
              <div className="flex min-h-[420px] flex-col justify-center text-center items-center py-8">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-white">
                  Request submitted
                </h2>
                <p className="max-w-md text-[#9B9EA4] text-sm">
                  Your hosting request is with the admin team for review. We&apos;ll email you when it has been approved.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-black font-semibold text-sm transition-colors"
                >
                  Back to TicketLelo
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* SECTION 1: ABOUT YOU */}
                <div>
                  <p className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-3">
                    About you
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        Full name *
                      </label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="john@example.com"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        Phone number *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+91 98765 43210"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        College / organisation
                      </label>
                      <input
                        name="college"
                        value={formData.college}
                        onChange={handleChange}
                        placeholder="ABC University"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: YOUR EVENT */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-3">
                    Your event
                  </p>
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        Event title *
                      </label>
                      <input
                        name="eventTitle"
                        value={formData.eventTitle}
                        onChange={handleChange}
                        placeholder="Tech Fest 2026"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        Event description
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="What's the event about? Who is it for?"
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                      <div>
                        <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                          Expected tickets
                        </label>
                        <input
                          type="number"
                          name="numberOfTickets"
                          value={formData.numberOfTickets || ""}
                          onChange={handleChange}
                          placeholder="100"
                          min="0"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors"
                        />
                      </div>

                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] h-[42px]">
                        <span className="text-xs font-medium text-[#D0D0D1]">
                          Paid event
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={formData.isPaid}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              isPaid: !prev.isPaid,
                            }))
                          }
                          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                          style={{
                            backgroundColor: formData.isPaid ? "#FE760B" : "#2A2D31",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              formData.isPaid ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons matching Image 2 */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2D31]">
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-[#9B9EA4] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      "Submit request"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
