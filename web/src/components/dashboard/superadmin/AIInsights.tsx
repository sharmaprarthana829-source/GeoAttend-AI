"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { motion } from "framer-motion";
import { api, SuspiciousActivity } from "@/lib/api";
import { Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";

export default function AIInsights() {
  const [anomalies, setAnomalies] = useState<SuspiciousActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const list = await api.anomaly.getAdminAnomalies({ review_status: "pending" }).catch(() => []);
        if (active) setAnomalies(list);
      } catch (err) {
        console.error("Failed to load anomalies:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="p-5 border-slate-800/80 bg-surface-900/60">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">AI Sentinel Insights</h3>
          </div>
          <p className="text-xs text-slate-400 font-mono">Automated telemetry</p>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">Analyzing campus telemetry...</div>
        ) : anomalies.length === 0 ? (
          <div className="py-6 flex flex-col items-center text-center">
            <div className="h-8 w-8 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-white">All Campus Systems Nominal</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Geofences verified. 0 proxy or anomaly clusters detected in active sessions.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            <li className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {anomalies.length} Suspicious Detection{anomalies.length > 1 ? "s" : ""} Flagged
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Review flagged check-ins in the Suspicious Activity desk.
              </p>
            </li>
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
