"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SelectContext = React.createContext(null);

const Select = ({ children, value, onValueChange, disabled }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const [labelMap, setLabelMap] = React.useState({});

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isOpen]);

  const registerItem = React.useCallback((itemValue, itemLabel) => {
    setLabelMap((prev) => {
      if (prev[itemValue] === itemLabel) return prev;
      return { ...prev, [itemValue]: itemLabel };
    });
  }, []);

  const handleSelect = React.useCallback(
    (itemValue) => {
      onValueChange(itemValue);
      setIsOpen(false);
    },
    [onValueChange],
  );

  // Only treat null/undefined as "no selection". Empty string "" IS a valid selection.
  const hasSelection = value !== undefined && value !== null && value !== "";
  const selectedLabel = hasSelection ? (labelMap[value] ?? "") : "";

  return (
    <SelectContext.Provider
      value={{
        value,
        isOpen,
        setIsOpen,
        handleSelect,
        registerItem,
        selectedLabel,
        hasSelection,
        disabled: !!disabled,
      }}
    >
      <div className="relative" ref={containerRef}>
        {children}
      </div>
    </SelectContext.Provider>
  );
};
Select.displayName = "Select";

const SelectTrigger = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    const { isOpen, setIsOpen, disabled, selectedLabel, hasSelection } =
      React.useContext(SelectContext);

    let placeholder = "Select an option";
    React.Children.forEach(children, (child) => {
      if (
        child?.type?.displayName === "SelectValue" &&
        child.props?.placeholder
      ) {
        placeholder = child.props.placeholder;
      }
    });

    const displayText = hasSelection
      ? selectedLabel || placeholder
      : placeholder;

    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all",
          "bg-[#212327] border-[#2A2D31] text-white hover:border-[#FE760B]/40 focus:outline-none focus:ring-1 focus:ring-[#FE760B] focus:border-[#FE760B]",
          !hasSelection && "text-[#9B9EA4]",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        <span className="truncate">{displayText}</span>
        <svg
          className={cn(
            "h-4 w-4 shrink-0 transition-transform text-[#9B9EA4]",
            isOpen && "rotate-180 text-[#FE760B]",
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = ({ children, className }) => {
  const { isOpen } = React.useContext(SelectContext);
  if (!isOpen) return null;
  return (
    <div
      className={cn(
        "absolute z-50 mt-1.5 w-full rounded-xl border shadow-2xl overflow-hidden",
        "bg-[#1A1C1F] border-[#2A2D31] text-white",
      )}
    >
      <div
        className={cn(
          "max-h-60 overflow-y-auto p-1.5 space-y-0.5",
          className,
        )}
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#2A2D31 transparent",
        }}
      >
        {children}
      </div>
    </div>
  );
};
SelectContent.displayName = "SelectContent";

const SelectItem = ({ children, value, className, ...props }) => {
  const {
    value: selectedValue,
    handleSelect,
    registerItem,
  } = React.useContext(SelectContext);

  const isSelected = selectedValue === value;
  const label = typeof children === "string" ? children : String(value ?? "");

  React.useLayoutEffect(() => {
    if (value !== undefined && value !== null && value !== "") {
      registerItem(value, label);
    }
  }, [value, label, registerItem]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        handleSelect(value);
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-xs sm:text-sm transition-colors",
        "text-[#D0D0D1] hover:bg-[#212327] hover:text-white",
        isSelected &&
          "bg-[#2A1D13] text-[#FE760B] font-semibold hover:bg-[#2A1D13] hover:text-[#FE760B]",
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {isSelected && (
        <svg
          className="ml-auto h-4 w-4 text-[#FE760B] shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </div>
  );
};
SelectItem.displayName = "SelectItem";

const SelectValue = ({ placeholder }) => <span>{placeholder}</span>;
SelectValue.displayName = "SelectValue";

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
