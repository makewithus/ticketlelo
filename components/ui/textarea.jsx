import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[90px] w-full rounded-xl border border-[#2A2D31] bg-[#212327] px-3.5 py-2.5 text-sm text-[#FFFFFF] placeholder:text-[#9B9EA4] shadow-sm transition-colors focus-visible:outline-none focus-visible:border-[#FE760B] focus-visible:ring-1 focus-visible:ring-[#FE760B] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
