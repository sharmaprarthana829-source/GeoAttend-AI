"use client";

import React, { useEffect, useState } from "react";
import { Search, Bell, PanelLeftClose, PanelLeft, Radio, Sparkles, ShieldCheck } from "lucide-react";
import AvatarMenu from "./AvatarMenu";
import SearchInput from "./SearchInput";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { usePathname } from "next/navigation";

import Link from "next/link";
import { api } from "@/lib/api";

export default function TopNav({
  onToggleSidebar,
  onCollapse,
  collapsed,
  scrolled,
}: {
  onToggleSidebar?: () => void;
  onCollapse?: () => void;
  collapsed?: boolean;
  scrolled?: boolean;
}) {
  const { user } = useDashboard();
  const pathname = usePathname();

  const [timeString, setTimeString] = useState("");
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    async function fetchUnread() {
      try {
        const counts = await api.notifications.getCounts();
        if (active) setUnreadCount(counts.unread);
      } catch {
        // silently ignore background errors
      }
    }

    if (user) {
      fetchUnread();
      const interval = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          fetchUnread();
        }
      }, 30000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }
  }, [user]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format breadcrumb title from pathname
  const formatBreadcrumb = (path: string) => {
    const clean = path.replace(/^\/dashboard\/?/, "");
    if (!clean) return "Overview";
    return clean
      .split("/")
      .map((s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
      .join(" / ");
  };

  return (
    <header
      className={`sticky top-0 z-40 h-16 w-full border-b transition-all duration-200 ${
        scrolled
          ? "border-slate-800/90 bg-surface-950/95 shadow-2xl backdrop-blur-2xl"
          : "border-slate-800/70 bg-surface-950/80 backdrop-blur-xl"
      }`}
    >
      <div className="flex h-full w-full items-center justify-between px-4 lg:px-6 gap-4">
        {/* Left: Brand Logo, Sidebar Controls & Breadcrumb */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Mobile hamburger */}
          <button
            aria-label="Toggle sidebar"
            onClick={onToggleSidebar}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-surface-800 transition-colors"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          {/* Primary App Logo & Name */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-950">
              <Sparkles className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-surface-950 animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tracking-tight">GeoAttend</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30">
                AI
              </span>
            </div>
          </div>

          {/* Desktop Sidebar Collapse / Expand Toggle */}
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onCollapse}
            className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-900/90 border border-slate-800 text-slate-400 hover:text-white hover:bg-surface-800 hover:border-slate-700 transition-all ml-1"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <PanelLeft className="h-4 w-4 text-emerald-400" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          {/* Subtle Divider & Page Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-xs border-l border-slate-800 pl-3 ml-1">
            <span className="text-slate-400 font-medium">{formatBreadcrumb(pathname || "")}</span>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex flex-1 items-center justify-center max-w-lg px-2">
          <SearchInput />
        </div>

        {/* Right: Live Telemetry, Notifications & User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Live System Clock Pill */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-900/80 border border-slate-800/80 text-xs font-mono text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span suppressHydrationWarning className="font-semibold text-white">
              {timeString || "00:00:00"}
            </span>
          </div>

          {/* Live Geofence Tag */}
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
            <Radio className="h-3 w-3 animate-pulse" />
            <span>MESH 100M</span>
          </div>

          {/* Notification Bell */}
          <Link
            href="/dashboard/notifications"
            aria-label="Notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-surface-800 transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black shadow-lg shadow-emerald-950 animate-pulse">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          {/* User Profile Dropdown */}
          <AvatarMenu />
        </div>
      </div>
    </header>
  );
}
