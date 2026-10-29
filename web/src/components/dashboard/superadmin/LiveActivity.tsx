"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { motion } from "framer-motion";
import { api, AttendanceSession } from "@/lib/api";
import { Activity, Clock, ShieldCheck } from "lucide-react";

export default function LiveActivity() {
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const sessions = await api.attendance.getAdminSessions({ status: "active" }).catch(() => []);
        if (active) setActiveSessions(sessions);
      } catch (err) {
        console.error("Failed to load live sessions:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="p-5 border-slate-800/80 bg-surface-900/60">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Live Activity</h3>
          </div>
          <p className="text-xs text-slate-400 font-mono">Real-time check-ins</p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Checking active campus streams...</div>
        ) : activeSessions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-slate-400">No active check-in sessions right now.</p>
            <p className="text-[11px] text-slate-500 mt-1">Live attendee check-ins will stream here in real time.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {activeSessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl p-2.5 bg-surface-950/60 border border-slate-800/60 hover:border-slate-700 transition-colors"
              >
                <div>
                  <p className="text-xs font-semibold text-white">
                    {s.subject_name || "Active Session"}{" "}
                    <span className="text-[10px] text-emerald-400 font-mono">· {s.section_name || "Campus"}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Started: {s.started_at ? new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Live"}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                  <ShieldCheck className="h-3 w-3" /> ACTIVE
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
