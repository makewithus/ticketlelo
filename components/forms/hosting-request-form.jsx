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
    <div className="w-full max-w-5xl mx-auto" style={{ fontFamily: '"Object Sans", Arial, sans-serif' }}>
      <div className="tl-host-form-card bg-[#fffdfa] border-0 rounded-[28px] shadow-[0_24px_80px_rgba(6,26,63,0.14)] overflow-hidden">
        <div className="grid md:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-[#ff0084] text-white p-8 md:p-10 flex flex-col justify-between min-h-[320px]">
            <div>
              <img src="/logo/Ticket%E0%A4%B2%E0%A5%87%E0%A4%B2%E0%A5%8B-final.png" alt="TicketLelo" className="w-40 mb-10" />
              <h1 className="text-5xl md:text-6xl leading-[0.94] font-normal tracking-normal uppercase">
                Host Your Event
              </h1>
            </div>
            <p className="text-lg md:text-xl leading-tight font-extrabold mt-8 max-w-sm">
              Submit your details once. The admin panel receives your request for review and approval.
            </p>
          </div>

          <div className="p-6 md:p-10">
            {submitted ? (
              <div className="flex min-h-[420px] flex-col justify-center" role="status" aria-live="polite">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-[#008d46]/10 text-[#008d46]">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="mb-3 text-3xl font-extrabold text-[#061a3f]">
                  Request submitted
                </h2>
                <p className="max-w-md text-[#061a3f]/75">
                  Your hosting request is with the admin team for review. We&apos;ll email you when it has been reviewed.
                </p>
                <Button
                  type="button"
                  onClick={() => router.push("/")}
                  className="mt-8 h-12 w-full max-w-xs rounded-full bg-[#3157ff] font-extrabold text-white hover:bg-[#ff0084]"
                >
                  Back to TicketLelo
                </Button>
              </div>
            ) : (
              <>
            <h2 className="text-3xl md:text-4xl leading-none font-normal text-[#061a3f] mb-2">
              Event Request
            </h2>
            <p className="text-[#061a3f] font-extrabold leading-tight mb-8">
              Fill the required fields and we will get back to you after admin approval.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5 [&_label]:leading-tight [&_input:not([type=checkbox])]:min-w-0 [&_textarea]:min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div>
                  <label className="block text-sm font-extrabold text-[#061a3f] mb-2 uppercase">
                    Full Name <span className="text-[#ff0084]">*</span>
                  </label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                    className="w-full h-12 rounded-full bg-[#f3f0e8] border-transparent text-[#061a3f] placeholder:text-[#061a3f]/45 focus:border-[#3157ff] focus:ring-[#3157ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-extrabold text-[#061a3f] mb-2 uppercase">
                    Email <span className="text-[#ff0084]">*</span>
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    required
                    className="w-full h-12 rounded-full bg-[#f3f0e8] border-transparent text-[#061a3f] placeholder:text-[#061a3f]/45 focus:border-[#3157ff] focus:ring-[#3157ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-extrabold text-[#061a3f] mb-2 uppercase">
                    Phone Number <span className="text-[#ff0084]">*</span>
                  </label>
                  <Input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full h-12 rounded-full bg-[#f3f0e8] border-transparent text-[#061a3f] placeholder:text-[#061a3f]/45 focus:border-[#3157ff] focus:ring-[#3157ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-extrabold text-[#061a3f] mb-2 uppercase">
                    College/Organization
                  </label>
                  <Input
                    name="college"
                    value={formData.college}
                    onChange={handleChange}
                    placeholder="ABC University"
                    className="w-full h-12 rounded-full bg-[#f3f0e8] border-transparent text-[#061a3f] placeholder:text-[#061a3f]/45 focus:border-[#3157ff] focus:ring-[#3157ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-extrabold text-[#061a3f] mb-2 uppercase">
                  Event Title <span className="text-[#ff0084]">*</span>
                </label>
                <Input
                  name="eventTitle"
                  value={formData.eventTitle}
                  onChange={handleChange}
                  placeholder="Tech Fest 2026"
                  required
                  className="w-full h-12 rounded-full bg-[#f3f0e8] border-transparent text-[#061a3f] placeholder:text-[#061a3f]/45 focus:border-[#3157ff] focus:ring-[#3157ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-extrabold text-[#061a3f] mb-2 uppercase">
                  Event Description
                </label>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe your event..."
                  rows={4}
                  className="w-full rounded-[24px] bg-[#f3f0e8] border-transparent text-[#061a3f] placeholder:text-[#061a3f]/45 focus:border-[#3157ff] focus:ring-[#3157ff]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 items-end">
                <label className="mb-0 flex items-center gap-3 cursor-pointer bg-[#f3f0e8] rounded-full px-5 h-12">
                  <input
                    type="checkbox"
                    name="isPaid"
                    checked={formData.isPaid}
                    onChange={handleChange}
                    className="w-5 h-5 accent-[#ff0084]"
                  />
                  <span className="text-sm font-extrabold text-[#061a3f] uppercase">
                    Paid Event
                  </span>
                </label>

                <div>
                  <label className="block text-sm font-extrabold text-[#061a3f] mb-2 uppercase">
                    Number of Tickets
                  </label>
                  <Input
                    type="number"
                    name="numberOfTickets"
                    value={formData.numberOfTickets}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    className="w-full h-12 rounded-full bg-[#f3f0e8] border-transparent text-[#061a3f] placeholder:text-[#061a3f]/45 focus:border-[#3157ff] focus:ring-[#3157ff]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/")}
                  className="flex-1 h-[52px] rounded-full bg-[#061a3f] hover:bg-[#102a5f] text-white border-0 font-extrabold"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 h-[52px] rounded-full bg-[#3157ff] hover:bg-[#ff0084] text-white font-extrabold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
              </div>
            </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
