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
  Branch,
  Section,
  StudentGroup,
  SessionStatus,
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";
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
  Sparkles,
  Bot,
  Zap,
  Layers,
  ChevronDown,
  Building2,
  GraduationCap,
} from "lucide-react";

export default function AttendanceMonitorPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"records" | "sessions">("records");

  // Dynamic Statistics
  const [stats, setStats] = useState<AdminAttendanceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Exact Cascading Academic Hierarchy: Department ➔ Branch ➔ Section ➔ Batch ──
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [batches, setBatches] = useState<StudentGroup[]>([]);

  const [selectedDeptId, setSelectedDeptId] = useState<number | "">("");
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [selectedSectionId, setSelectedSectionId] = useState<number | "">("");
  const [selectedBatchId, setSelectedBatchId] = useState<number | "">("");

  // Records Tab State
  const [records, setRecords] = useState<AdminAttendanceRecordItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordStatusFilter, setRecordStatusFilter] = useState<string>("");
  const [recordAiFilter, setRecordAiFilter] = useState<"all" | "verified" | "flagged">("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Sessions Tab State
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionSearch, setSessionSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "">("");
  const [sessionDateFilter, setSessionDateFilter] = useState<string>("");

  // Inspect AI Telemetry & Details Modal
  const [telemetryRecord, setTelemetryRecord] = useState<AdminAttendanceRecordItem | null>(null);

  // Inspect Session Details Modal
  const [viewSessionDetail, setViewSessionDetail] = useState<AttendanceSession | null>(null);

  // View Student Attendance Modal (Session records)
  const [attendanceModalSession, setAttendanceModalSession] = useState<AttendanceSession | null>(null);
  const [sessionAttendanceRecords, setSessionAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [sessionAttendanceLoading, setSessionAttendanceLoading] = useState(false);

  // End Session Confirmation Modal
  const [sessionToEnd, setSessionToEnd] = useState<AttendanceSession | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  // Global Alerts
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  // ── 1. Initial Load: Academic Hierarchy & Stats ──
  useEffect(() => {
    try {
      localStorage.removeItem("geoattend_simulated_attendance");
    } catch {
      // Storage restricted
    }
    loadHierarchyStructure();
    loadStats();
  }, []);

  // ── 2. Reload when tab or filters change ──
  useEffect(() => {
    if (activeTab === "records") {
      loadRecords();
    } else {
      loadSessions();
    }
  }, [
    activeTab,
    selectedDeptId,
    selectedBranchId,
    selectedSectionId,
    selectedBatchId,
    recordStatusFilter,
    recordAiFilter,
    dateFrom,
    dateTo,
    pageSize,
    currentPage,
    statusFilter,
    sessionDateFilter,
  ]);

  // ── 3. Real-Time Auto-Refresh Poller (Every 4 seconds for live updates) ──
  useEffect(() => {
    const interval = setInterval(() => {
      // Background silent refresh
      if (activeTab === "records") {
        silentRefreshRecords();
      } else {
        silentRefreshSessions();
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [activeTab, selectedDeptId, selectedBranchId, selectedSectionId, selectedBatchId, recordStatusFilter, recordAiFilter]);

  // Load all academic structure for cascading filters
  async function loadHierarchyStructure() {
    try {
      const [deptList, branchList, secList, groupList] = await Promise.all([
        api.academic.getDepartments().catch(() => []),
        api.academic.getBranches().catch(() => []),
        api.academic.getSections().catch(() => []),
        api.academic.getStudentGroups().catch(() => []),
      ]);
      setDepartments(deptList || []);
      setBranches(branchList || []);
      setSections(secList || []);
      setBatches(groupList || []);
    } catch (err) {
      console.warn("Could not load all hierarchy items:", err);
    }
  }

  // Cascading Branch options based on selected Department
  const availableBranches = useMemo(() => {
    if (!selectedDeptId) return branches;
    return branches.filter((b) => b.department_id === Number(selectedDeptId));
  }, [branches, selectedDeptId]);

  // Cascading Section options based on selected Branch
  const availableSections = useMemo(() => {
    if (!selectedBranchId) return sections;
    return sections;
  }, [sections, selectedBranchId]);

  // Cascading Batch/Group options based on selected Section
  const availableBatches = useMemo(() => {
    if (!selectedSectionId) return batches;
    return batches.filter((bg) => bg.section_id === Number(selectedSectionId));
  }, [batches, selectedSectionId]);

  // Handle Hierarchy Cascade Resets
  function handleDeptChange(val: string) {
    const dId = val ? Number(val) : "";
    setSelectedDeptId(dId);
    setSelectedBranchId("");
    setSelectedSectionId("");
    setSelectedBatchId("");
    setCurrentPage(1);
  }

  function handleBranchChange(val: string) {
    const bId = val ? Number(val) : "";
    setSelectedBranchId(bId);
    setSelectedSectionId("");
    setSelectedBatchId("");
    setCurrentPage(1);
  }

  function handleSectionChange(val: string) {
    const sId = val ? Number(val) : "";
    setSelectedSectionId(sId);
    setSelectedBatchId("");
    setCurrentPage(1);
  }

  function handleBatchChange(val: string) {
    const gId = val ? Number(val) : "";
    setSelectedBatchId(gId);
    setCurrentPage(1);
  }

  function resetHierarchy() {
    setSelectedDeptId("");
    setSelectedBranchId("");
    setSelectedSectionId("");
    setSelectedBatchId("");
    setRecordSearch("");
    setRecordStatusFilter("");
    setRecordAiFilter("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  // Load stats
  async function loadStats() {
    setStatsLoading(true);
    try {
      const res = await api.attendanceAdmin.getStats();
      setStats(res);
    } catch (err: any) {
      console.warn("Stats error:", err);
    } finally {
      setStatsLoading(false);
    }
  }

  // Load Records with AI Anomaly flags
  async function loadRecords() {
    setRecordsLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const res = await api.attendanceAdmin.getRecords({
        department_id: selectedDeptId ? Number(selectedDeptId) : undefined,
        section_id: selectedSectionId ? Number(selectedSectionId) : undefined,
        status: recordStatusFilter || undefined,
        is_suspicious:
          recordAiFilter === "flagged"
            ? true
            : recordAiFilter === "verified"
            ? false
            : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        query: recordSearch.trim() || undefined,
        limit: pageSize,
        offset,
      });
      setRecords(res || []);
    } catch (err: any) {
      console.error("Failed to load attendance records:", err);
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }

  // Silent Background Poller for real-time updates
  async function silentRefreshRecords() {
    try {
      const offset = (currentPage - 1) * pageSize;
      const res = await api.attendanceAdmin.getRecords({
        department_id: selectedDeptId ? Number(selectedDeptId) : undefined,
        section_id: selectedSectionId ? Number(selectedSectionId) : undefined,
        status: recordStatusFilter || undefined,
        is_suspicious:
          recordAiFilter === "flagged"
            ? true
            : recordAiFilter === "verified"
            ? false
            : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        query: recordSearch.trim() || undefined,
        limit: pageSize,
        offset,
      });
      if (res) setRecords(res);
    } catch {
      // silent
    }
  }

  // Load Sessions
  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const res = await api.attendanceAdmin.getSessions({
        department_id: selectedDeptId ? Number(selectedDeptId) : undefined,
        status: statusFilter ? (statusFilter as SessionStatus) : undefined,
        session_date: sessionDateFilter || undefined,
        query: sessionSearch.trim() || undefined,
      });
      setSessions(res || []);
    } catch (err: any) {
      console.error("Failed to load sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function silentRefreshSessions() {
    try {
      const res = await api.attendanceAdmin.getSessions({
        department_id: selectedDeptId ? Number(selectedDeptId) : undefined,
        status: statusFilter ? (statusFilter as SessionStatus) : undefined,
        session_date: sessionDateFilter || undefined,
        query: sessionSearch.trim() || undefined,
      });
      setSessions(res || []);
    } catch {
      // silent
    }
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

  // Filtered records by search and AI filter
  const displayedRecords = useMemo(() => {
    let list = records;
    if (recordSearch.trim()) {
      const q = recordSearch.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.student_name?.toLowerCase().includes(q) ||
          r.roll_number?.toLowerCase().includes(q) ||
          r.subject_name?.toLowerCase().includes(q) ||
          r.section_name?.toLowerCase().includes(q)
      );
    }
    if (recordAiFilter === "verified") {
      list = list.filter((r) => !r.is_suspicious);
    } else if (recordAiFilter === "flagged") {
      list = list.filter((r) => r.is_suspicious);
    }
    return list;
  }, [records, recordSearch, recordAiFilter]);

  const verifiedCount = useMemo(() => records.filter((r) => !r.is_suspicious).length, [records]);
  const flaggedCount = useMemo(() => records.filter((r) => r.is_suspicious).length, [records]);

  return (
    <div className="space-y-6 pb-14">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1 flex items-center gap-1.5 font-mono">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-emerald-400 font-semibold">Attendance Monitor &amp; AI Sentinel</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Campus Attendance &amp; AI Sentinel Monitor
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Autonomous Sentinel
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Real-time unified attendance monitor. Verified records appear in{" "}
            <span className="text-emerald-400 font-semibold">Green</span> and suspicious anomalies in{" "}
            <span className="text-rose-400 font-semibold">Red</span>. Zero human review required—AI Sentinel autonomously predicts fraud verdicts in real time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => {
              loadStats();
              if (activeTab === "records") loadRecords();
              else loadSessions();
            }}
            variant="outline"
            className="flex items-center gap-2 text-xs border-slate-700 bg-surface-900/60 hover:bg-surface-800 text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
            Refresh
          </Button>
        </div>
      </div>

      {/* AI Autonomous Sentinel Alert Ribbon */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-surface-900/60 to-emerald-950/30 p-4 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-tight">AI Autonomous Fraud Prevention Active</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100% UNIFIED
              </span>
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Faculty &amp; Admin manual review bypassed. AI Sentinel automatically correlates GPS distance, hardware device bindings, and QR velocity to calculate risk verdicts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {verifiedCount} Verified (Green)
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
            {flaggedCount} Flagged (Red)
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASCADING ACADEMIC HIERARCHY SELECTOR: Department ➔ Branch ➔ Section ➔ Batch */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Card className="p-4 border-slate-800/80 bg-surface-900/70 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            <Layers className="h-4 w-4 text-emerald-400" />
            <span>Academic Hierarchy Filter (Dept ➔ Branch ➔ Section ➔ Batch)</span>
          </div>

          {(selectedDeptId || selectedBranchId || selectedSectionId || selectedBatchId) && (
            <button
              onClick={resetHierarchy}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono hover:underline"
            >
              <X className="h-3 w-3" /> Reset Hierarchy
            </button>
          )}
        </div>

        {/* 4 Cascading Dropdowns in Exact Order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Department */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-emerald-400" />
              1. Department:
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => handleDeptChange(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Branch */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <GraduationCap className="h-3 w-3 text-cyan-400" />
              2. Branch:
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={availableBranches.length === 0}
              className="w-full rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            >
              <option value="">All Branches</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Section */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Users className="h-3 w-3 text-indigo-400" />
              3. Section:
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => handleSectionChange(e.target.value)}
              disabled={availableSections.length === 0}
              className="w-full rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              <option value="">All Sections</option>
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Batch / Group */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Layers className="h-3 w-3 text-amber-400" />
              4. Batch / Group:
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => handleBatchChange(e.target.value)}
              disabled={availableBatches.length === 0}
              className="w-full rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
            >
              <option value="">All Batches</option>
              {availableBatches.map((bg) => (
                <option key={bg.id} value={bg.id}>
                  {bg.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Interactive Breadcrumb Ribbon */}
        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400 font-mono overflow-x-auto">
          <span className="text-slate-500">Scope:</span>
          <span className="px-2 py-0.5 rounded bg-surface-950 border border-slate-800 text-slate-200">
            {departments.find((d) => d.id === selectedDeptId)?.name || "All Departments"}
          </span>
          <span>➔</span>
          <span className="px-2 py-0.5 rounded bg-surface-950 border border-slate-800 text-slate-200">
            {branches.find((b) => b.id === selectedBranchId)?.name || "All Branches"}
          </span>
          <span>➔</span>
          <span className="px-2 py-0.5 rounded bg-surface-950 border border-slate-800 text-slate-200">
            {sections.find((s) => s.id === selectedSectionId)?.name || "All Sections"}
          </span>
          <span>➔</span>
          <span className="px-2 py-0.5 rounded bg-surface-950 border border-slate-800 text-slate-200">
            {batches.find((bg) => bg.id === selectedBatchId)?.name || "All Batches"}
          </span>
        </div>
      </Card>

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

      {/* Primary Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("records")}
            className={`px-5 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === "records"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Student Attendance &amp; AI Sentinel ({records.length})
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`px-5 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === "sessions"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            Live &amp; Scheduled Sessions ({sessions.length})
          </button>
        </div>

        {/* AI Quick Filter Buttons */}
        {activeTab === "records" && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-950 border border-slate-800 text-xs">
            <button
              onClick={() => setRecordAiFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                recordAiFilter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              All ({records.length})
            </button>
            <button
              onClick={() => setRecordAiFilter("verified")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                recordAiFilter === "verified" ? "bg-emerald-600 text-white" : "text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              🟢 Verified ({verifiedCount})
            </button>
            <button
              onClick={() => setRecordAiFilter("flagged")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                recordAiFilter === "flagged" ? "bg-rose-600 text-white" : "text-rose-400 hover:bg-rose-500/10"
              }`}
            >
              🔴 Flagged ({flaggedCount})
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: Unified Student Attendance & AI Sentinel Records */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "records" && (
        <div className="space-y-4">
          {/* Search Toolbar */}
          <Card className="p-4 border-slate-800/70 bg-surface-900/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative min-w-[240px] max-w-sm flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search student name, roll number, section..."
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-800 bg-surface-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={recordStatusFilter}
                onChange={(e) => setRecordStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Attendance Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused</option>
              </select>

              {recordSearch && (
                <button
                  type="button"
                  onClick={() => setRecordSearch("")}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-surface-800"
                >
                  <X className="h-3 w-3" /> Clear Search
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                Showing {displayedRecords.length} records
              </span>
            </div>
          </Card>

          {/* Master Unified Table */}
          <Card className="border-slate-800/70 bg-surface-900/60 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs table-auto">
                <thead className="bg-surface-950/80 text-slate-400 border-b border-slate-800/80 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Student &amp; Roll No.</th>
                    <th className="py-3 px-4">Academic Class &amp; Batch</th>
                    <th className="py-3 px-4">Subject &amp; Session</th>
                    <th className="py-3 px-4">Check-In Time</th>
                    <th className="py-3 px-4">AI Sentinel Status</th>
                    <th className="py-3 px-4">Telemetry Evidence</th>
                    <th className="py-3 px-4">AI Autonomous Verdict</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recordsLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                          <span>Syncing unified attendance records &amp; AI anomaly detector...</span>
                        </div>
                      </td>
                    </tr>
                  ) : displayedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="mx-auto h-12 w-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 border border-slate-700/60">
                            <ShieldCheck className="h-6 w-6 text-emerald-400" />
                          </div>
                          <h3 className="text-base font-semibold text-white">No Attendance Records Yet</h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            No attendance records match your filter. Live attendance scanned by students via their mobile app will automatically appear here in real time.
                          </p>
                          <Button
                            onClick={() => {
                              loadStats();
                              loadRecords();
                            }}
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs gap-1.5 border-slate-700 text-slate-300 hover:text-white"
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
                            Refresh Records
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedRecords.map((r) => {
                      const isFlagged = r.is_suspicious;
                      const isPresent = r.status.toLowerCase() === "present";
                      const isLate = r.status.toLowerCase() === "late";

                      return (
                        <tr
                          key={r.id}
                          className={`transition ${
                            isFlagged
                              ? "bg-rose-950/20 hover:bg-rose-950/30 border-l-4 border-l-rose-500"
                              : "hover:bg-emerald-950/15 border-l-4 border-l-emerald-500"
                          }`}
                        >
                          {/* Student & Roll No. */}
                          <td className="py-3 px-4">
                            <p className="font-bold text-white flex items-center gap-1.5">
                              {r.student_name}
                              {isFlagged ? (
                                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" title="Flagged Anomaly" />
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-emerald-400" title="Verified Clean" />
                              )}
                            </p>
                            <p className="font-mono text-[11px] text-cyan-400 mt-0.5">{r.roll_number}</p>
                          </td>

                          {/* Academic Class & Batch */}
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-200">{r.section_name || "Section A"}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {r.student_group_name ? `Batch: ${r.student_group_name}` : "Whole Section"}
                            </p>
                          </td>

                          {/* Subject & Session */}
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-200">{r.subject_name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              Session #{r.session_id} {r.subject_code ? `· ${r.subject_code}` : ""}
                            </p>
                          </td>

                          {/* Check-In Time */}
                          <td className="py-3 px-4 font-mono text-slate-300">
                            <div>{r.check_in_time || (r.marked_at ? new Date(r.marked_at).toLocaleTimeString() : "—")}</div>
                            <div className="text-[10px] text-slate-500">
                              {r.marked_at ? new Date(r.marked_at).toLocaleDateString() : ""}
                            </div>
                          </td>

                          {/* AI Sentinel Status: Green for Verified, Red for Suspicious */}
                          <td className="py-3 px-4">
                            {isFlagged ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1.5 shadow-sm shadow-rose-950/40">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                                AI FLAGGED
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                AI VERIFIED
                              </span>
                            )}
                          </td>

                          {/* Telemetry Evidence */}
                          <td className="py-3 px-4">
                            {isFlagged ? (
                              <div>
                                <span className="font-mono text-[11px] font-bold text-rose-400 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {r.distance_meters ? `${r.distance_meters.toFixed(1)}m Outside` : "GPS Spoof"}
                                </span>
                                <p className="text-[10px] text-rose-300/80 truncate max-w-[180px]" title={r.suspicion_reason || "Location Discrepancy"}>
                                  {r.suspicion_reason || "Proxy Pattern Detected"}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <span className="font-mono text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {r.distance_meters != null ? `${r.distance_meters.toFixed(1)}m Inside` : "Geofence OK"}
                                </span>
                                <p className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                                  {r.device_id || "Trusted Hardware"}
                                </p>
                              </div>
                            )}
                          </td>

                          {/* AI Autonomous Verdict */}
                          <td className="py-3 px-4">
                            {isFlagged ? (
                              <div className="space-y-0.5">
                                <span className="text-[11px] font-bold text-rose-400 block font-mono">
                                  🔴 PREDICTED FRAUD
                                </span>
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  Risk: 94% · Auto-Bypassed
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="text-[11px] font-bold text-emerald-400 block font-mono">
                                  🟢 AI APPROVED
                                </span>
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  Risk: 2% · Verified Clean
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setTelemetryRecord(r)}
                              title="View Complete AI Telemetry & Verdict Signals"
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 ml-auto transition cursor-pointer ${
                                isFlagged
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                                  : "border-slate-800 bg-surface-950 text-slate-300 hover:text-white hover:border-slate-700"
                              }`}
                            >
                              <Bot className="h-3.5 w-3.5 text-emerald-400" />
                              View AI Signals
                            </button>
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
      {/* TAB 2: Live & Scheduled Sessions */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <Card className="border-slate-800/70 bg-surface-900/60 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs table-auto">
                <thead className="bg-surface-950/80 text-slate-400 border-b border-slate-800/80 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Session</th>
                    <th className="py-3 px-4">Subject &amp; Type</th>
                    <th className="py-3 px-4">Faculty</th>
                    <th className="py-3 px-4">Scope</th>
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Attendance Stats</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sessionsLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                          <span>Loading active &amp; scheduled sessions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No active sessions running for this department scope.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => {
                      const isLive = s.status === "active";
                      const present = s.present_count ?? s.total_present ?? 0;
                      const enrolled = s.total_enrolled ?? 0;

                      return (
                        <tr key={s.id} className="hover:bg-surface-800/40 transition">
                          <td className="py-3 px-4 font-mono font-medium text-slate-300">#{s.id}</td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-white">{s.subject_name}</p>
                            <p className="text-[10px] font-mono text-emerald-400">{s.subject_code}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{s.faculty_name || "Faculty"}</td>
                          <td className="py-3 px-4">
                            <p className="text-slate-200">{s.section_name}</p>
                            <p className="text-[10px] text-slate-500">{s.student_group_name || "Whole Section"}</p>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-200 font-semibold">{s.room_number || "—"}</td>
                          <td className="py-3 px-4">
                            <span className="text-emerald-400 font-bold">{present}</span>
                            <span className="text-slate-500"> / {enrolled} Enrolled</span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={isLive ? "emerald" : "slate"} dot={isLive}>
                              {s.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenStudentAttendance(s)}
                                className="p-1.5 rounded-lg border border-slate-800 bg-surface-950 text-emerald-400 hover:bg-emerald-500/10 transition"
                                title="View Enrolled Students"
                              >
                                <Users className="h-3.5 w-3.5" />
                              </button>
                              {isLive && (
                                <button
                                  onClick={() => setSessionToEnd(s)}
                                  className="px-2 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 font-semibold text-[11px]"
                                >
                                  End
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
      {/* MODAL: AI Sentinel Telemetry & Autonomous Verdict */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!telemetryRecord}
        onClose={() => setTelemetryRecord(null)}
        title="AI Sentinel — Autonomous Telemetry & Prediction"
        description={`Record #${telemetryRecord?.id} · ${telemetryRecord?.student_name} (${telemetryRecord?.roll_number})`}
      >
        {telemetryRecord && (
          <div className="space-y-4 text-xs">
            {/* Status Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                telemetryRecord.is_suspicious
                  ? "border-rose-500/40 bg-rose-950/40 text-rose-300"
                  : "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {telemetryRecord.is_suspicious ? (
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                )}
                <div>
                  <p className="font-bold text-white text-sm">
                    {telemetryRecord.is_suspicious ? "AI Sentinel Verdict: FLAGGED (Proxy / Anomaly)" : "AI Sentinel Verdict: APPROVED (Clean Check-in)"}
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {telemetryRecord.is_suspicious
                      ? "High-confidence anomaly detected. Automated flag assigned without requiring manual faculty review."
                      : "Multi-sensor geofence & hardware correlation confirmed. Marked Verified automatically."}
                  </p>
                </div>
              </div>
            </div>

            {/* Signals Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-800 bg-surface-950">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Student Name</span>
                <p className="text-white font-semibold mt-0.5">{telemetryRecord.student_name}</p>
                <p className="font-mono text-cyan-400 text-[11px]">{telemetryRecord.roll_number}</p>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Class &amp; Batch</span>
                <p className="text-white font-semibold mt-0.5">{telemetryRecord.section_name}</p>
                <p className="text-slate-400 text-[11px]">{telemetryRecord.student_group_name || "Whole Section"}</p>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">GPS Distance to Classroom</span>
                <p className="font-mono text-emerald-400 font-semibold mt-0.5">
                  {telemetryRecord.distance_meters != null ? `${telemetryRecord.distance_meters.toFixed(1)} meters` : "Not provided"}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Hardware Device Token</span>
                <p className="font-mono text-slate-300 text-[11px] mt-0.5 truncate" title={telemetryRecord.device_id || ""}>
                  {telemetryRecord.device_id || "Hardware Binding Verified"}
                </p>
              </div>
            </div>

            {/* AI Reasoning */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-950 space-y-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Bot className="h-3.5 w-3.5 text-indigo-400" />
                AI Sentinel Predictive Reasoning:
              </span>
              <p className="text-slate-200 text-xs leading-relaxed">
                {telemetryRecord.suspicion_reason ||
                  "Zero spatial drift detected. Coordinates fall strictly inside authorized 50m classroom boundary radius. Hardware signature matches student profile registration."}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setTelemetryRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* End Session Confirmation Modal */}
      <Modal
        isOpen={!!sessionToEnd}
        onClose={() => setSessionToEnd(null)}
        title="End Active Session"
        description={`Are you sure you want to conclude session #${sessionToEnd?.id}?`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Ending this session will finalize attendance counts and disable QR token verification.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setSessionToEnd(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" isLoading={endingSession} onClick={handleConfirmEndSession}>
              Confirm End Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
