"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...rest }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full h-12 rounded-md bg-white/[0.03] border border-white/10 px-4 text-mist font-ui text-sm",
      "placeholder:text-stone/60 focus:outline-none focus:border-gold/60 focus:bg-white/[0.06] transition-colors duration-200",
      className
    )}
    {...rest}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full min-h-[5rem] rounded-md bg-white/[0.03] border border-white/10 px-4 py-3 text-mist font-ui text-sm resize-none",
      "placeholder:text-stone/60 focus:outline-none focus:border-gold/60 focus:bg-white/[0.06] transition-colors duration-200",
      className
    )}
    {...rest}
  />
));
Textarea.displayName = "Textarea";

export const Label = ({
  children,
  className,
  ...rest
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn(
      "text-[11px] uppercase tracking-[0.2em] text-stone font-ui mb-2 block",
      className
    )}
    {...rest}
  >
    {children}
  </label>
);