"use client";

import React, { useState, useRef, useEffect } from "react";
import { LogOut, User as UserIcon, Shield, ChevronDown, Sparkles, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboard } from "@/components/dashboard/DashboardContext";

export default function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { user, logout } = useDashboard();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "GA";

  const roleLabel =
    user?.role === "admin"
      ? "Super Administrator"
      : user?.role === "faculty"
      ? "Faculty Member"
      : "Student";

  const badgeColor =
    user?.role === "admin"
      ? "bg-indigo-950 text-indigo-300 border-indigo-500/30"
      : user?.role === "faculty"
      ? "bg-emerald-950 text-emerald-300 border-emerald-500/30"
      : "bg-blue-950 text-blue-300 border-blue-500/30";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        aria-haspopup
        aria-expanded={open}
        className="inline-flex items-center gap-2.5 rounded-xl bg-surface-900/80 border border-slate-800/80 p-1.5 pr-3 hover:bg-surface-800 hover:border-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      >
        <div className="relative">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-emerald-950">
            {initials}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-surface-950" />
        </div>

        <div className="hidden lg:flex lg:flex-col lg:items-start text-left">
          <span className="text-xs font-semibold text-white line-clamp-1 max-w-[130px]">
            {user?.full_name || "Account"}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
            {user?.role || "User"}
          </span>
        </div>

        <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden lg:block" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-700/80 bg-surface-950/95 p-2 shadow-2xl backdrop-blur-2xl"
          >
            {/* User Profile Header */}
            <div className="p-3 rounded-xl bg-surface-900/90 border border-slate-800/80 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-sm font-bold text-white shadow">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{user?.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate font-mono">{user?.email}</p>
                </div>
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeColor}`}>
                  {user?.role}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Demo College</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-1">
              <button
                onClick={logout}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out of Session
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
