"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, helperText, id, value, onChange, placeholder, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    return (
      <div className="w-full space-y-1 relative">
        <div className="relative flex items-center group">
          {leftIcon && (
            <div
              className={cn(
                "pointer-events-none absolute left-3.5 z-10 flex items-center transition-colors duration-200",
                isFocused ? "text-emerald-400" : "text-slate-400"
              )}
            >
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            value={value}
            onChange={onChange}
            placeholder={label ? (isFocused ? placeholder : "") : placeholder}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            className={cn(
              "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 text-sm text-slate-100 placeholder:text-slate-500 transition-all duration-200 focus:border-emerald-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50",
              label ? "pt-5 pb-2" : "py-2.5",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20",
              className
            )}
            {...props}
          />

          {/* Floating Label Animation */}
          {label && (
            <label
              htmlFor={inputId}
              className={cn(
                "pointer-events-none absolute left-4 text-xs font-medium transition-all duration-200 ease-out select-none",
                leftIcon && "left-10",
                isFocused || hasValue
                  ? "top-1.5 text-[10px] uppercase font-mono tracking-wider font-semibold text-emerald-400"
                  : "top-3.5 text-slate-400"
              )}
            >
              {label}
            </label>
          )}

          {rightIcon && (
            <div className="absolute right-3.5 z-10 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-xs font-medium text-rose-400 animate-fade-in pl-1">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 pl-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
