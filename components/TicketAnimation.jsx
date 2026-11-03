"use client";

import React from "react";
import { BrandLoader } from "@/components/ui/brand-loader";

/**
 * TicketAnimation component upgraded to the official branded TicketLelo Logo Loader
 */
export default function TicketAnimation({ message = "Loading...", fullScreen = false }) {
  return <BrandLoader message={message} fullScreen={fullScreen} size="lg" />;
}
