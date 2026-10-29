"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  api,
  AttendanceSession,
  AttendanceRecord,
  AdminAttendanceRecordItem,
  AdminAttendanceStats,
  RecordAuditLogItem,
  Department,
  SessionStatus,
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  Radio,
  Clock,
  RefreshCw,
  Users,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Filter,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Search,
  History,
  Calendar,
  MapPin,
  QrCode,
  Smartphone,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  X,
  FileText,
} from "lucide-react";

export default function AdminAttendancePage() {
  const [activeTab, setActiveTab] = useState<"sessions" | "records">("sessions");

  // Dynamic Statistics
  const [stats, setStats] = useState<AdminAttendanceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Sessions Tab State
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionSearch, setSessionSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "">("");
  const [sessionDateFilter, setSessionDateFilter] = useState<string>("");

  // Records Tab State
  const [records, setRecords] = useState<AdminAttendanceRecordItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordDeptFilter, setRecordDeptFilter] = useState<number | "">("");
  const [recordStatusFilter, setRecordStatusFilter] = useState<string>("");
  const [recordSuspiciousFilter, setRecordSuspiciousFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Departments for filters
  const [departments, setDepartments] = useState<Department[]>([]);

  // Inspect Session Details Modal
  const [viewSessionDetail, setViewSessionDetail] = useState<AttendanceSession | null>(null);

  // View Student Attendance Modal (Session records)
  const [attendanceModalSession, setAttendanceModalSession] = useState<AttendanceSession | null>(null);
  const [sessionAttendanceRecords, setSessionAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [sessionAttendanceLoading, setSessionAttendanceLoading] = useState(false);

  // End Session Confirmation Modal
  const [sessionToEnd, setSessionToEnd] = useState<AttendanceSession | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  // Manual Attendance Correction Modal
  const [overrideRecord, setOverrideRecord] = useState<AdminAttendanceRecordItem | null>(null);
  const [newStatus, setNewStatus] = useState("present");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Audit History Modal
  const [auditRecordId, setAuditRecordId] = useState<number | null>(null);
  const [auditRecordMeta, setAuditRecordMeta] = useState<{ studentName: string; subjectName: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<RecordAuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Global Alerts
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  // Load initial data
  useEffect(() => {
    loadDepartments();
    loadStats();
  }, []);

  // Reload tab data when filters or tab changes
  useEffect(() => {
    if (activeTab === "sessions") {
      loadSessions();
    } else {
      loadRecords();
    }
  }, [activeTab, deptFilter, statusFilter, sessionDateFilter, recordDeptFilter, recordStatusFilter, recordSuspiciousFilter, dateFrom, dateTo, pageSize, currentPage]);

  async function loadDepartments() {
    try {
      const depts = await api.academic.getDepartments();
      setDepartments(depts);
    } catch {
      // Non-critical if departments fail to load
    }
  }

  async function loadStats() {
    setStatsLoading(true);
    try {
      const res = await api.attendanceAdmin.getStats();
      setStats(res);
    } catch (err: any) {
      console.error("Failed to load attendance monitor stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const res = await api.attendanceAdmin.getSessions({
        department_id: deptFilter ? Number(deptFilter) : undefined,
        status: statusFilter ? (statusFilter as SessionStatus) : undefined,
        session_date: sessionDateFilter || undefined,
        query: sessionSearch.trim() || undefined,
      });
      setSessions(res);
    } catch (err: any) {
      console.error("Failed to load sessions:", err);
      setActionError(err.message || "Failed to load attendance sessions from backend.");
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadRecords() {
    setRecordsLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const res = await api.attendanceAdmin.getRecords({
        department_id: recordDeptFilter ? Number(recordDeptFilter) : undefined,
        status: recordStatusFilter || undefined,
        is_suspicious:
          recordSuspiciousFilter === "suspicious"
            ? true
            : recordSuspiciousFilter === "normal"
            ? false
            : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        query: recordSearch.trim() || undefined,
        limit: pageSize,
        offset,
      });
      setRecords(res);
    } catch (err: any) {
      console.error("Failed to load attendance records:", err);
      setActionError(err.message || "Failed to load check-in records from backend.");
    } finally {
      setRecordsLoading(false);
    }
  }

  // Handle Search Execution
  function handleSessionSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadSessions();
  }

  function handleRecordSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCurrentPage(1);
    loadRecords();
  }

  function clearSessionFilters() {
    setSessionSearch("");
    setDeptFilter("");
    setStatusFilter("");
    setSessionDateFilter("");
    setTimeout(() => loadSessions(), 0);
  }

  function clearRecordFilters() {
    setRecordSearch("");
    setRecordDeptFilter("");
    setRecordStatusFilter("");
    setRecordSuspiciousFilter("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
    setTimeout(() => loadRecords(), 0);
  }

  // Open Student Attendance Modal for a session
  async function handleOpenStudentAttendance(session: AttendanceSession) {
    setAttendanceModalSession(session);
    setSessionAttendanceLoading(true);
    try {
      const recs = await api.attendance.getSessionRecords(session.id);
      setSessionAttendanceRecords(recs);
    } catch (err: any) {
      setActionError(err.message || "Failed to load session student records");
    } finally {
      setSessionAttendanceLoading(false);
    }
  }

  // Refresh single session records
  async function handleRefreshSingleSession(sessionId: number) {
    try {
      const updatedSessions = await api.attendanceAdmin.getSessions({
        department_id: deptFilter ? Number(deptFilter) : undefined,
        status: statusFilter ? (statusFilter as SessionStatus) : undefined,
        session_date: sessionDateFilter || undefined,
      });
      setSessions(updatedSessions);
      loadStats();
      setActionSuccess(`Session #${sessionId} refreshed with latest records.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to refresh session");
    }
  }

  // End Session Confirm & Execute
  async function handleConfirmEndSession() {
    if (!sessionToEnd) return;
    setEndingSession(true);
    try {
      await api.attendance.closeSession(sessionToEnd.id);
      setActionSuccess(`Session #${sessionToEnd.id} (${sessionToEnd.subject_name}) successfully ended.`);
      setSessionToEnd(null);
      loadSessions();
      loadStats();
    } catch (err: any) {
      setActionError(err.message || "Failed to end session");
    } finally {
      setEndingSession(false);
    }
  }

  // Open Manual Override Modal
  function handleOpenOverride(record: AdminAttendanceRecordItem) {
    setOverrideRecord(record);
    setNewStatus(record.status.toLowerCase());
    setOverrideReason("");
  }

  // Submit Manual Attendance Override
  async function handleSaveOverride() {
    if (!overrideRecord) return;
    if (!overrideReason.trim() || overrideReason.trim().length < 4) {
      setActionError("A detailed administrative reason (minimum 4 characters) is mandatory for attendance override.");
      return;
    }
    setOverrideSubmitting(true);
    try {
      await api.attendanceAdmin.overrideRecord(overrideRecord.id, newStatus, overrideReason.trim());
      setActionSuccess(`Attendance record for ${overrideRecord.student_name} updated to ${newStatus.toUpperCase()}.`);
      setOverrideRecord(null);
      setOverrideReason("");
      loadRecords();
      loadStats();
    } catch (err: any) {
      setActionError(err.message || "Failed to apply attendance override.");
    } finally {
      setOverrideSubmitting(false);
    }
  }

  // Open Record Audit History Modal
  async function handleOpenAuditHistory(record: AdminAttendanceRecordItem) {
    setAuditRecordId(record.id);
    setAuditRecordMeta({
      studentName: record.student_name,
      subjectName: record.subject_name,
    });
    setAuditLoading(true);
    try {
      const logs = await api.attendanceAdmin.getRecordHistory(record.id);
      setAuditLogs(logs);
    } catch (err: any) {
      setActionError(err.message || "Failed to load record audit history");
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1 flex items-center gap-1.5 font-mono">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-emerald-400 font-semibold">Attendance Monitor &amp; Control</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Campus Attendance Control &amp; Overrides
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Monitor
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Real-time administrative monitor for live academic sessions, student check-in verification evidence,
            and authorized audit-trailed attendance corrections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              loadStats();
              if (activeTab === "sessions") loadSessions();
              else loadRecords();
            }}
            variant="outline"
            className="flex items-center gap-2 text-xs border-slate-700 bg-surface-900/60 hover:bg-surface-800 text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
            Refresh All
          </Button>
          <Link href="/dashboard/timetable">
            <Button
              variant="outline"
              className="flex items-center gap-2 text-xs border-slate-700 bg-surface-900/60 hover:bg-surface-800 text-slate-300"
            >
              <Calendar className="h-3.5 w-3.5 text-cyan-400" />
              Timetable Schedule
            </Button>
          </Link>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Active Sessions */}
        <Card className="p-4 border-slate-800/80 bg-surface-900/70 hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Sessions</span>
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {statsLoading ? "—" : stats?.active_sessions ?? 0}
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">live now</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Classrooms running attendance</p>
        </Card>

        {/* Scheduled Sessions Today */}
        <Card className="p-4 border-slate-800/80 bg-surface-900/70 hover:border-cyan-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Scheduled Today</span>
            <Clock className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {statsLoading ? "—" : stats?.scheduled_today ?? 0}
            </span>
            <span className="text-[11px] text-cyan-400 font-medium">classes</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Timetable entries for today</p>
        </Card>

        {/* Completed Sessions Today */}
        <Card className="p-4 border-slate-800/80 bg-surface-900/70 hover:border-violet-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Completed Today</span>
            <CheckCircle2 className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {statsLoading ? "—" : stats?.completed_today ?? 0}
            </span>
            <span className="text-[11px] text-violet-400 font-medium">ended</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Concluded faculty sessions</p>
        </Card>

        {/* Students Present Today */}
        <Card className="p-4 border-slate-800/80 bg-surface-900/70 hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Students Present</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {statsLoading ? "—" : stats?.students_present ?? 0}
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">verified</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Today&apos;s verified check-ins</p>
        </Card>

        {/* Late Check-ins */}
        <Card className="p-4 border-slate-800/80 bg-surface-900/70 hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Late Check-ins</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {statsLoading ? "—" : stats?.late_checkins ?? 0}
            </span>
            <span className="text-[11px] text-amber-400 font-medium">flagged</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Arrived past session grace period</p>
        </Card>

        {/* Failed or Suspicious Check-ins */}
        <Card className="p-4 border-slate-800/80 bg-surface-900/70 hover:border-rose-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Failed / Suspicious</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {statsLoading ? "—" : stats?.suspicious_checkins ?? 0}
            </span>
            <span className="text-[11px] text-rose-400 font-medium">anomalies</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">GPS mismatch, proxy, or device drift</p>
        </Card>
      </div>

      {/* Global Toast / Alerts */}
      {actionSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-400 text-xs shadow-lg animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <p className="flex-1 font-medium">{actionSuccess}</p>
          <button onClick={() => setActionSuccess("")} className="hover:text-white p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-400 text-xs shadow-lg animate-in fade-in">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="flex-1 font-medium">{actionError}</p>
          <button onClick={() => setActionError("")} className="hover:text-white p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("sessions")}
            className={`px-5 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === "sessions"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            Live &amp; Scheduled Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab("records")}
            className={`px-5 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === "records"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Campus Check-In Records &amp; Overrides
          </button>
        </div>

        <div className="text-xs text-slate-500 font-mono hidden md:block">
          {activeTab === "sessions"
            ? `${sessions.length} sessions listed`
            : `${records.length} records shown`}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: Live & Scheduled Sessions */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          {/* Sessions Filter Toolbar */}
          <Card className="p-4 border-slate-800/70 bg-surface-900/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <form onSubmit={handleSessionSearchSubmit} className="relative min-w-[220px] max-w-xs flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search subject, faculty, room..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-800 bg-surface-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </form>

              {/* Department Filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value ? Number(e.target.value) : "")}
                className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active (Live)</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Date Filter */}
              <input
                type="date"
                value={sessionDateFilter}
                onChange={(e) => setSessionDateFilter(e.target.value)}
                className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              />

              {(sessionSearch || deptFilter || statusFilter || sessionDateFilter) && (
                <button
                  type="button"
                  onClick={clearSessionFilters}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-surface-800"
                >
                  <X className="h-3 w-3" /> Clear Filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadSessions}
                className="text-xs flex items-center gap-1.5 border-slate-700 bg-surface-950 text-slate-300"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </div>
          </Card>

          {/* Sessions List Table */}
          <Card className="border-slate-800/70 bg-surface-900/60 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs table-auto">
                <thead className="bg-surface-950/80 text-slate-400 border-b border-slate-800/80 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Session</th>
                    <th className="py-3 px-4">Subject &amp; Type</th>
                    <th className="py-3 px-4">Faculty Instructor</th>
                    <th className="py-3 px-4">Academic Scope</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Attendance Stats</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sessionsLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                          <span>Loading active &amp; scheduled sessions from backend...</span>
                        </div>
                      </td>
                    </tr>
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="mx-auto h-12 w-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 border border-slate-700/60">
                            <Calendar className="h-6 w-6 text-emerald-400" />
                          </div>
                          <h3 className="text-base font-semibold text-white">No Attendance Sessions Found</h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Attendance sessions appear dynamically when faculty members initiate attendance for their classes
                            or when active class sessions are running.
                            {stats?.scheduled_today ? ` Today has ${stats.scheduled_today} scheduled classes in the timetable.` : ""}
                          </p>
                          <div className="flex items-center justify-center gap-3 pt-2">
                            <Link href="/dashboard/timetable">
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 shadow-lg shadow-emerald-600/20">
                                <Calendar className="h-3.5 w-3.5" />
                                View Today&apos;s Timetable Schedule
                              </Button>
                            </Link>
                            {(sessionSearch || deptFilter || statusFilter || sessionDateFilter) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={clearSessionFilters}
                                className="text-xs border-slate-700 text-slate-300"
                              >
                                Clear Active Filters
                              </Button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => {
                      const isLive = s.status === "active";
                      const present = s.present_count ?? s.total_present ?? 0;
                      const late = s.late_count ?? 0;
                      const enrolled = s.total_enrolled ?? 0;
                      const absent = s.absent_count ?? Math.max(0, enrolled - present - late);

                      return (
                        <tr key={s.id} className="hover:bg-surface-800/40 transition">
                          {/* Session ID */}
                          <td className="py-3 px-4 font-mono font-medium text-slate-300">
                            #{s.id}
                          </td>

                          {/* Subject & Type */}
                          <td className="py-3 px-4">
                            <p className="font-semibold text-white">{s.subject_name || "—"}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-emerald-400 font-medium">
                                {s.subject_code || "N/A"}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                {s.class_type || "Theory"}
                              </span>
                            </div>
                          </td>

                          {/* Faculty */}
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-200">{s.faculty_name || "Faculty"}</p>
                            {s.faculty_employee_id && (
                              <p className="text-[10px] font-mono text-slate-500">ID: {s.faculty_employee_id}</p>
                            )}
                          </td>

                          {/* Scope */}
                          <td className="py-3 px-4">
                            <p className="text-slate-300 font-medium">{s.section_name || "Section"}</p>
                            <p className="text-[10px] text-slate-500">
                              {s.student_group_name ? `Group ${s.student_group_name}` : "Whole Section"}
                              {s.branch_name ? ` · ${s.branch_name}` : ""}
                            </p>
                          </td>

                          {/* Date & Time */}
                          <td className="py-3 px-4 font-mono text-slate-400">
                            <div>{s.session_date || "—"}</div>
                            <div className="text-[10px] text-slate-500">
                              {s.started_at
                                ? new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : s.start_time
                                ? s.start_time.slice(0, 5)
                                : "—"}
                              {s.ended_at && ` - ${new Date(s.ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                            </div>
                          </td>

                          {/* Room */}
                          <td className="py-3 px-4 font-mono text-slate-200 font-semibold">
                            {s.room_number || "—"}
                          </td>

                          {/* Attendance Counts */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="text-emerald-400 font-semibold">{present}</span>
                                <span className="text-slate-500">P</span>
                              </div>
                              <span className="text-slate-700">|</span>
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="text-amber-400 font-semibold">{late}</span>
                                <span className="text-slate-500">L</span>
                              </div>
                              <span className="text-slate-700">|</span>
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="text-slate-400 font-semibold">{absent}</span>
                                <span className="text-slate-500">A</span>
                              </div>
                              <span className="text-slate-600 text-[10px]">({enrolled} tot)</span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4">
                            {isLive ? (
                              <Badge variant="emerald" dot={true}>
                                Active
                              </Badge>
                            ) : s.status === "completed" ? (
                              <Badge variant="violet">Completed</Badge>
                            ) : s.status === "closed" ? (
                              <Badge variant="slate">Closed</Badge>
                            ) : s.status === "scheduled" ? (
                              <Badge variant="cyan">Scheduled</Badge>
                            ) : (
                              <Badge variant="rose">Cancelled</Badge>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Details */}
                              <button
                                onClick={() => setViewSessionDetail(s)}
                                title="View Session Details & Geofence"
                                className="p-1.5 rounded-lg border border-slate-800 bg-surface-950 text-slate-300 hover:text-white hover:border-slate-700 transition"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>

                              {/* View Student Attendance */}
                              <button
                                onClick={() => handleOpenStudentAttendance(s)}
                                title="View Enrolled Student Attendance"
                                className="p-1.5 rounded-lg border border-slate-800 bg-surface-950 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition"
                              >
                                <Users className="h-3.5 w-3.5" />
                              </button>

                              {/* Refresh */}
                              <button
                                onClick={() => handleRefreshSingleSession(s.id)}
                                title="Refresh Session"
                                className="p-1.5 rounded-lg border border-slate-800 bg-surface-950 text-slate-400 hover:text-white transition"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>

                              {/* End Session (If Active) */}
                              {isLive && (
                                <button
                                  onClick={() => setSessionToEnd(s)}
                                  title="End Active Session"
                                  className="px-2 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-semibold text-[11px] transition"
                                >
                                  End Session
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: Campus Check-In Records & Overrides */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "records" && (
        <div className="space-y-4">
          {/* Records Filter Toolbar */}
          <Card className="p-4 border-slate-800/70 bg-surface-900/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <form onSubmit={handleRecordSearchSubmit} className="relative min-w-[220px] max-w-xs flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search student, roll number, subject..."
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-800 bg-surface-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </form>

              {/* Department Filter */}
              <select
                value={recordDeptFilter}
                onChange={(e) => {
                  setRecordDeptFilter(e.target.value ? Number(e.target.value) : "");
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={recordStatusFilter}
                onChange={(e) => {
                  setRecordStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused (Medical / Duty)</option>
              </select>

              {/* Suspicious Filter */}
              <select
                value={recordSuspiciousFilter}
                onChange={(e) => {
                  setRecordSuspiciousFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Security Flags</option>
                <option value="suspicious">Suspicious / Flagged Only</option>
                <option value="normal">Verified Normal Only</option>
              </select>

              {/* Date From */}
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <span>From:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-slate-800 bg-surface-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Date To */}
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <span>To:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-slate-800 bg-surface-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {(recordSearch || recordDeptFilter || recordStatusFilter || recordSuspiciousFilter || dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={clearRecordFilters}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-surface-800"
                >
                  <X className="h-3 w-3" /> Clear Filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-800 bg-surface-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </Card>

          {/* Master Records Table */}
          <Card className="border-slate-800/70 bg-surface-900/60 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs table-auto">
                <thead className="bg-surface-950/80 text-slate-400 border-b border-slate-800/80 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Record ID</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Subject &amp; Session</th>
                    <th className="py-3 px-4">Check-In Time</th>
                    <th className="py-3 px-4">Attendance Status</th>
                    <th className="py-3 px-4">GPS Verification</th>
                    <th className="py-3 px-4">Device Verification</th>
                    <th className="py-3 px-4">Anomaly Flag</th>
                    <th className="py-3 px-4">Audit Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recordsLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                          <span>Loading campus check-in records and verification evidence...</span>
                        </div>
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="mx-auto h-12 w-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 border border-slate-700/60">
                            <ShieldCheck className="h-6 w-6 text-emerald-400" />
                          </div>
                          <h3 className="text-base font-semibold text-white">No Check-In Records Found</h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Check-in records will appear here as students mark attendance via GPS and QR code verification.
                          </p>
                          {(recordSearch || recordDeptFilter || recordStatusFilter || recordSuspiciousFilter || dateFrom || dateTo) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={clearRecordFilters}
                              className="text-xs border-slate-700 text-slate-300"
                            >
                              Clear Active Filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => {
                      const isPresent = r.status.toLowerCase() === "present";
                      const isLate = r.status.toLowerCase() === "late";
                      const isExcused = r.status.toLowerCase() === "excused";

                      return (
                        <tr key={r.id} className="hover:bg-surface-800/40 transition">
                          {/* Record ID */}
                          <td className="py-3 px-4 font-mono font-medium text-slate-400">
                            #{r.id}
                          </td>

                          {/* Student */}
                          <td className="py-3 px-4">
                            <p className="font-semibold text-white">{r.student_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] text-cyan-400 font-medium">
                                {r.roll_number}
                              </span>
                              {r.enrollment_number && (
                                <>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {r.enrollment_number}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Subject & Session */}
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-200">{r.subject_name}</p>
                            <p className="text-[10px] text-slate-500">
                              Session #{r.session_id} {r.section_name ? `· ${r.section_name}` : ""}
                            </p>
                          </td>

                          {/* Timestamp */}
                          <td className="py-3 px-4 font-mono text-slate-300">
                            <div>{r.check_in_time || (r.marked_at ? new Date(r.marked_at).toLocaleTimeString() : "—")}</div>
                            <div className="text-[10px] text-slate-500">
                              {r.marked_at ? new Date(r.marked_at).toLocaleDateString() : ""}
                            </div>
                          </td>

                          {/* Attendance Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                                isPresent
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                  : isLate
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                  : isExcused
                                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                                  : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>

                          {/* GPS Verification Status */}
                          <td className="py-3 px-4">
                            {r.distance_meters != null ? (
                              <div>
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400 font-medium">
                                  <MapPin className="h-3 w-3" />
                                  {r.distance_meters.toFixed(1)}m away
                                </span>
                                <p className="text-[10px] text-slate-500">Inside boundary</p>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Not recorded</span>
                            )}
                          </td>

                          {/* Device Verification */}
                          <td className="py-3 px-4 font-mono text-[11px]">
                            {r.device_id ? (
                              <div className="max-w-[130px] truncate" title={r.device_id}>
                                <span className="text-slate-300 flex items-center gap-1">
                                  <Smartphone className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                                  {r.device_id}
                                </span>
                                <span className="text-[10px] text-slate-500">Verified</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">No Device ID</span>
                            )}
                          </td>

                          {/* Anomaly Flag */}
                          <td className="py-3 px-4">
                            {r.is_suspicious ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                title={r.suspicion_reason || "Flagged suspicious activity"}
                              >
                                <AlertTriangle className="h-3 w-3" /> Flagged
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                <ShieldCheck className="h-3.5 w-3.5" /> OK
                              </span>
                            )}
                          </td>

                          {/* Audit Status */}
                          <td className="py-3 px-4 text-xs">
                            {r.is_manually_adjusted ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  Override
                                </span>
                                <p className="text-[10px] text-slate-400 truncate max-w-[140px] mt-0.5" title={r.adjustment_reason || ""}>
                                  {r.adjustment_reason || "Manual adjustment"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">System Auto</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Override Button */}
                              <button
                                onClick={() => handleOpenOverride(r)}
                                title="Authorize Manual Attendance Correction"
                                className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-semibold text-[11px] flex items-center gap-1 transition"
                              >
                                <Edit3 className="h-3 w-3" /> Override
                              </button>

                              {/* Audit Trail Button */}
                              <button
                                onClick={() => handleOpenAuditHistory(r)}
                                title="View Record Audit History"
                                className="p-1 rounded-lg border border-slate-800 bg-surface-950 text-slate-400 hover:text-white transition"
                              >
                                <History className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {records.length > 0 && (
              <div className="p-3 bg-surface-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Showing {records.length} records (Page {currentPage})
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="text-xs border-slate-800 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3 w-3" /> Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={records.length < pageSize}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="text-xs border-slate-800 disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: Session Details Modal */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!viewSessionDetail}
        onClose={() => setViewSessionDetail(null)}
        title={`Session Details — #${viewSessionDetail?.id}`}
        description={`${viewSessionDetail?.subject_name} (${viewSessionDetail?.subject_code})`}
      >
        {viewSessionDetail && (
          <div className="space-y-4 text-xs">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-800 bg-surface-950">
              <div>
                <span className="text-slate-500 uppercase font-semibold text-[10px]">Faculty Instructor</span>
                <p className="text-sm font-semibold text-white mt-0.5">{viewSessionDetail.faculty_name}</p>
                {viewSessionDetail.faculty_employee_id && (
                  <p className="font-mono text-slate-400 text-[11px]">ID: {viewSessionDetail.faculty_employee_id}</p>
                )}
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold text-[10px]">Academic Scope</span>
                <p className="text-sm font-semibold text-white mt-0.5">{viewSessionDetail.section_name}</p>
                <p className="text-slate-400 text-[11px]">
                  {viewSessionDetail.student_group_name ? `Group ${viewSessionDetail.student_group_name}` : "Whole Section"}
                  {viewSessionDetail.branch_name ? ` · ${viewSessionDetail.branch_name}` : ""}
                </p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold text-[10px]">Classroom / Room</span>
                <p className="text-sm font-mono font-semibold text-emerald-400 mt-0.5">
                  {viewSessionDetail.room_number || "Not assigned"}
                </p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold text-[10px]">Session Status</span>
                <div className="mt-0.5">
                  <Badge variant={viewSessionDetail.status === "active" ? "emerald" : "slate"}>
                    {viewSessionDetail.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Attendance Counts */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl border border-slate-800 bg-surface-950">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Enrolled</span>
                <p className="text-lg font-bold text-white mt-1">{viewSessionDetail.total_enrolled ?? 0}</p>
              </div>
              <div>
                <span className="text-[10px] text-emerald-500 uppercase font-semibold">Present Verified</span>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {(viewSessionDetail.present_count ?? 0) + (viewSessionDetail.late_count ?? 0)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Absent / Unmarked</span>
                <p className="text-lg font-bold text-slate-400 mt-1">{viewSessionDetail.absent_count ?? 0}</p>
              </div>
            </div>

            {/* Geofence & QR Details */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-950 space-y-2">
              <h4 className="font-semibold text-white flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                Geofence &amp; Security Boundary
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                <div>
                  Latitude: <span className="text-slate-200">{viewSessionDetail.geofence_latitude ?? "Default Campus"}</span>
                </div>
                <div>
                  Longitude: <span className="text-slate-200">{viewSessionDetail.geofence_longitude ?? "Default Campus"}</span>
                </div>
                <div>
                  Radius: <span className="text-slate-200">{viewSessionDetail.geofence_radius_meters ?? 50}m</span>
                </div>
                <div>
                  Active Dynamic QR: <span className="text-slate-200">{viewSessionDetail.active_qr_token ? "Yes" : "None"}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setViewSessionDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: View Student Attendance for Session */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!attendanceModalSession}
        onClose={() => setAttendanceModalSession(null)}
        title={`Student Attendance — Session #${attendanceModalSession?.id}`}
        description={`${attendanceModalSession?.subject_name} · ${attendanceModalSession?.faculty_name}`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-surface-950 text-xs">
            <div>
              <span className="text-slate-400">Total Enrolled</span>
              <p className="text-base font-bold text-white">
                {attendanceModalSession?.total_enrolled ?? sessionAttendanceRecords.length}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Verified Check-Ins</span>
              <p className="text-base font-bold text-emerald-400">
                {sessionAttendanceRecords.length}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Session Status</span>
              <p className="text-sm font-mono font-semibold text-slate-200 uppercase mt-0.5">
                {attendanceModalSession?.status}
              </p>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs table-auto">
              <thead className="bg-surface-950 text-slate-400 border-b border-slate-800 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Roll Number</th>
                  <th className="py-2.5 px-3">Check-In Time</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Distance</th>
                  <th className="py-2.5 px-3">Security Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sessionAttendanceLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                        <span>Loading student attendance records...</span>
                      </div>
                    </td>
                  </tr>
                ) : sessionAttendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No student check-in records have been marked yet for this session.
                    </td>
                  </tr>
                ) : (
                  sessionAttendanceRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-800/40">
                      <td className="py-2.5 px-3 font-medium text-white">{r.student_name || "Student"}</td>
                      <td className="py-2.5 px-3 font-mono text-cyan-400">{r.roll_number || "—"}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="uppercase text-emerald-400 font-semibold">{r.status}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {r.distance_meters != null ? `${r.distance_meters.toFixed(1)}m` : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.is_suspicious ? (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Flagged
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setAttendanceModalSession(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: End Session Confirmation Modal */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!sessionToEnd}
        onClose={() => setSessionToEnd(null)}
        title="Confirm Session Termination"
        description="Institutional Attendance Control"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold text-white text-sm">Are you sure you want to end this active session?</p>
              <p className="mt-1 text-slate-300 leading-relaxed">
                Closing <strong>Session #{sessionToEnd?.id} ({sessionToEnd?.subject_name})</strong> will immediately stop
                dynamic QR token rotation. Students will no longer be permitted to check in.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-800 bg-surface-950 font-mono text-slate-400 space-y-1">
            <div>Faculty: <span className="text-white">{sessionToEnd?.faculty_name}</span></div>
            <div>Section: <span className="text-white">{sessionToEnd?.section_name}</span></div>
            <div>Room: <span className="text-white">{sessionToEnd?.room_number || "—"}</span></div>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            This action will be logged in the permanent administrative audit trail with your Admin user ID.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={endingSession}
              onClick={() => setSessionToEnd(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={endingSession}
              onClick={handleConfirmEndSession}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              {endingSession ? "Terminating..." : "Yes, End Active Session"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: Manual Attendance Correction (Override) Modal */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!overrideRecord}
        onClose={() => setOverrideRecord(null)}
        title="Authorized Attendance Correction"
        description="Manual Override with Institutional Audit Trail"
      >
        {overrideRecord && (
          <div className="space-y-4 text-xs">
            {/* Record Summary */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-950 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Student</span>
                  <p className="text-sm font-bold text-white">{overrideRecord.student_name}</p>
                  <p className="font-mono text-cyan-400 text-[11px]">{overrideRecord.roll_number}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Current Status</span>
                  <p className="font-semibold text-amber-400 uppercase text-sm">{overrideRecord.status}</p>
                </div>
              </div>
              <div className="text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px]">
                <span>Subject: {overrideRecord.subject_name}</span>
                <span>Session #{overrideRecord.session_id}</span>
              </div>
            </div>

            {/* Selection */}
            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-300 block mb-1.5">
                New Attendance Status <span className="text-rose-400">*</span>
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="present">PRESENT — Verified in Class</option>
                <option value="late">LATE — Arrived after grace period</option>
                <option value="absent">ABSENT — Did not attend</option>
                <option value="excused">EXCUSED — Approved Medical / Official Duty</option>
              </select>
            </div>

            {/* Mandatory Reason */}
            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-300 block mb-1.5">
                Mandatory Administrative Reason <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Official medical certificate #MED-2024 verified by Dean. Sensor glitch override."
                className="w-full rounded-xl border border-slate-800 bg-surface-950 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                This reason is auditable by the Academic Council and cannot be deleted.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={overrideSubmitting}
                onClick={() => setOverrideRecord(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={overrideSubmitting || !overrideReason.trim()}
                onClick={handleSaveOverride}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                {overrideSubmitting ? "Saving..." : "Apply & Audit Correction"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 5: Record Audit History Modal */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!auditRecordId}
        onClose={() => setAuditRecordId(null)}
        title="Attendance Record Audit Trail"
        description={`${auditRecordMeta?.studentName} · ${auditRecordMeta?.subjectName}`}
      >
        <div className="space-y-4 text-xs">
          {auditLoading ? (
            <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
              <span>Fetching immutable audit trail...</span>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <History className="h-8 w-8 mx-auto mb-2 text-slate-600" />
              <p>No administrative manual overrides have been logged for this record.</p>
              <p className="text-[10px] text-slate-600 mt-1">Original automated check-in has not been modified.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-slate-800 bg-surface-950 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
                      {log.action}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    Changed by: <strong className="text-white">{log.user_name}</strong>{" "}
                    <span className="text-slate-500 font-mono">({log.user_role || "ADMIN"})</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-slate-400">{log.old_status?.toUpperCase() || "ORIGINAL"}</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-emerald-400 font-bold">{log.new_status?.toUpperCase() || "UPDATED"}</span>
                  </div>
                  {log.reason && (
                    <div className="text-[11px] text-slate-400 bg-surface-900/80 p-2 rounded-lg border border-slate-800">
                      Reason: <span className="text-slate-200">{log.reason}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setAuditRecordId(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
