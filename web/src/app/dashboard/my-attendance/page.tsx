"use client";

import React, { useEffect, useState } from "react";
import {
  api,
  AttendanceRecord,
  StudentSummaryItem,
  AttendanceSession,
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  CheckCircle2,
  Clock,
  CalendarDays,
  FileText,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function StudentAttendancePage() {
  const [summary, setSummary] = useState<StudentSummaryItem[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      try {
        const [sum, hist, sessions] = await Promise.all([
          api.attendance.getStudentSummary().catch(() => []),
          api.attendance.getStudentHistory(100).catch(() => []),
          api.attendance.getStudentActiveSessions().catch(() => []),
        ]);
        if (!active) return;
        setSummary(sum);
        setHistory(hist);
        setActiveSessions(sessions);
      } catch (err) {
        console.error("Error loading attendance data:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const totalClasses = summary.reduce((acc, s) => acc + (s.total_classes ?? s.total_sessions ?? 0), 0);
  const attendedClasses = summary.reduce((acc, s) => acc + (s.attended_classes ?? s.attended ?? 0), 0);
  const overallPercentage = totalClasses > 0 ? ((attendedClasses / totalClasses) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-xs text-slate-400 mb-1">Dashboard / My Attendance</nav>
        <h1 className="text-2xl font-semibold text-white">Attendance Records & History</h1>
        <p className="text-sm text-slate-400 mt-1">
          Detailed breakdown of your attendance status, subject percentages, and verified check-ins.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 border-slate-800/60 bg-surface-900/70">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Overall Percentage</span>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{overallPercentage}%</p>
          <p className="text-xs text-slate-400 mt-1">Required: 75% for exam eligibility</p>
        </Card>

        <Card className="p-5 border-slate-800/60 bg-surface-900/70">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Classes</span>
          <p className="text-3xl font-bold text-white mt-2">{totalClasses}</p>
          <p className="text-xs text-slate-400 mt-1">Conducted to date</p>
        </Card>

        <Card className="p-5 border-slate-800/60 bg-surface-900/70">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Attended Classes</span>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{attendedClasses}</p>
          <p className="text-xs text-slate-400 mt-1">Present & verified</p>
        </Card>
      </div>

      {/* Subject-Wise Summary Table */}
      <Card className="p-6 border-slate-800/60 bg-surface-900/70">
        <h3 className="text-lg font-semibold text-white mb-4">Subject-wise Attendance Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800/80">
                <th className="py-3 pr-4">Subject</th>
                <th className="py-3 pr-4">Code</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Attended / Total</th>
                <th className="py-3 pr-4">Percentage</th>
                <th className="py-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No subject attendance records found.</td>
                </tr>
              ) : (
                summary.map((s) => {
                  const isShort = s.percentage < 75;
                  return (
                    <tr key={s.subject_id + s.class_type} className="hover:bg-surface-800/40">
                      <td className="py-3 pr-4 font-medium text-white">{s.subject_name}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-300">{s.subject_code}</td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded text-xs uppercase bg-surface-800 text-slate-300">
                          {s.class_type}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-200">{(s.attended_classes ?? s.attended ?? 0)} / {(s.total_classes ?? s.total_sessions ?? 0)}</td>
                      <td className="py-3 pr-4 font-bold text-emerald-400">
                        <span className={isShort ? "text-rose-400" : "text-emerald-400"}>
                          {s.percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isShort ? "bg-rose-950/40 text-rose-400 border border-rose-500/20" : "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"}`}>
                          {isShort ? "Short Attendance" : "Eligible"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Check-In History Table */}
      <Card className="p-6 border-slate-800/60 bg-surface-900/70">
        <h3 className="text-lg font-semibold text-white mb-4">Detailed Check-In History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800/80">
                <th className="py-3 pr-4">Date & Time</th>
                <th className="py-3 pr-4">Session ID</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Distance (m)</th>
                <th className="py-3 pr-4">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">No past check-in history found.</td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-surface-800/40">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-200">
                      {new Date(h.check_in_time).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">Session #{h.session_id}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${h.status === "present" ? "bg-emerald-950 text-emerald-300 border border-emerald-500/20" : "bg-amber-950 text-amber-300 border border-amber-500/20"}`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-300">
                      {h.distance_meters != null ? `${h.distance_meters.toFixed(1)} m` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" /> GPS Verified
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
