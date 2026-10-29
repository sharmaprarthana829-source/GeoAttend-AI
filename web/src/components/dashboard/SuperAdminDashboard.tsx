"use client";

import React, { useEffect, useState } from "react";
import { api, DashboardStats } from "@/lib/api";
import Hero from "./superadmin/Hero";
import KpiGrid from "./superadmin/KpiGrid";
import Analytics from "./superadmin/Analytics";
import LiveActivity from "./superadmin/LiveActivity";
import QuickActions from "./superadmin/QuickActions";
import AIInsights from "./superadmin/AIInsights";
import Notifications from "./superadmin/Notifications";
import { motion } from "framer-motion";

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [colleges, setColleges] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const s = await api.dashboardStats();
        const c = await api.colleges();
        if (!mounted) return;
        setStats(s);
        setColleges(c || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <Hero />

      <section>
        <KpiGrid stats={stats} />
      </section>

      <section>
        <Analytics />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <LiveActivity />
          <AIInsights />
        </div>

        <div className="space-y-6">
          <QuickActions />
          <Notifications />
        </div>
      </div>
    </div>
  );
}

