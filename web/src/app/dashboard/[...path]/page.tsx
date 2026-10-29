"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { getNavItemForPath } from "@/lib/navigation";

export default function DashboardPlaceholderPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useDashboard();

  const navItem = getNavItemForPath(pathname || "", user);

  useEffect(() => {
    if (!loading && user) {
      if (!navItem) {
        router.replace("/not-found");
      } else if (!navItem.roles.includes(user.role)) {
        router.replace("/not-found");
      }
    }
  }, [loading, user, navItem, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-950 text-slate-200">
        <p className="text-slate-400">Loading...</p>
      </main>
    );
  }

  if (!navItem || !navItem.roles.includes(user.role)) {
    return null;
  }

  return (
    <main className="min-h-screen px-4 py-10 md:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-800/70 bg-surface-900/90 p-10 shadow-2xl">
        <div className="text-slate-400 text-sm uppercase tracking-[0.24em]">Coming soon</div>
        <h1 className="mt-4 text-3xl font-semibold text-white">{navItem.label}</h1>
        <p className="mt-3 text-slate-400">This area is reserved for your {navItem.label.toLowerCase()} workflow. It will be available once the feature is implemented.</p>
      </div>
    </main>
  );
}
