"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  api,
  SuspiciousActivity,
  SuspiciousActivityStats,
  SuspiciousActivityHistoryItem,
  ReviewStatus,
  DetectionMethod,
} from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  RefreshCw,
  Clock,
  ShieldCheck,
  Search,
  Calendar,
  AlertOctagon,
  History,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Database,
  Info,
  Layers,
  Cpu,
} from "lucide-react";

export default function SuspiciousActivityPage() {
  const { user } = useDashboard();

  // Data states
  const [anomalies, setAnomalies] = useState<SuspiciousActivity[]>([]);
  const [stats, setStats] = useState<SuspiciousActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "">("");
  const [filterMethod, setFilterMethod] = useState<DetectionMethod | "">("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<"created_at" | "risk_score" | "id">("created_at");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [selectedEvidence, setSelectedEvidence] = useState<SuspiciousActivity | null>(null);
  const [selectedReview, setSelectedReview] = useState<SuspiciousActivity | null>(null);
  const [selectedHistoryActivity, setSelectedHistoryActivity] = useState<SuspiciousActivity | null>(null);
  const [historyItems, setHistoryItems] = useState<SuspiciousActivityHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Review Form state
  const [targetStatus, setTargetStatus] = useState<ReviewStatus>("confirmed");
  const [decisionReason, setDecisionReason] = useState("");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Technical JSON collapse state in Evidence Modal
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    loadData();
  }, [user, filterStatus, filterMethod, filterSeverity, startDate, endDate, sortBy, sortOrder]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Stats
      try {
        const statsData = await api.anomaly.getStats();
        setStats(statsData);
      } catch (err) {
        console.warn("Could not load anomaly stats:", err);
      }

      // 2. Fetch Flagged Activities
      if (user?.role === "faculty") {
        const data = await api.anomaly.getFacultyAnomalies({
          review_status: filterStatus || undefined,
          detection_method: filterMethod || undefined,
          query: searchQuery || undefined,
          severity: filterSeverity || undefined,
        });
        setAnomalies(data);
      } else {
        const data = await api.anomaly.getAdminAnomalies({
          review_status: filterStatus || undefined,
          detection_method: filterMethod || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          query: searchQuery || undefined,
          severity: filterSeverity || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        });
        setAnomalies(data);
      }
    } catch (err: any) {
      console.error("Error loading anomalies:", err);
      setError(err?.message || "Failed to load flagged activities from the backend.");
    } finally {
      setLoading(false);
    }
  }

  // Client-side search filtering if search query changes between backend loads
  const filteredAnomalies = useMemo(() => {
    if (!searchQuery.trim()) return anomalies;
    const q = searchQuery.toLowerCase().trim();
    return anomalies.filter((a) => {
      const matchName = (a.student_name || "").toLowerCase().includes(q);
      const matchRoll = (a.student_roll_number || "").toLowerCase().includes(q);
      const matchSession = String(a.session_id).includes(q);
      const matchFlag = String(a.id).includes(q.replace("#", ""));
      const matchReason = (a.reason || "").toLowerCase().includes(q);
      const matchSubject = (a.subject_name || "").toLowerCase().includes(q);
      return matchName || matchRoll || matchSession || matchFlag || matchReason || matchSubject;
    });
  }, [anomalies, searchQuery]);

  // Paginated records
  const paginatedAnomalies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAnomalies.slice(start, start + pageSize);
  }, [filteredAnomalies, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAnomalies.length / pageSize));

  function handleResetFilters() {
    setSearchQuery("");
    setFilterStatus("");
    setFilterMethod("");
    setFilterSeverity("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  }

  async function openReviewModal(act: SuspiciousActivity) {
    setSelectedReview(act);
    setTargetStatus(act.review_status === "pending" ? "confirmed" : act.review_status);
    setDecisionReason("");
    setReviewerNotes(act.reviewer_notes || "");
    setReviewError("");
  }

  async function openHistoryModal(act: SuspiciousActivity) {
    setSelectedHistoryActivity(act);
    setHistoryLoading(true);
    try {
      const history = await api.anomaly.getAnomalyHistory(act.id);
      setHistoryItems(history);
    } catch (err) {
      console.error("Failed to load audit history:", err);
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReview) return;

    if (!decisionReason.trim()) {
      setReviewError("Institutional policy requires a decision reason for reviewing flagged check-ins.");
      return;
    }

    setReviewLoading(true);
    setReviewError("");

    try {
      await api.anomaly.reviewAnomaly(selectedReview.id, {
        review_status: targetStatus,
        decision_reason: decisionReason.trim(),
        reviewer_notes: reviewerNotes.trim() || undefined,
      });

      setSelectedReview(null);
      setDecisionReason("");
      setReviewerNotes("");
      await loadData();
    } catch (err: any) {
      setReviewError(err.message || "Failed to update review status. Please try again.");
    } finally {
      setReviewLoading(false);
    }
  }

  function getSeverityBadge(severity: string, score: number) {
    switch (severity?.toLowerCase()) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-950/90 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-950/50">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            {score.toFixed(0)} — CRITICAL
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-950/70 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            {score.toFixed(0)} — HIGH
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-950/70 text-amber-400 border border-amber-500/30">
            {score.toFixed(0)} — MED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-950/70 text-blue-400 border border-blue-500/30">
            {score.toFixed(0)} — LOW
          </span>
        );
    }
  }

  function getMethodBadge(method: DetectionMethod) {
    switch (method) {
      case "timing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-amber-950/40 text-amber-300 border border-amber-500/20">
            <Clock className="w-3 h-3" /> TIMING
          </span>
        );
      case "gps":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-sky-950/40 text-sky-300 border border-sky-500/20">
            <ShieldAlert className="w-3 h-3" /> GPS
          </span>
        );
      case "device":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-purple-950/40 text-purple-300 border border-purple-500/20">
            <Cpu className="w-3 h-3" /> DEVICE
          </span>
        );
      case "multi_signal":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-rose-950/50 text-rose-300 border border-rose-500/30">
            <Layers className="w-3 h-3" /> MULTI-SIGNAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono uppercase bg-slate-800 text-slate-300">
            {method}
          </span>
        );
    }
  }

  function getReviewStatusBadge(status: ReviewStatus) {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Pending Review
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/70 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3 h-3 text-rose-400" /> Confirmed Violation
          </span>
        );
      case "dismissed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> False Positive
          </span>
        );
      case "reviewed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-500/30">
            <ShieldCheck className="w-3 h-3" /> Under Review
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  }

  function formatDateTime(isoString?: string | null) {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1">Dashboard / Suspicious Activity & Anomaly Detection</nav>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-emerald-400" />
            Suspicious Activity & Anomaly Detection
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Institutional attendance security, heuristic rule signals, chronological verification, and explainable AI/ML risk scoring.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            onClick={loadData}
            variant="outline"
            className="flex items-center gap-2 text-xs border-slate-700 bg-surface-900 hover:bg-surface-800 text-slate-200"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={handleResetFilters}
            variant="outline"
            className="flex items-center gap-2 text-xs border-slate-700 bg-surface-900 hover:bg-surface-800 text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filters
          </Button>
        </div>
      </div>

      {/* ── Section 2: Dynamic Summary KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <Card className="p-4 border-slate-800/80 bg-surface-900/80 hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Flagged</span>
            <ShieldAlert className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">
              {stats ? stats.total_flagged : "—"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">All recorded alerts</p>
        </Card>

        <Card className="p-4 border-amber-900/40 bg-surface-900/80 hover:border-amber-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-300 font-mono">
              {stats ? stats.pending_reviews : "—"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting investigation</p>
        </Card>

        <Card className="p-4 border-rose-950 bg-surface-900/80 hover:border-rose-800/60 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400">High-Risk Flags</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-300 font-mono">
              {stats ? stats.high_risk : "—"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Risk score &ge; 70%</p>
        </Card>

        <Card className="p-4 border-rose-900/50 bg-surface-900/80 hover:border-rose-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400">Confirmed Violations</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400 font-mono">
              {stats ? stats.confirmed_violations : "—"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Institutional proxies</p>
        </Card>

        <Card className="p-4 border-emerald-950 bg-surface-900/80 hover:border-emerald-800/60 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">False Positives</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-300 font-mono">
              {stats ? stats.false_positives : "—"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Dismissed after audit</p>
        </Card>

        <Card className="p-4 border-purple-900/40 bg-surface-900/80 hover:border-purple-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-400">Data-Quality Issues</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-300 font-mono">
              {stats ? stats.data_quality_issues : "—"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Timestamp/skew anomalies</p>
        </Card>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to connect to backend anomaly service</p>
              <p className="text-xs text-rose-300/80">{error}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={loadData}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs flex-shrink-0"
          >
            Retry Connection
          </Button>
        </div>
      )}

      {/* ── Section 2: Search & Filter Toolbar ── */}
      <Card className="p-4 border-slate-800/80 bg-surface-900/70 space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, roll number, session ID, or flag ID..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-700/80 bg-surface-950 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          {/* Review Status Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full sm:w-44 px-3 py-2 rounded-xl border border-slate-700/80 bg-surface-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Review Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="reviewed">Under Review</option>
              <option value="confirmed">Confirmed Violation</option>
              <option value="dismissed">False Positive (Valid)</option>
            </select>
          </div>

          {/* Detection Method Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value as any)}
              className="w-full sm:w-40 px-3 py-2 rounded-xl border border-slate-700/80 bg-surface-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Detection Methods</option>
              <option value="timing">Timing Anomaly</option>
              <option value="gps">GPS Boundary</option>
              <option value="device">Device Cloning</option>
              <option value="multi_signal">Multi-Signal Aggregated</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="w-full sm:w-36 px-3 py-2 rounded-xl border border-slate-700/80 bg-surface-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical (&ge; 90)</option>
              <option value="high">High (&ge; 70)</option>
              <option value="medium">Medium (40-69)</option>
              <option value="low">Low (&lt; 40)</option>
            </select>
          </div>
        </div>

        {/* Second Row: Date Range & Stats Count */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/50">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Date Range:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-700/80 bg-surface-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-700/80 bg-surface-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            {(filterStatus || filterMethod || filterSeverity || startDate || endDate || searchQuery) && (
              <button
                onClick={handleResetFilters}
                className="text-emerald-400 hover:text-emerald-300 underline font-medium ml-2"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Showing <span className="text-white font-semibold">{filteredAnomalies.length}</span> recorded flags
          </div>
        </div>
      </Card>

      {/* ── Section 3: Flagged Activity Table ── */}
      <Card className="p-0 border-slate-800/80 bg-surface-900/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="text-left text-xs text-slate-400 bg-surface-950/60 border-b border-slate-800/80 font-medium">
                <th className="py-3.5 px-4 font-mono">Flag ID</th>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Subject & Session</th>
                <th className="py-3.5 px-4">Method</th>
                <th className="py-3.5 px-4">Risk Severity</th>
                <th className="py-3.5 px-4 max-w-sm">Findings / Reason</th>
                <th className="py-3.5 px-4">Event Timestamp</th>
                <th className="py-3.5 px-4">Review Status</th>
                <th className="py-3.5 px-4">Reviewer</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && anomalies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                      <p className="text-sm">Connecting to backend anomaly detection engine...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAnomalies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck className="w-8 h-8 text-slate-500" />
                      <p className="text-sm text-slate-300 font-medium">No flagged activities found.</p>
                      <p className="text-xs text-slate-500">
                        Attendance events are operating within verified geographical and timing parameters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAnomalies.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-800/40 transition">
                    {/* Flag ID */}
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400 font-semibold">
                      #{a.id}
                    </td>

                    {/* Student */}
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-white">{a.student_name || `Student #${a.student_id}`}</p>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {a.student_roll_number || "N/A"}
                      </span>
                    </td>

                    {/* Subject & Session */}
                    <td className="py-3.5 px-4">
                      <p className="text-xs font-medium text-slate-200">{a.subject_name || "General Session"}</p>
                      <p className="text-[11px] text-slate-400">
                        Session #{a.session_id} {a.section_name ? `• ${a.section_name}` : ""}
                      </p>
                    </td>

                    {/* Method */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getMethodBadge(a.detection_method)}
                    </td>

                    {/* Risk Severity */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getSeverityBadge(a.severity, a.risk_score)}
                    </td>

                    {/* Findings & Data Quality Indicator */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {a.is_data_quality_issue && (
                        <div className="mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                          DATA-QUALITY ANOMALY
                        </div>
                      )}
                      <p className="text-xs text-slate-200 line-clamp-2" title={a.reason}>
                        {a.reason}
                      </p>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap font-mono">
                      {formatDateTime(a.marked_at || a.created_at)}
                    </td>

                    {/* Review Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getReviewStatusBadge(a.review_status)}
                    </td>

                    {/* Reviewer / Notes */}
                    <td className="py-3.5 px-4 text-xs text-slate-400 max-w-xs truncate">
                      {a.reviewer_name ? (
                        <div>
                          <p className="text-slate-300 font-medium">{a.reviewer_name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{a.reviewer_notes || "—"}</p>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => openReviewModal(a)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1 h-7"
                          title="Review this flagged check-in"
                        >
                          Review Flag
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEvidence(a);
                            setShowRawJson(false);
                          }}
                          className="border-slate-700 bg-surface-900 hover:bg-surface-800 text-slate-300 px-2 h-7"
                          title="Inspect structured evidence"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openHistoryModal(a)}
                          className="border-slate-700 bg-surface-900 hover:bg-surface-800 text-slate-300 px-2 h-7"
                          title="View review audit history"
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-surface-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-0.5 rounded border border-slate-700 bg-surface-900 text-slate-200"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              Page <span className="text-white font-medium">{currentPage}</span> of{" "}
              <span className="text-white font-medium">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 h-7 border-slate-700 bg-surface-900 text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 h-7 border-slate-700 bg-surface-900 text-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Section 3 & 7: Structured Evidence & Details Modal ── */}
      <Modal
        isOpen={!!selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
        title={`Structured Evidence & Signals — Flag #${selectedEvidence?.id}`}
        description={`Student: ${selectedEvidence?.student_name} (${selectedEvidence?.student_roll_number}) • Session #${selectedEvidence?.session_id}`}
        maxWidth="lg"
      >
        {selectedEvidence && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Prominent Data Quality Warning if chronological inconsistency */}
            {selectedEvidence.is_data_quality_issue && (
              <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-950/40 text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-xs text-amber-300">
                  <AlertOctagon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  Chronological Inconsistency / Data-Quality Issue Detected
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  {selectedEvidence.data_quality_reason ||
                    "Check-in timestamp occurred before session start time. This indicates clock skew, asynchronous server default evaluation, or UTC/IST timezone translation discrepancy rather than student attendance fraud."}
                </p>
                <p className="text-[11px] text-amber-300/70 pt-0.5">
                  Institutional Rule: Timing evidence is classified as unreliable. Does NOT prove proxy check-in.
                </p>
              </div>
            )}

            {/* Overview Key-Value Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-slate-800 bg-surface-950/60 text-xs">
              <div>
                <span className="text-slate-400">Risk Score & Severity</span>
                <div className="mt-1">{getSeverityBadge(selectedEvidence.severity, selectedEvidence.risk_score)}</div>
              </div>
              <div>
                <span className="text-slate-400">Detection Method</span>
                <div className="mt-1">{getMethodBadge(selectedEvidence.detection_method)}</div>
              </div>
              <div>
                <span className="text-slate-400">Current Review Status</span>
                <div className="mt-1">{getReviewStatusBadge(selectedEvidence.review_status)}</div>
              </div>

              <div>
                <span className="text-slate-400">Subject</span>
                <p className="font-semibold text-white mt-0.5">{selectedEvidence.subject_name || "—"}</p>
                <p className="text-[11px] text-slate-500 font-mono">{selectedEvidence.subject_code || ""}</p>
              </div>
              <div>
                <span className="text-slate-400">Faculty</span>
                <p className="font-semibold text-white mt-0.5">{selectedEvidence.faculty_name || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Section / Room</span>
                <p className="font-semibold text-white mt-0.5">
                  {selectedEvidence.section_name || "—"} {selectedEvidence.room_number ? `(${selectedEvidence.room_number})` : ""}
                </p>
              </div>
            </div>

            {/* Chronological & Spatial Evidence Comparison */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-950/60 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Chronological & Location Verification
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-surface-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Session Started At</span>
                  <span className="font-mono text-slate-200 font-medium">
                    {formatDateTime(selectedEvidence.session_started_at)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Student Check-In Marked At</span>
                  <span className="font-mono text-slate-200 font-medium">
                    {formatDateTime(selectedEvidence.marked_at)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-1">GPS Distance to Session Geofence</span>
                  <span className="font-mono text-slate-200 font-medium">
                    {selectedEvidence.distance_meters !== null && selectedEvidence.distance_meters !== undefined
                      ? `${selectedEvidence.distance_meters.toFixed(1)} meters`
                      : "GPS signal omitted or not recorded"}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Device Identifier</span>
                  <span className="font-mono text-slate-200 font-medium truncate block">
                    {selectedEvidence.device_id || "No device binding captured"}
                  </span>
                </div>
              </div>
            </div>

            {/* Rule Explanations & Findings */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-950/60 space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-400" /> Heuristic Findings Breakdown
              </h3>
              <div className="p-3 rounded-lg bg-surface-900/70 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                {selectedEvidence.reason}
              </div>
            </div>

            {/* Collapsible Technical Details (Raw Signals) */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-surface-950/40">
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 bg-surface-900/40"
              >
                <span className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  Technical Payload & AI/ML Snapshot (Authorized Inspection)
                </span>
                {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showRawJson && (
                <div className="p-3 bg-surface-950 border-t border-slate-800">
                  <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto p-2 rounded bg-black/60 max-h-48">
                    {typeof selectedEvidence.raw_signals === "string"
                      ? JSON.stringify(JSON.parse(selectedEvidence.raw_signals || "{}"), null, 2)
                      : JSON.stringify(selectedEvidence.raw_signals || {}, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedEvidence(null)}
                className="text-xs border-slate-700 bg-surface-900"
              >
                Close Evidence
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Section 4: Complete Review Flag Workflow Modal ── */}
      <Modal
        isOpen={!!selectedReview}
        onClose={() => setSelectedReview(null)}
        title={`Review Flagged Check-In #${selectedReview?.id}`}
        description={`Student: ${selectedReview?.student_name} (${selectedReview?.student_roll_number}) • Subject: ${selectedReview?.subject_name}`}
        maxWidth="md"
      >
        {selectedReview && (
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            {/* Context Summary */}
            <div className="p-3 rounded-xl border border-slate-800 bg-surface-950/60 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Current Status:</span>
                <span>{getReviewStatusBadge(selectedReview.review_status)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Detection Method:</span>
                <span>{getMethodBadge(selectedReview.detection_method)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Risk Severity:</span>
                <span>{getSeverityBadge(selectedReview.severity, selectedReview.risk_score)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Detection Reason:</span>
                <span className="text-right text-slate-200 max-w-[65%] truncate" title={selectedReview.reason}>
                  {selectedReview.reason}
                </span>
              </div>
            </div>

            {/* Target Status Choice */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Review Outcome *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetStatus("confirmed")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center gap-2 ${
                    targetStatus === "confirmed"
                      ? "border-rose-500 bg-rose-950/60 text-rose-300"
                      : "border-slate-800 bg-surface-950 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <div>
                    <div>Confirmed Violation</div>
                    <div className="text-[10px] text-slate-500 font-normal">Proxy check-in confirmed</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetStatus("dismissed")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center gap-2 ${
                    targetStatus === "dismissed"
                      ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
                      : "border-slate-800 bg-surface-950 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div>False Positive</div>
                    <div className="text-[10px] text-slate-500 font-normal">Attendance is legitimate</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetStatus("reviewed")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center gap-2 ${
                    targetStatus === "reviewed"
                      ? "border-blue-500 bg-blue-950/60 text-blue-300"
                      : "border-slate-800 bg-surface-950 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <div>Under Review</div>
                    <div className="text-[10px] text-slate-500 font-normal">Investigation in progress</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetStatus("pending")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center gap-2 ${
                    targetStatus === "pending"
                      ? "border-amber-500 bg-amber-950/60 text-amber-300"
                      : "border-slate-800 bg-surface-950 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div>
                    <div>Reopen Flag</div>
                    <div className="text-[10px] text-slate-500 font-normal">Reset to pending review</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Mandatory Decision Reason */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Institutional Decision Reason * <span className="text-[11px] text-slate-500 font-normal">(Required for audit trail)</span>
              </label>
              <input
                type="text"
                required
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="e.g. Student absent during physical roll call; confirmed device proxy."
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-surface-950 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Reviewer Notes */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Reviewer Notes <span className="text-[11px] text-slate-500 font-normal">(Optional internal comments)</span>
              </label>
              <textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                rows={3}
                placeholder="Add corroborating evidence, physical roll call cross-checks, or student explanations..."
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-surface-950 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Institutional Policy Notice */}
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Institutional Security Notice:</strong> Review decisions are recorded permanently in the institutional audit log.
                Marking a violation does not automatically alter attendance; official overrides require authorized workflow in Campus Attendance Control.
              </span>
            </div>

            {reviewError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/30">
                {reviewError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedReview(null)}
                disabled={reviewLoading}
                className="text-xs border-slate-700 bg-surface-900"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={reviewLoading}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                {reviewLoading ? "Saving Audit Entry..." : "Submit Review Decision"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Section 4 & 10: Audit Trail History Modal ── */}
      <Modal
        isOpen={!!selectedHistoryActivity}
        onClose={() => setSelectedHistoryActivity(null)}
        title={`Audit Trail History — Flag #${selectedHistoryActivity?.id}`}
        description={`Student: ${selectedHistoryActivity?.student_name} • Chronological log of administrative actions`}
        maxWidth="md"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {historyLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              Retrieving institutional audit logs...
            </div>
          ) : historyItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No previous review modifications recorded for this flag.
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 border-l border-slate-800 ml-2 mt-2">
              {historyItems.map((item, idx) => (
                <div key={item.id} className="relative">
                  <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-surface-950" />
                  <div className="p-3 rounded-xl border border-slate-800/80 bg-surface-950/60 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-semibold text-white">{item.user_name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Status transition:{" "}
                      <span className="text-amber-300 font-mono font-medium">{item.old_status || "initial"}</span> &rarr;{" "}
                      <span className="text-emerald-300 font-mono font-medium">{item.new_status || "updated"}</span>
                    </div>
                    {item.reason && (
                      <p className="text-slate-200 italic text-[11px] pt-1">
                        &ldquo;{item.reason}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setSelectedHistoryActivity(null)}
              className="text-xs border-slate-700 bg-surface-900"
            >
              Close History
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
