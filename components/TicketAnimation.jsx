"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Lottie from "lottie-react";

export default function TicketAnimation() {
  const [animationData, setAnimationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Fetch the animation JSON
    fetch("/ticket-blue.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load animation");
        }
        return response.json();
      })
      .then((data) => {
        setAnimationData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading Lottie animation:", error);
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-[500px] aspect-square flex items-center justify-center mx-auto">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !animationData) {
    return (
      <div className="w-full max-w-[500px] aspect-square flex items-center justify-center mx-auto">
        <p className="text-gray-400 text-sm">Animation not available</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="w-full max-w-[500px] aspect-square flex items-center justify-center mx-auto"
    >
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </motion.div>
  );
}
