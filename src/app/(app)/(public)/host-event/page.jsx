"use client";

import { HostingRequestForm } from "@/components/forms/hosting-request-form";
import Header from "@/components/Header";
import { Spotlight } from "@/components/Spotlight";

export default function HostEventPage() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      {/* Fixed Grid Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #4f4f4f2e 1px, transparent 1px), linear-gradient(to bottom, #4f4f4f2e 1px, transparent 1px)",
          backgroundSize: "14px 24px",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 110%)",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 110%)",
        }}
      />

      {/* Spotlight */}
      <Spotlight
        gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(142, 71%, 85%, .08) 0, hsla(142, 71%, 55%, .02) 50%, hsla(142, 71%, 45%, 0) 80%)"
        gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(142, 71%, 85%, .06) 0, hsla(142, 71%, 55%, .02) 80%, transparent 100%)"
        gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(142, 71%, 85%, .04) 0, hsla(142, 71%, 45%, .02) 80%, transparent 100%)"
        translateY={-350}
        width={560}
        height={1380}
        smallWidth={240}
        duration={7}
        xOffset={100}
      />

      {/* Header */}
      <Header />

      {/* Content */}
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <HostingRequestForm />
      </section>
    </div>
  );
}
