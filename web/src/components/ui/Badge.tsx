"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "indigo" | "emerald" | "rose" | "amber" | "cyan" | "slate" | "violet";
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "indigo",
  size = "md",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    slate: "bg-slate-800 text-slate-300 border-slate-700",
  };

  const dotColors = {
    indigo: "bg-indigo-400",
    emerald: "bg-emerald-400",
    rose: "bg-rose-400",
    amber: "bg-amber-400",
    cyan: "bg-cyan-400",
    violet: "bg-violet-400",
    slate: "bg-slate-400",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border tracking-wide uppercase font-semibold select-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse-glow", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
