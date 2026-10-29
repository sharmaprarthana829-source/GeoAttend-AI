"use client";

import React from "react";
import KpiCard from "@/components/ui/KpiCard";
import MiniLine from "@/components/ui/MiniLine";

export default function StudentSummary({ stats }: { stats: any }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total Students" value={stats?.total ?? "—"} delta={"1.2%"} />
      <KpiCard label="Active Students" value={stats?.active ?? "—"} delta={"0.5%"} />
      <KpiCard label="Inactive Students" value={stats?.inactive ?? "—"} delta={"-0.3%"} />
      <KpiCard label="Average Attendance" value={stats?.avg_attendance ? `${stats.avg_attendance}%` : "—"} delta={"2.1%"} />
    </div>
  );
}
