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

    const displayText = hasSelection ? selectedLabel || placeholder : placeholder;

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
          "bg-white border-emerald-200 text-gray-900 hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400",
          "dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:focus:ring-emerald-500/20 dark:focus:border-emerald-500",
          !hasSelection && "text-gray-400 dark:text-slate-500",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        <span className="truncate">{displayText}</span>
        <svg
          className={cn(
            "h-4 w-4 shrink-0 transition-transform opacity-50",
            isOpen && "rotate-180",
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
        "absolute z-50 mt-1.5 w-full rounded-xl border shadow-xl overflow-hidden",
        "bg-white border-emerald-200/80 dark:bg-slate-900 dark:border-slate-700",
      )}
    >
      <div className={cn("max-h-60 overflow-auto p-1", className)}>
        {children}
      </div>
    </div>
  );
};
SelectContent.displayName = "SelectContent";

const SelectItem = ({ children, value, className, ...props }) => {
  const { value: selectedValue, handleSelect, registerItem } =
    React.useContext(SelectContext);

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
        "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm transition-colors",
        "text-gray-700 hover:bg-emerald-50 hover:text-emerald-700",
        "dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        isSelected &&
          "bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-500/10 dark:text-emerald-400",
        className,
      )}
      {...props}
    >
      {children}
      {isSelected && (
        <svg
          className="ml-auto h-4 w-4 text-emerald-500"
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