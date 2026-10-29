"use client";

import React, { useEffect, useState } from "react";
import { formatDate, formatTime } from "@/lib/utils";
import { api } from "@/lib/api";
import { motion } from "framer-motion";

export default function Hero({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date>(new Date());
  const [collegeName, setCollegeName] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    api.colleges()
      .then((c) => {
        if (!mounted) return;
        if (c && c.length > 0) setCollegeName(c[0].name);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-2xl border border-slate-800/60 bg-surface-900/70 p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-sm text-slate-400">Good day,</p>
          <h2 className="mt-1 text-2xl font-bold">Super Admin</h2>
          <p className="mt-1 text-sm text-slate-400">{collegeName ?? "—"} · Active Semester: Fall 2026</p>
        </div>

        <div className="text-right">
          <p className="text-sm text-slate-400">{formatDate(now)}</p>
          <p className="mt-1 text-xl font-semibold">{formatTime(now)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-300 font-mono flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Campus Geofence (100m) Active
        </div>
        <div className="rounded-xl bg-surface-800/60 border border-slate-700/60 px-3 py-1.5 text-xs text-slate-300 font-mono">
          AI Sentinel Engine: ONLINE
        </div>
      </div>
    </motion.div>
  );
}
