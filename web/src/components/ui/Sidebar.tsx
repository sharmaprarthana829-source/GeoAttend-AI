"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Bell,
  ShieldCheck,
  Building2,
  Sparkles,
  LogOut,
  ChevronRight,
  Radio,
} from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: number;
}

export default function Sidebar({
  items,
  collapsed = false,
  onClose,
  fixed = true,
}: {
  items: NavItem[];
  collapsed?: boolean;
  onClose?: () => void;
  fixed?: boolean;
}) {
  const pathname = usePathname();
  const { user, logout } = useDashboard();

  const expandedWidth = 270; // px
  const collapsedWidth = 76; // px
  const activePath = pathname || "/dashboard";

  const positionClass = fixed ? "fixed left-0 top-0 z-30" : "relative z-20";
  const heightClass = fixed ? "h-screen" : onClose ? "h-full" : "h-[calc(100vh-4rem)]";

  const roleTitle =
    user?.role === "admin"
      ? "System Control Center"
      : user?.role === "faculty"
      ? "Faculty Workspace"
      : "Student Desk";

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "GA";

  return (
    <motion.nav
      aria-label="Main navigation"
      initial={false}
      animate={{ width: collapsed ? collapsedWidth : expandedWidth }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className={`${positionClass} ${heightClass} bg-surface-950/95 border-r border-slate-800/80 shadow-2xl backdrop-blur-2xl flex flex-col justify-between select-none`}
      style={{ willChange: "width" }}
    >
      {/* Navigation Links Scrollable Area */}
      <div className="px-3 py-4 flex-1 min-h-0 overflow-y-auto space-y-1">
        <div className={cn("px-3 pb-2 flex items-center justify-between transition-opacity duration-200", collapsed ? "opacity-0 pointer-events-none" : "opacity-100")}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {roleTitle}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = activePath === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-medium transition-all duration-150 focus:outline-none",
                    isActive
                      ? "bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent text-emerald-300 font-semibold border-l-2 border-emerald-400 shadow-sm"
                      : "text-slate-300 hover:bg-surface-900 hover:text-white hover:border-l-2 hover:border-slate-600"
                  )}
                  onClick={() => onClose && onClose()}
                  title={collapsed ? item.label : undefined}
                >
                  <span
                    className={cn(
                      "shrink-0 transition-transform duration-150 group-hover:scale-110",
                      isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-200"
                    )}
                  >
                    {item.icon}
                  </span>

                  <span
                    className={cn(
                      "flex-1 truncate transition-opacity duration-200",
                      collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                  >
                    {item.label}
                  </span>

                  {item.badge ? (
                    <span
                      className={cn(
                        "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-500 text-black shadow-sm",
                        collapsed ? "hidden" : ""
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom Profile & Institutional Footer */}
      <div className="p-3 border-t border-slate-800/80 flex-shrink-0 bg-surface-950/80">
        <div
          className={cn(
            "rounded-xl border border-slate-800/80 bg-surface-900/60 p-2.5 transition-all duration-200 flex items-center justify-between gap-2",
            collapsed ? "p-1.5 justify-center border-none bg-transparent" : ""
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xs font-bold text-white shadow shrink-0">
              {initials}
            </div>
            <div
              className={cn(
                "min-w-0 transition-opacity duration-200",
                collapsed ? "opacity-0 pointer-events-none hidden" : "opacity-100"
              )}
            >
              <p className="text-xs font-bold text-white truncate">{user?.full_name || "User"}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate uppercase">{user?.role || "Account"}</p>
            </div>
          </div>

          {!collapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
