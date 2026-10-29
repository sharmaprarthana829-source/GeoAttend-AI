"use client";

import React from "react";
import KpiCard from "@/components/ui/KpiCard";
import { ArrowUp, ArrowDown, Building, Users, User, Activity, AlertCircle, MapPin } from "lucide-react";
import MiniLine from "@/components/ui/MiniLine";
import { motion } from "framer-motion";

const ICON_MAP: Record<string, React.ReactNode> = {
  colleges: <Building className="h-5 w-5" />,
  students: <Users className="h-5 w-5" />,
  faculty: <User className="h-5 w-5" />,
  sessions: <Activity className="h-5 w-5" />,
  attendance: <ArrowUp className="h-5 w-5" />,
  approvals: <AlertCircle className="h-5 w-5" />,
  geofences: <MapPin className="h-5 w-5" />,
};

function Trend({ data = [] }: { data?: number[] }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="w-28">
        <MiniLine data={data} />
      </div>
      <div className="text-xs text-slate-400">7d</div>
    </div>
  );
}

export default function KpiGrid({ stats }: { stats: any }) {
  const items = [
    { key: "colleges", label: "Total Colleges", value: stats?.total_colleges ?? 0, delta: "Active", icon: ICON_MAP.colleges },
    { key: "students", label: "Total Students", value: stats?.total_students ?? 0, delta: "Enrolled", icon: ICON_MAP.students },
    { key: "faculty", label: "Total Faculty", value: stats?.total_faculty ?? 0, delta: "Assigned", icon: ICON_MAP.faculty },
    { key: "sessions", label: "Active Sessions", value: stats?.active_sessions ?? 0, delta: "Live Now", icon: ICON_MAP.sessions },
    { key: "attendance", label: "Today's Attendance", value: stats?.today_attendance_count ?? 0, delta: "Check-ins", icon: ICON_MAP.attendance },
    { key: "approvals", label: "Pending Approvals", value: stats?.pending_approvals ?? 0, delta: "Queue", icon: ICON_MAP.approvals },
    { key: "fraud", label: "AI Fraud Alerts", value: stats?.fraud_alerts ?? 0, delta: "Real-time", icon: ICON_MAP.colleges },
    { key: "geofences", label: "Active Geofences", value: stats?.active_geofences ?? 1, delta: "Radius 100m", icon: ICON_MAP.geofences },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <motion.div whileHover={{ y: -4 }} key={it.key}>
          <KpiCard label={it.label} value={it.value} delta={it.delta} className="hover:shadow-xl">
            {/* KpiCard supports children but currently shows label/value/delta; keep it simple */}
          </KpiCard>
        </motion.div>
      ))}
    </div>
  );
}
