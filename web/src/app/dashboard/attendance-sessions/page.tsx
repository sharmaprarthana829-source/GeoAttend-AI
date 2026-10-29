"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  AttendanceSession,
  AttendanceRecord,
  TimetableEntry,
} from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Clock,
  Play,
  Square,
  Users,
  RefreshCw,
  CalendarDays,
  ShieldCheck,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  Radio,
  ArrowRight,
  Search,
  Filter,
  X,
  Eye,
  Calendar,
  Layers,
  Check,
  AlertCircle,
  BookOpen,
  MapPin,
  FileSpreadsheet,
} from "lucide-react";

export default function FacultyAttendanceManagementPage() {
  const { user } = useDashboard();
  const router = useRouter();

  // Navigation tab state: "overview" | "scheduled" | "active" | "history"
  const [activeTab, setActiveTab] = useState<"overview" | "scheduled" | "active" | "history">("overview");

  // Core Data
  const [todayTimetable, setTodayTimetable] = useState<TimetableEntry[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [activeRecords, setActiveRecords] = useState<AttendanceRecord[]>([]);

  // Page States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // History Filter Controls
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState<"all" | "completed" | "cancelled">("all");
  const [historyDate, setHistoryDate] = useState("");

  // Roster Detail View Modal / Drawer
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [rosterSession, setRosterSession] = useState<AttendanceSession | null>(null);
  const [rosterRecords, setRosterRecords] = useState<AttendanceRecord[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");

  // Read URL query parameters on mount (e.g. ?tab=history&subject=CS201)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const tabParam = params.get("tab");
      if (tabParam === "history" || tabParam === "scheduled" || tabParam === "active" || tabParam === "overview") {
        setActiveTab(tabParam as any);
      }
      const sub = params.get("subject") || params.get("q");
      if (sub) {
        setHistorySearch(sub);
      }
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    loadSessions();
  }, [user]);

  // Polling records for active session every 4 seconds
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => {
      loadActiveSessionRecords(activeSession.id);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeSession]);

  async function loadSessions(isManualRefresh = false) {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [tt, sess] = await Promise.all([
        api.timetable.getFacultyToday().catch((err) => {
          console.error("Error fetching timetable:", err);
          return [] as TimetableEntry[];
        }),
        api.attendance.getFacultySessions(100).catch((err) => {
          console.error("Error fetching sessions:", err);
          return [] as AttendanceSession[];
        }),
      ]);

      setTodayTimetable(tt || []);
      setSessions(sess || []);

      const active = (sess || []).find((s) => s.status === "active");
      if (active) {
        setActiveSession(active);
        await loadActiveSessionRecords(active.id);
      } else {
        setActiveSession(null);
        setActiveRecords([]);
      }
    } catch (err: any) {
      console.error("Failed to load attendance management data:", err);
      setErrorMessage("Could not load attendance data. Please verify network connectivity and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadActiveSessionRecords(sessionId: number) {
    try {
      const recs = await api.attendance.getSessionRecords(sessionId);
      setActiveRecords(recs || []);
    } catch (err) {
      console.error("Error polling active session records:", err);
    }
  }

  async function handleStartSession(timetableEntryId: number) {
    if (activeSession) {
      alert(`Another session (#${activeSession.id} - ${activeSession.subject_name}) is currently active. Please close it before launching a new attendance session.`);
      return;
    }
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await api.attendance.startSession({ timetable_entry_id: timetableEntryId });
      await loadSessions();
      setActiveTab("active");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to start attendance session");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCloseSession(sessionId: number) {
    if (!confirm("Are you sure you want to close this attendance session? Students will no longer be able to check in.")) {
      return;
    }
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await api.attendance.closeSession(sessionId);
      await loadSessions();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to close session");
    } finally {
      setActionLoading(false);
    }
  }

  function handleContinueAttendance(session: AttendanceSession) {
    setActiveSession(session);
    setActiveTab("active");
    const el = document.getElementById("active-session-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function handleOpenRoster(session: AttendanceSession) {
    setRosterSession(session);
    setRosterSearch("");
    setRosterModalOpen(true);
    setRosterLoading(true);
    try {
      const recs = await api.attendance.getSessionRecords(session.id);
      setRosterRecords(recs || []);
    } catch (err) {
      console.error("Failed to fetch session roster records:", err);
      setRosterRecords([]);
    } finally {
      setRosterLoading(false);
    }
  }

  function handleResetFilters() {
    setHistorySearch("");
    setHistoryStatus("all");
    setHistoryDate("");
  }

  // Format Helpers
  function formatSessionSlot(s: AttendanceSession) {
    if (s.start_time && s.end_time) {
      return `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`;
    }
    return "Slot unassigned";
  }

  function formatSessionRun(s: AttendanceSession) {
    if (!s.started_at) return "—";
    const start = new Date(s.started_at);
    const startStr = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (!s.ended_at) return `Live since ${startStr}`;
    const end = new Date(s.ended_at);
    const endStr = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const diffMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const durStr = diffMinutes < 1 ? "<1m" : `${diffMinutes}m`;
    return `${startStr} – ${endStr} (${durStr})`;
  }

  // KPI Metrics
  const kpis = useMemo(() => {
    const active = sessions.filter((s) => s.status === "active").length;
    const completed = sessions.filter((s) => s.status === "completed").length;
    const cancelled = sessions.filter((s) => s.status === "cancelled").length;
    const totalCheckins = sessions.reduce((sum, s) => sum + (s.present_count || s.total_present || 0), 0);
    return {
      active,
      scheduled: todayTimetable.length,
      completed,
      cancelled,
      totalSessions: sessions.length,
      totalCheckins,
    };
  }, [sessions, todayTimetable]);

  // Filtered Session History
  const filteredHistory = useMemo(() => {
    return sessions.filter((s) => {
      // Completed and cancelled sessions belong in Session History
      if (historyStatus === "all") {
        if (s.status === "active") return false; // active sessions belong in Active Sessions area
      } else if (s.status !== historyStatus) {
        return false;
      }

      if (historyDate && s.session_date !== historyDate) {
        return false;
      }

      if (historySearch.trim()) {
        const q = historySearch.trim().toLowerCase();
        const matchId = `#${s.id}`.includes(q) || String(s.id).includes(q);
        const matchSubject =
          (s.subject_name && s.subject_name.toLowerCase().includes(q)) ||
          (s.subject_code && s.subject_code.toLowerCase().includes(q));
        const matchSection =
          (s.section_name && s.section_name.toLowerCase().includes(q)) ||
          (s.student_group_name && s.student_group_name.toLowerCase().includes(q));
        const matchRoom = s.room_number && s.room_number.toLowerCase().includes(q);

        if (!matchId && !matchSubject && !matchSection && !matchRoom) {
          return false;
        }
      }

      return true;
    });
  }, [sessions, historyStatus, historyDate, historySearch]);

  // Filtered Roster inside modal
  const filteredRosterRecords = useMemo(() => {
    if (!rosterSearch.trim()) return rosterRecords;
    const q = rosterSearch.trim().toLowerCase();
    return rosterRecords.filter((r) => {
      return (
        (r.student_name && r.student_name.toLowerCase().includes(q)) ||
        (r.roll_number && r.roll_number.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q))
      );
    });
  }, [rosterRecords, rosterSearch]);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-slate-300 font-medium">Attendance Management</span>
          </nav>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Clock className="h-6 w-6 text-emerald-400" /> Attendance Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Consolidated workspace for scheduled timetable classes, live session monitoring, and student attendance history.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => loadSessions(true)}
            variant="outline"
            disabled={refreshing || loading}
            className="flex items-center gap-2 text-xs border-slate-700 bg-surface-900 text-slate-300 hover:text-white hover:bg-surface-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Actionable Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 bg-surface-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Sessions</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-white">{kpis.active}</span>
              {kpis.active > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Now
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Monitoring real-time check-ins</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Radio className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-surface-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Scheduled Today</span>
            <p className="text-2xl font-bold text-white mt-1">{kpis.scheduled}</p>
            <p className="text-[11px] text-slate-500 mt-1">Classes on your timetable</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CalendarDays className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-surface-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Completed Sessions</span>
            <p className="text-2xl font-bold text-white mt-1">{kpis.completed}</p>
            <p className="text-[11px] text-slate-500 mt-1">{kpis.cancelled} cancelled</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-surface-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Verified Check-Ins</span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{kpis.totalCheckins}</p>
            <p className="text-[11px] text-slate-500 mt-1">Across all sessions</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Primary Section Switcher Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-950 border border-slate-800 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === "overview"
              ? "bg-surface-800 text-white shadow-sm font-semibold"
              : "text-slate-400 hover:text-white hover:bg-surface-900"
          }`}
        >
          <Layers className="h-3.5 w-3.5 text-emerald-400" />
          All Overview
        </button>

        <button
          onClick={() => setActiveTab("scheduled")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === "scheduled"
              ? "bg-surface-800 text-white shadow-sm font-semibold"
              : "text-slate-400 hover:text-white hover:bg-surface-900"
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
          Scheduled Classes ({kpis.scheduled})
        </button>

        <button
          onClick={() => setActiveTab("active")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === "active"
              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold"
              : "text-slate-400 hover:text-white hover:bg-surface-900"
          }`}
        >
          <Radio className={`h-3.5 w-3.5 ${kpis.active > 0 ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />
          Active Sessions ({kpis.active})
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === "history"
              ? "bg-surface-800 text-white shadow-sm font-semibold"
              : "text-slate-400 hover:text-white hover:bg-surface-900"
          }`}
        >
          <History className="h-3.5 w-3.5 text-purple-400" />
          Session History ({kpis.completed + kpis.cancelled})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* AREA B: ACTIVE SESSIONS (Live Monitor)                                    */}
      {/* ========================================================================= */}
      {(activeTab === "overview" || activeTab === "active") && (
        <div id="active-session-section" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Radio className={`h-4 w-4 ${activeSession ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />
              Area B: Active Attendance Sessions
            </h2>
            {activeSession && (
              <span className="text-xs text-slate-400">
                Live polling active · refreshing every 4s
              </span>
            )}
          </div>

          {activeSession ? (
            <Card className="p-6 border-emerald-500/40 bg-gradient-to-b from-surface-900 via-surface-900 to-emerald-950/25 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Live Active Session #{activeSession.id}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded uppercase font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                      {activeSession.class_type || "Theory"}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    {activeSession.subject_name}{" "}
                    {activeSession.subject_code ? (
                      <span className="text-sm font-mono text-emerald-400 font-normal">
                        ({activeSession.subject_code})
                      </span>
                    ) : null}
                  </h3>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400 mt-2">
                    <span>
                      Section: <strong className="text-slate-200">{activeSession.section_name}</strong>
                    </span>
                    {activeSession.student_group_name && (
                      <span>
                        · Group: <strong className="text-emerald-400">{activeSession.student_group_name}</strong>
                      </span>
                    )}
                    <span>
                      · Room: <strong className="text-slate-200">{activeSession.room_number || "C-204"}</strong>
                    </span>
                    <span>
                      · Scheduled Slot:{" "}
                      <strong className="text-emerald-400 font-mono">{formatSessionSlot(activeSession)}</strong>
                    </span>
                    <span>
                      · Started:{" "}
                      <strong className="text-slate-300 font-mono">
                        {activeSession.started_at ? new Date(activeSession.started_at).toLocaleTimeString() : "—"}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right px-4 py-2.5 rounded-xl bg-surface-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Live Attendance</span>
                    <p className="text-xl font-bold text-emerald-400">
                      {activeRecords.length} Present{" "}
                      {activeSession.total_enrolled ? (
                        <span className="text-xs font-normal text-slate-500">
                          / {activeSession.total_enrolled} enrolled
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleCloseSession(activeSession.id)}
                    disabled={actionLoading}
                    className="bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 shadow-lg text-xs"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    {actionLoading ? "Closing..." : "Close Session"}
                  </Button>
                </div>
              </div>

              {/* Live Check-In Stream Table */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" /> Live Verified Check-Ins ({activeRecords.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">Auto-synced</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-surface-950/60">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-surface-950 text-slate-400">
                        <th className="py-2.5 px-4 font-semibold">Roll Number</th>
                        <th className="py-2.5 px-4 font-semibold">Student Name</th>
                        <th className="py-2.5 px-4 font-semibold">Check-In Time</th>
                        <th className="py-2.5 px-4 font-semibold">Status</th>
                        <th className="py-2.5 px-4 font-semibold">Distance</th>
                        <th className="py-2.5 px-4 font-semibold">Verification Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeRecords.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                            Session is open and accepting check-ins. Waiting for eligible students within the geofence...
                          </td>
                        </tr>
                      ) : (
                        activeRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-surface-800/40 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-semibold text-slate-200">
                              {r.roll_number || `ST-${r.student_id}`}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-white">
                              {r.student_name || `Student #${r.student_id}`}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">
                              {r.marked_at
                                ? new Date(r.marked_at).toLocaleTimeString()
                                : r.check_in_time
                                ? r.check_in_time
                                : "—"}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded uppercase font-semibold text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/20">
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-300">
                              {r.distance_meters != null ? `${r.distance_meters.toFixed(1)} m` : "—"}
                            </td>
                            <td className="py-2.5 px-4">
                              {r.is_suspicious ? (
                                <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px]">
                                  <AlertTriangle className="h-3 w-3" /> Flagged
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                                  <ShieldCheck className="h-3 w-3" /> Verified
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 border-slate-800 bg-surface-900/50 text-center">
              <div className="max-w-md mx-auto py-4">
                <div className="h-10 w-10 mx-auto rounded-xl bg-surface-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                  <Radio className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">No Attendance Session Currently Active</h3>
                <p className="text-xs text-slate-400 mt-1">
                  You can launch an attendance session from your Scheduled Classes below, or inspect past logs in Session History.
                </p>
                {todayTimetable.length > 0 && activeTab === "active" && (
                  <Button
                    onClick={() => setActiveTab("scheduled")}
                    variant="outline"
                    className="mt-4 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/20"
                  >
                    View Scheduled Classes
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* AREA A: SCHEDULED CLASSES                                                 */}
      {/* ========================================================================= */}
      {(activeTab === "overview" || activeTab === "scheduled") && (
        <Card className="p-6 border-slate-800/80 bg-surface-900/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-400" />
                Area A: Scheduled Classes for Today
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Derived directly from your authorized teaching assignments and timetable.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-surface-950 border border-slate-800 text-slate-300 font-mono">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
              <span>Loading scheduled classes...</span>
            </div>
          ) : todayTimetable.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-surface-950/30">
              No classes scheduled on your timetable for today.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {todayTimetable.map((t) => {
                const isCurrentActive = activeSession?.timetable_entry_id === t.id;
                const isOtherActive = !!activeSession && !isCurrentActive;

                return (
                  <div
                    key={t.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                      isCurrentActive
                        ? "border-emerald-500/50 bg-emerald-950/20 shadow-lg"
                        : "border-slate-800 bg-surface-950/70 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white text-sm">
                          {t.subject_name}{" "}
                          {t.subject_code ? (
                            <span className="text-xs font-mono text-slate-400 font-normal">
                              ({t.subject_code})
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded uppercase font-semibold bg-surface-800 text-slate-300 border border-slate-700">
                          {t.class_type}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-slate-400">
                        <p>
                          Section: <strong className="text-slate-200">{t.section_name}</strong>{" "}
                          {t.student_group_name ? (
                            <span className="text-emerald-400">· Group {t.student_group_name}</span>
                          ) : (
                            <span className="text-slate-500">· Whole Section</span>
                          )}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-slate-500" />
                          Room: <strong className="text-slate-200">{t.room_number || "C-204"}</strong>
                        </p>
                        <p className="flex items-center gap-1.5 font-mono text-emerald-400">
                          <Clock className="h-3 w-3 text-emerald-500" />
                          {t.start_time ? t.start_time.slice(0, 5) : "—"} – {t.end_time ? t.end_time.slice(0, 5) : "—"}
                        </p>
                      </div>
                    </div>

                    {isCurrentActive ? (
                      <Button
                        onClick={() => handleContinueAttendance(activeSession)}
                        className="w-full text-xs flex items-center justify-center gap-2 bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40"
                      >
                        <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                        Session Active (Continue / Monitor)
                      </Button>
                    ) : isOtherActive ? (
                      <div className="space-y-1">
                        <Button
                          disabled
                          variant="outline"
                          className="w-full text-xs flex items-center justify-center gap-2 border-slate-800 bg-surface-900/60 text-slate-500 cursor-not-allowed"
                        >
                          Session Active Elsewhere
                        </Button>
                        <p className="text-[10px] text-amber-400/80 text-center">
                          Close active session #{activeSession.id} to start this class
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleStartSession(t.id)}
                        disabled={actionLoading}
                        className="w-full text-xs flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        {actionLoading ? "Starting..." : "Start Attendance"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* AREA C: SESSION HISTORY                                                   */}
      {/* ========================================================================= */}
      {(activeTab === "overview" || activeTab === "history") && (
        <Card className="p-6 border-slate-800/80 bg-surface-900/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <History className="h-4 w-4 text-purple-400" />
                Area C: Session History & Roster Logs
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect completed and cancelled sessions with accurate scheduled class duration, actual runtimes, and student rosters.
              </p>
            </div>

            {/* Quick Status Tabs inside History */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-950 border border-slate-800 text-xs font-medium self-start sm:self-auto">
              <button
                onClick={() => setHistoryStatus("all")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  historyStatus === "all"
                    ? "bg-surface-800 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All ({kpis.completed + kpis.cancelled})
              </button>
              <button
                onClick={() => setHistoryStatus("completed")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  historyStatus === "completed"
                    ? "bg-surface-800 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Completed ({kpis.completed})
              </button>
              <button
                onClick={() => setHistoryStatus("cancelled")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  historyStatus === "cancelled"
                    ? "bg-rose-950/70 text-rose-300 border border-rose-500/30 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Cancelled ({kpis.cancelled})
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="grid gap-3 sm:grid-cols-12 mb-4 p-3 rounded-xl bg-surface-950/80 border border-slate-800">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by subject, code, section, room, or #id..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-surface-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Date Filter */}
            <div className="sm:col-span-4 relative flex items-center gap-1.5">
              <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-900 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              {historyDate && (
                <button
                  onClick={() => setHistoryDate("")}
                  title="Clear date"
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Reset Controls Button */}
            <div className="sm:col-span-2 flex items-center justify-end">
              {(historySearch || historyDate || historyStatus !== "all") && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* History Sessions Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm table-auto text-left">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-800 bg-surface-950">
                  <th className="py-3 px-4">Session ID</th>
                  <th className="py-3 px-4">Subject & Code</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Section / Group</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Scheduled Slot</th>
                  <th className="py-3 px-4">Actual Session & Duration</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      Loading session history...
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-500">
                      {historySearch || historyDate || historyStatus !== "all"
                        ? "No sessions match your search and filter criteria."
                        : "No session history recorded yet."}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((s) => {
                    const presentCount = (s.present_count || 0) + (s.late_count || 0);
                    const enrolledCount = s.total_enrolled || 0;

                    return (
                      <tr key={s.id} className="hover:bg-surface-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-300">
                          #{s.id}
                        </td>
                        <td className="py-3 px-4 font-medium text-white">
                          <div>
                            <span>{s.subject_name}</span>
                            {s.subject_code && (
                              <span className="ml-1 text-[11px] font-mono text-emerald-400">
                                ({s.subject_code})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded uppercase font-semibold text-[10px] bg-surface-800 text-slate-300 border border-slate-700">
                            {s.class_type || "Theory"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {s.section_name}{" "}
                          {s.student_group_name ? (
                            <span className="text-emerald-400 text-[11px]">· G-{s.student_group_name}</span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">· Whole</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {s.session_date || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400">
                          {formatSessionSlot(s)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {formatSessionRun(s)}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="text-emerald-400 font-semibold">{presentCount}</span>
                          {enrolledCount > 0 ? (
                            <span className="text-slate-500"> / {enrolledCount}</span>
                          ) : null}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              s.status === "completed"
                                ? "bg-surface-800 text-slate-300 border border-slate-700"
                                : s.status === "cancelled"
                                ? "bg-rose-950/60 text-rose-300 border border-rose-500/25"
                                : "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRoster(s)}
                            className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/30 flex items-center gap-1 ml-auto"
                          >
                            <Eye className="h-3 w-3" /> View Roster
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* VIEW ROSTER MODAL                                                         */}
      {/* ========================================================================= */}
      {rosterModalOpen && rosterSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-surface-950/70">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                    Session #{rosterSession.id}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded uppercase font-semibold bg-surface-800 text-slate-300 border border-slate-700">
                    {rosterSession.class_type || "Theory"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded uppercase font-semibold text-slate-400">
                    {rosterSession.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {rosterSession.subject_name}{" "}
                  {rosterSession.subject_code ? (
                    <span className="text-sm font-mono text-emerald-400 font-normal">
                      ({rosterSession.subject_code})
                    </span>
                  ) : null}
                </h3>
                <p className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Section: <strong className="text-slate-200">{rosterSession.section_name}</strong></span>
                  {rosterSession.student_group_name && (
                    <span>· Group: <strong className="text-emerald-400">{rosterSession.student_group_name}</strong></span>
                  )}
                  <span>· Room: <strong className="text-slate-200">{rosterSession.room_number || "C-204"}</strong></span>
                  <span>· Date: <strong className="text-slate-200 font-mono">{rosterSession.session_date}</strong></span>
                  <span>· Slot: <strong className="text-emerald-400 font-mono">{formatSessionSlot(rosterSession)}</strong></span>
                </p>
              </div>

              <button
                onClick={() => setRosterModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Metrics Bar inside Modal */}
            <div className="px-5 py-3 bg-surface-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <span>
                  Present:{" "}
                  <strong className="text-emerald-400 font-mono">
                    {rosterRecords.filter((r) => r.status === "present").length}
                  </strong>
                </span>
                <span>
                  Late:{" "}
                  <strong className="text-amber-400 font-mono">
                    {rosterRecords.filter((r) => r.status === "late").length}
                  </strong>
                </span>
                <span>
                  Flagged:{" "}
                  <strong className="text-rose-400 font-mono">
                    {rosterRecords.filter((r) => r.is_suspicious).length}
                  </strong>
                </span>
                <span>
                  Total Enrolled:{" "}
                  <strong className="text-slate-300 font-mono">
                    {rosterSession.total_enrolled || rosterRecords.length}
                  </strong>
                </span>
              </div>

              {/* In-Modal Roster Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter student or roll #..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 rounded-lg bg-surface-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Roster Records Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {rosterLoading ? (
                <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
                  <span>Loading attendance records from database...</span>
                </div>
              ) : rosterRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-surface-950/20">
                  No attendance records logged for this session. (0 check-ins captured)
                </div>
              ) : filteredRosterRecords.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  No students match your filter "{rosterSearch}".
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-surface-950 text-slate-400">
                        <th className="py-2.5 px-4 font-semibold">Roll Number</th>
                        <th className="py-2.5 px-4 font-semibold">Student Name</th>
                        <th className="py-2.5 px-4 font-semibold">Check-In Time</th>
                        <th className="py-2.5 px-4 font-semibold">Distance</th>
                        <th className="py-2.5 px-4 font-semibold">Status</th>
                        <th className="py-2.5 px-4 font-semibold">Verification Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredRosterRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-surface-800/40">
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-200">
                            {r.roll_number || `ST-${r.student_id}`}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-white">
                            {r.student_name || `Student #${r.student_id}`}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-400">
                            {r.marked_at
                              ? new Date(r.marked_at).toLocaleTimeString()
                              : r.check_in_time
                              ? r.check_in_time
                              : "—"}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-300">
                            {r.distance_meters != null ? `${r.distance_meters.toFixed(1)} m` : "—"}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded uppercase font-semibold text-[10px] ${
                                r.status === "present"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                  : r.status === "late"
                                  ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                                  : "bg-rose-950 text-rose-300 border border-rose-500/30"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            {r.is_suspicious ? (
                              <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                                <AlertTriangle className="h-3 w-3" /> Flagged
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <ShieldCheck className="h-3 w-3" /> Verified
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-surface-950/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Displaying actual persisted database records for session #{rosterSession.id}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRosterModalOpen(false)}
                className="text-xs text-slate-300 hover:text-white"
              >
                Close Roster
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
