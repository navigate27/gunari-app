"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 font-ui tracking-wide uppercase cursor-pointer select-none whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary: "bg-mist text-ink hover:bg-white",
        accent:
          "bg-gradient-to-r from-gold via-gold-light to-gold text-ink shadow-glow hover:shadow-glow-strong",
        ghost: "bg-transparent text-mist hover:bg-surface-raised",
        outline:
          "bg-transparent text-mist border border-line-strong hover:border-mist/60",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-7 text-base",
      },
      shape: {
        control: "rounded-control",
        pill: "rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md", shape: "control" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonStyles({ variant, size, shape }), className)}
      {...rest}
    />
  )
);
Button.displayName = "Button";
