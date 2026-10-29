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
                  Overall Attendance
                </span>
                <Percent className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="mt-3 text-3xl font-bold text-white">
                {data.overall_attendance_percentage}%
              </p>
              <div className="mt-2 flex items-center text-xs text-emerald-400 font-medium">
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                Campus Benchmark &gt; 75%
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
                From {data.today_sessions_count} scheduled slots
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
                Conducted across campus rooms
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Suspicious / ML Flags
                </span>
                <ShieldAlert className="h-5 w-5 text-rose-400" />
              </div>
              <p className="mt-3 text-3xl font-bold text-rose-400">
                {data.total_suspicious_activities}
              </p>
              <div className="mt-2 text-xs text-rose-400/80">
                {data.high_risk_anomalies} high risk flagged
              </div>
            </div>
          </div>

          {/* Department Breakdown & Risk Distribution */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Department Performance */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" />
                Department-Wise Attendance Performance
              </h2>
              <div className="space-y-4 pt-2">
                {data.department_attendance.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No active department records found.
                  </p>
                ) : (
                  data.department_attendance.map((d) => (
                    <div key={d.department_id} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-slate-200">
                          {d.department_name} ({d.department_code})
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {d.attendance_rate}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, d.attendance_rate))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Anomaly & Risk Breakdown */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
                AI & ML Proxy Anomaly Pipeline
              </h2>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <span className="text-xs text-slate-400 uppercase">Pending Review</span>
                  <p className="mt-1 text-2xl font-bold text-amber-400">
                    {data.risk_distribution.pending_review}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <span className="text-xs text-slate-400 uppercase">Confirmed Fraud</span>
                  <p className="mt-1 text-2xl font-bold text-rose-400">
                    {data.risk_distribution.confirmed_fraud}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <span className="text-xs text-slate-400 uppercase">Dismissed Cases</span>
                  <p className="mt-1 text-2xl font-bold text-emerald-400">
                    {data.risk_distribution.dismissed}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <span className="text-xs text-slate-400 uppercase">High Risk &gt;70</span>
                  <p className="mt-1 text-2xl font-bold text-purple-400">
                    {data.risk_distribution.high_risk}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Weekly Attendance Trend</span>
                </div>
                <div className="flex items-end justify-between gap-2 h-24 pt-4 border-t border-slate-800/80">
                  {data.attendance_by_day.map((day) => (
                    <div key={day.day} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-mono text-emerald-400">{day.rate}%</span>
                      <div
                        className="w-full bg-blue-500/80 rounded-t transition-all duration-500"
                        style={{ height: `${Math.min(50, Math.max(4, (day.rate / 100) * 50))}px` }}
                      />
                      <span className="text-xs text-slate-400 font-medium">{day.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
