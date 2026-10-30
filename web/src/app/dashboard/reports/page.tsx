"use client";

import { useEffect, useState, useCallback } from "react";
import { api, AdminAnalyticsData } from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Building2,
  Download,
  Percent,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function ReportsPage() {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.attendanceAdmin.getAnalytics();
      setData(res);
    } catch (err: unknown) {
      console.error("Failed to load analytics:", err);
      const message =
        err instanceof Error ? err.message : "Failed to load campus analytics data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleExportCSV() {
    try {
      setExporting(true);
      setExportError(null);
      const blob = await api.attendanceAdmin.exportCsvBlob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `GeoAttend_Attendance_Export_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error("Export error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to export CSV dataset.";
      setExportError(message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-400" />
            Campus Analytics & Executive Reports
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Aggregated campus attendance rates, department performance, anomaly distribution, and exportable datasets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-sm"
            title="Refresh Analytics"
          >
            <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting || loading || !data}
            className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
            ) : (
              <Download className="h-4 w-4 text-blue-400" />
            )}
            {exporting ? "Exporting..." : "Export CSV Dataset"}
          </button>
        </div>
      </div>

      {/* CSV Export Error Notification */}
      {exportError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-sm text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{exportError}</span>
          </div>
          <button
            onClick={() => setExportError(null)}
            className="text-xs text-rose-400 hover:text-white underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-16 text-center text-slate-400 backdrop-blur-xl">
          <RefreshCw className="mx-auto h-8 w-8 text-blue-400 animate-spin mb-3" />
          <p className="text-sm font-medium">Loading campus intelligence data...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-12 text-center backdrop-blur-xl">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-400 mb-3" />
          <h3 className="text-lg font-semibold text-white">Failed to load analytics data</h3>
          <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">{error}</p>
          <button
            onClick={loadData}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
          >
            <RefreshCw className="h-4 w-4 text-blue-400" />
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-16 text-center text-slate-400 backdrop-blur-xl">
          <BarChart3 className="mx-auto h-8 w-8 text-slate-500 mb-3" />
          <p className="text-sm">No campus analytics data available.</p>
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Overall Campus Attendance
                </span>
                <Percent className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="mt-3 text-3xl font-bold text-white">
                {data.overall_attendance_percentage}%
              </p>
              <div className="mt-2 flex items-center text-xs text-emerald-400 font-medium">
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                Minimum College Benchmark: 75%
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Today&apos;s Attendance
                </span>
                <CheckCircle2 className="h-5 w-5 text-blue-400" />
              </div>
              <p className="mt-3 text-3xl font-bold text-white">
                {data.today_attendance_count}
              </p>
              <div className="mt-2 text-xs text-slate-400">
                Marked across {data.today_sessions_count} scheduled slots
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Active Live Sessions
                </span>
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <p className="mt-3 text-3xl font-bold text-amber-400">
                {data.total_active_sessions}
              </p>
              <div className="mt-2 text-xs text-slate-400">
                Conducted in campus classrooms
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  AI Flagged Anomalies
                </span>
                <ShieldAlert className="h-5 w-5 text-rose-400" />
              </div>
              <p className="mt-3 text-3xl font-bold text-rose-400">
                {data.total_suspicious_activities}
              </p>
              <div className="mt-2 text-xs text-rose-400/80">
                {data.high_risk_anomalies} high-risk proxies prevented
              </div>
            </div>
          </div>

          {/* Department Breakdown & Weekly Attendance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Department Performance */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-400" />
                  Department-Wise Attendance
                </h2>
                <span className="text-xs text-slate-400">Target &gt; 75%</span>
              </div>
              <div className="space-y-4 pt-2">
                {data.department_attendance.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No active department records recorded yet.
                  </p>
                ) : (
                  data.department_attendance.map((d) => (
                    <div key={d.department_id} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-slate-200">
                          {d.department_name} ({d.department_code})
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {d.student_count} enrolled
                          </span>
                          <span className={`font-mono font-bold ${
                            d.attendance_rate >= 75
                              ? "text-emerald-400"
                              : d.attendance_rate >= 50
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}>
                            {d.attendance_rate}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            d.attendance_rate >= 75
                              ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                              : d.attendance_rate >= 50
                              ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                              : "bg-gradient-to-r from-rose-500 to-red-400"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(d.attendance_rate > 0 ? 5 : 0, d.attendance_rate))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Weekly Trend & AI Sentinel Overview */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    Weekly Attendance Trend
                  </h2>
                  <span className="text-xs text-slate-400">Current Week</span>
                </div>
                <div className="flex items-end justify-between gap-3 h-28 pt-4 pb-1 border-t border-slate-800/80">
                  {data.attendance_by_day.map((day) => (
                    <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-400 font-semibold">{day.rate}%</span>
                      <div className="w-full bg-slate-800 rounded-t h-16 flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-blue-600 to-emerald-400 rounded-t transition-all duration-500"
                          style={{ height: `${Math.min(100, Math.max(6, (day.rate / 100) * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-300 font-medium">{day.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Sentinel Autonomous Protection Summary */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    AI Autonomous Fraud Prevention Active
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Zero Review
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every check-in is evaluated against GPS distance (100m geofence), phone hardware binding, and 15s rotating QR codes. Verified records are approved in real time.
                </p>
                <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Official Attendance Audit</span>
                  <button
                    onClick={handleExportCSV}
                    disabled={exporting}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold underline flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
