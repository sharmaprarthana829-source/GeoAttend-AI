"use client";

import React, { useEffect, useState } from "react";
import KpiCard from "@/components/ui/KpiCard";
import { api } from "@/lib/api";

export default function FacultySummary({
  stats,
}: {
  stats?: {
    total?: number;
    active?: number;
    departments?: number;
    subjects?: number;
    live_today?: number;
    attendance_today?: number;
  };
}) {
  const [data, setData] = useState(
    stats || {
      total: 0,
      active: 0,
      departments: 0,
      subjects: 0,
      live_today: 0,
      attendance_today: 0,
    }
  );

  useEffect(() => {
    if (stats) {
      setData(stats);
      return;
    }
    Promise.all([
      api.faculty.getProfiles().catch(() => []),
      api.academic.getDepartments().catch(() => []),
      api.subjects.getMasterSubjects().catch(() => []),
      api.dashboardStats().catch(() => null),
    ]).then(([profiles, depts, subs, dash]) => {
      const total = profiles.length;
      const active = profiles.filter((p) => p.is_active).length;
      const live_today = dash ? dash.active_sessions : 0;
      const attendance_today = dash ? dash.today_attendance_count : 0;
      setData({
        total,
        active,
        departments: depts.length,
        subjects: subs.length,
        live_today,
        attendance_today,
      });
    });
  }, [stats]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
      <KpiCard label="Total Faculty" value={String(data.total ?? 0)} />
      <KpiCard label="Active Faculty" value={String(data.active ?? 0)} />
      <KpiCard label="Departments" value={String(data.departments ?? 0)} />
      <KpiCard label="Subjects" value={String(data.subjects ?? 0)} />
      <KpiCard label="Live Sessions Today" value={String(data.live_today ?? 0)} />
      <KpiCard label="Attendance Taken" value={String(data.attendance_today ?? 0)} />
    </div>
  );
}
