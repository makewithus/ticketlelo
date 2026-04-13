'use client';

import { motion } from 'framer-motion';

export default function ShimmerButton({
  children,
  onClick,
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`
        relative overflow-hidden cursor-pointer
        px-6 py-3 rounded-md font-medium text-white
        bg-gradient-to-r from-emerald-600 to-emerald-600
        border border-emerald-500/30
        hover:from-emerald-500 hover:to-emerald-500
        transition-all duration-300 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
        before:absolute before:inset-0 before:bg-gradient-to-r
        before:from-transparent before:via-white/15 before:to-transparent
        before:-translate-x-full hover:before:translate-x-full
        before:transition-transform before:duration-700
        ${className}
      `}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}
