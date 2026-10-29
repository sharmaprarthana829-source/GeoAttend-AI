"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "emerald";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "emerald",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 focus:ring-offset-obsidian-950 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.99]";

    const sizeStyles = {
      sm: "px-3 py-1.5 text-xs gap-1.5",
      md: "px-4 py-2.5 text-sm gap-2",
      lg: "px-5 py-3 text-sm font-semibold gap-2",
    };

    const variantStyles = {
      emerald:
        "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm border border-emerald-500/30",
      primary:
        "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm border border-emerald-500/30",
      secondary:
        "bg-obsidian-850 text-slate-200 hover:bg-obsidian-800 hover:text-white border border-white/10",
      outline:
        "bg-transparent text-slate-300 hover:bg-obsidian-850 border border-white/10 hover:text-white",
      ghost:
        "bg-transparent text-slate-400 hover:bg-obsidian-850 hover:text-slate-200",
      danger:
        "bg-rose-600 text-white hover:bg-rose-500 shadow-sm border border-rose-500/30",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
