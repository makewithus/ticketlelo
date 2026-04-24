"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createHostingRequest } from "@/lib/hosting-requests";
import { useRouter } from "next/navigation";

export function HostingRequestForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
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

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        college: "",
        eventTitle: "",
        description: "",
        isPaid: false,
        numberOfTickets: 0,
      });

      // Redirect to homepage after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (error) {
      console.error("Error submitting request:", error);
      toast.error(error.message || "Failed to submit hosting request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-[#FF6A00]/20 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Host Your Event on Ticketलेलो
          </h1>
          <p className="text-gray-300">
            Fill out the form below and we'll get back to you shortly
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name <span className="text-red-400">*</span>
              </label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                required
                className="w-full bg-black/30 border-[#FF6A00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6A00]/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email <span className="text-red-400">*</span>
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john@example.com"
                required
                className="w-full bg-black/30 border-[#FF6A00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6A00]/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number <span className="text-red-400">*</span>
              </label>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                required
                className="w-full bg-black/30 border-[#FF6A00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6A00]/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                College/Organization
              </label>
              <Input
                name="college"
                value={formData.college}
                onChange={handleChange}
                placeholder="ABC University"
                className="w-full bg-black/30 border-[#FF6A00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6A00]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Event Title <span className="text-red-400">*</span>
            </label>
            <Input
              name="eventTitle"
              value={formData.eventTitle}
              onChange={handleChange}
              placeholder="Tech Fest 2026"
              required
              className="w-full bg-black/30 border-[#FF6A00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6A00]/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Event Description
            </label>
            <Textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your event..."
              rows={4}
              className="w-full bg-black/30 border-[#FF6A00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6A00]/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isPaid"
                  checked={formData.isPaid}
                  onChange={handleChange}
                  className="w-5 h-5 text-[#FF6A00] bg-black/30 border-[#FF6A00]/20 rounded focus:ring-[#FF6A00]"
                />
                <span className="text-sm font-medium text-gray-300">
                  Paid Event
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Number of Tickets
              </label>
              <Input
                type="number"
                name="numberOfTickets"
                value={formData.numberOfTickets}
                onChange={handleChange}
                placeholder="0"
                min="0"
                className="w-full bg-black/30 border-[#FF6A00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6A00]/50"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white border-white/10"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-[#FF6A00] hover:bg-[#FFD60A] text-white font-semibold"
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
      </div>
    </div>
  );
}
