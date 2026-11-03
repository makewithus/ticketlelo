"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * StyledDropdown Component
 * 
 * High-fidelity TicketLelo styled dropdown replacing native OS select elements.
 * Features dark theme aesthetics, custom hover/active states, orange accent highlights,
 * outside click handling, keyboard navigation, and checkmarks for selected values.
 * Supports both inline pill triggers and full-width form inputs.
 */
export function StyledDropdown({
  icon: Icon,
  label,
  headerTitle,
  value,
  options = [],
  onChange,
  align = "left",
  dropDirection = "down",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  placeholder = "Select option",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Normalize options to { value, label } format
  const normalizedOptions = options.map((opt) =>
    typeof opt === "object" && opt !== null
      ? opt
      : { value: opt, label: String(opt) }
  );

  const currentOption =
    normalizedOptions.find((opt) => opt.value === value) ||
    normalizedOptions[0];

  // Close on outside click and Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val) => {
    if (disabled) return;
    onChange?.(val);
    setIsOpen(false);
  };

  const computedHeader = headerTitle !== undefined 
    ? headerTitle 
    : label 
    ? `${label} options` 
    : null;

  const isFullWidth = className.includes("w-full");

  return (
    <div
      className={`relative ${isFullWidth ? "w-full block" : "inline-block"} ${className}`}
      ref={dropdownRef}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center ${
          isFullWidth ? "w-full justify-between" : "gap-2"
        } h-9 px-3.5 rounded-xl border text-xs font-medium transition-all shadow-sm cursor-pointer select-none group ${
          isOpen
            ? "bg-[#212327] border-[#FE760B] ring-2 ring-[#FE760B]/20 text-white"
            : "bg-[#1A1C1F] hover:bg-[#212327] border-[#2A2D31] hover:border-[#3A3D42] text-[#9B9EA4] hover:text-white"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="inline-flex items-center gap-2 truncate">
          {Icon && (
            <Icon
              size={13}
              className={`transition-colors shrink-0 ${
                isOpen
                  ? "text-[#FE760B]"
                  : "text-[#9B9EA4] group-hover:text-[#FE760B]"
              }`}
            />
          )}
          {label && (
            <span className="font-medium text-[#9B9EA4] select-none">
              {label}:
            </span>
          )}
          <span className="font-semibold text-white select-none truncate">
            {currentOption ? currentOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 shrink-0 ml-1.5 ${
            isOpen ? "rotate-180 text-[#FE760B]" : "text-[#9B9EA4] group-hover:text-white"
          }`}
        />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={`absolute z-50 ${
            isFullWidth ? "w-full" : "min-w-[210px]"
          } p-1.5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150 ${
            dropDirection === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${align === "right" ? "right-0" : "left-0"} ${menuClassName}`}
        >
          {computedHeader && (
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#71767B] border-b border-[#2A2D31]/60 mb-1 select-none">
              {computedHeader}
            </div>
          )}
          <div className="space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
            {normalizedOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                    isSelected
                      ? "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30 shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-[#212327]"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check size={14} className="text-[#FE760B] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default StyledDropdown;
