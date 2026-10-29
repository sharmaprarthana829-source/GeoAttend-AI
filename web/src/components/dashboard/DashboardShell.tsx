"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useDashboard } from "./DashboardContext";
import { getNavItemForPath } from "@/lib/navigation";
import Sidebar from "@/components/ui/Sidebar";
import TopNav from "@/components/ui/TopNav";
import Footer from "@/components/ui/Footer";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, navItems } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const navItem = useMemo(() => getNavItemForPath(pathname || "", user), [pathname, user]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 6);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!loading && user && pathname) {
      if (!navItem || !navItem.roles.includes(user.role)) {
        router.replace("/not-found");
      }
    }
  }, [loading, user, navItem, pathname, router]);

  const sidebarWidth = collapsed ? 76 : 270;

  if (loading || !user) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-surface-950 text-slate-200"
        style={{ backgroundColor: "#060912", color: "#f8fafc", fontFamily: "sans-serif" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"
            style={{ width: "2rem", height: "2rem", borderRadius: "9999px", border: "2px solid #10b981", borderTopColor: "transparent" }}
          />
          <p className="text-xs font-mono text-slate-400" style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>
            Loading GeoAttend OS...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Bar */}
      <TopNav
        onToggleSidebar={() => setSidebarOpen((s) => !s)}
        onCollapse={() => setCollapsed((c) => !c)}
        collapsed={collapsed}
        scrolled={scrolled}
      />

      {/* Main App Container */}
      <div className="flex flex-1 w-full">
        {/* Desktop Sidebar */}
        <aside
          className="hidden md:block transition-all duration-300 sticky top-16 h-[calc(100vh-4rem)] z-30 shrink-0"
          style={{ width: sidebarWidth, minWidth: sidebarWidth }}
        >
          <Sidebar items={navItems} collapsed={collapsed} fixed={false} />
        </aside>

        {/* Mobile Sidebar Drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="fixed inset-y-0 left-0 z-50 w-72 md:hidden"
              aria-hidden={!sidebarOpen}
            >
              <div className="h-full bg-surface-950 border-r border-slate-800 shadow-2xl backdrop-blur-2xl">
                <Sidebar items={navItems} collapsed={false} onClose={() => setSidebarOpen(false)} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile Backdrop */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Content Area with Telemetry Footer */}
        <div className="flex-1 flex flex-col min-w-0 min-h-[calc(100vh-4rem)]">
          <main className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
            {children}
          </main>

          {/* Bottom Telemetry Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
}
