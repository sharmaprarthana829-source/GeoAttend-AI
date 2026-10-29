"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  CalendarDays,
  Settings,
  FileSpreadsheet,
  BarChart3,
  Clock,
  ShieldAlert,
} from "lucide-react";

export default function QuickActions() {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl"
    >
      <h3 className="text-base font-bold text-white mb-4">Admin Command Center</h3>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Button
          onClick={() => router.push("/dashboard/students")}
          leftIcon={<Users className="h-4 w-4 text-blue-400" />}
          className="w-full justify-start text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
        >
          Students &amp; Devices
        </Button>
        <Button
          onClick={() => router.push("/dashboard/attendance")}
          leftIcon={<Clock className="h-4 w-4 text-emerald-400" />}
          className="w-full justify-start text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
        >
          Attendance Overrides
        </Button>
        <Button
          onClick={() => router.push("/dashboard/timetable")}
          leftIcon={<CalendarDays className="h-4 w-4 text-amber-400" />}
          className="w-full justify-start text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
        >
          Timetable &amp; Rooms
        </Button>
        <Button
          onClick={() => router.push("/dashboard/suspicious-activity")}
          leftIcon={<ShieldAlert className="h-4 w-4 text-rose-400" />}
          className="w-full justify-start text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
        >
          AI Anomaly Desk
        </Button>
        <Button
          onClick={() => router.push("/dashboard/reports")}
          leftIcon={<BarChart3 className="h-4 w-4 text-purple-400" />}
          className="w-full justify-start text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
        >
          Reports &amp; Analytics
        </Button>
        <Button
          onClick={() => router.push("/dashboard/settings")}
          leftIcon={<Settings className="h-4 w-4 text-blue-400" />}
          className="w-full justify-start text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
        >
          System Settings
        </Button>
        <Button
          onClick={() => router.push("/dashboard/audit")}
          leftIcon={<FileSpreadsheet className="h-4 w-4 text-emerald-400" />}
          className="w-full justify-start text-xs col-span-full bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
        >
          Audit Log Desk (Immutable)
        </Button>
      </div>
    </motion.div>
  );
}
