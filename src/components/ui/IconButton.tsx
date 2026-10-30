"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  bordered?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, bordered, className, type = "button", children, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-11 cursor-pointer items-center justify-center text-mist transition-[color,background-color,border-color,transform] duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        bordered
          ? "w-11 rounded-full border border-line hover:border-gold/40 hover:text-gold"
          : "flex-1 rounded-control hover:bg-surface-raised",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
);
IconButton.displayName = "IconButton";
