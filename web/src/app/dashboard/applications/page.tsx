"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  api,
  AttendanceApplication,
  SubjectOffering,
  ApplicationStatus,
  ReviewDecision,
  ApplicationStats,
  ApplicationHistoryItem,
} from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Filter,
  User,
  AlertCircle,
  Search,
  RefreshCw,
  RotateCcw,
  Calendar,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Stethoscope,
  Trophy,
  Briefcase,
  AlertOctagon,
  History,
  Check,
  X,
  Send,
  HelpCircle,
  BookOpen,
  ArrowRight,
  UserCheck,
} from "lucide-react";

export default function ApplicationsPage() {
  const { user } = useDashboard();

  // Core Data States
  const [applications, setApplications] = useState<AttendanceApplication[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [offerings, setOfferings] = useState<SubjectOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | "">("");
  const [filterType, setFilterType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals States
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AttendanceApplication | null>(null);
  const [selectedDetailApp, setSelectedDetailApp] = useState<AttendanceApplication | null>(null);
  const [reviewMode, setReviewMode] = useState<"faculty" | "coordinator" | "hod" | null>(null);

  // Audit History state in Details Modal
  const [appHistory, setAppHistory] = useState<ApplicationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Student Submit Form State
  const [selectedOfferingId, setSelectedOfferingId] = useState<number | "">("");
  const [applicationCategory, setApplicationCategory] = useState("attendance_condonation");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  // Review Decision Form State
  const [decision, setDecision] = useState<ReviewDecision>("approved");
  const [remarks, setRemarks] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const isFaculty = user?.role === "faculty";
  const isAdmin = user?.role === "admin";
  const isStudent = user?.role === "student";

  // Check if faculty user has active Coordinator or HOD responsibility
  const coordResp = user?.faculty_profile?.responsibilities?.find(
    (r) => r.responsibility_type === "coordinator" && r.is_active
  );
  const isCoordinator = isFaculty && !!coordResp;

  const hodResp = user?.faculty_profile?.responsibilities?.find(
    (r) => r.responsibility_type === "hod" && r.is_active
  );
  const isHod = isFaculty && !!hodResp;

  // Active Queue switcher for faculty with multiple responsibilities
  const [activeQueue, setActiveQueue] = useState<"assigned" | "coordinator" | "hod">("assigned");

  useEffect(() => {
    loadApplications();
  }, [user, filterStatus, filterType, startDate, endDate, activeQueue]);

  async function loadApplications() {
    setLoading(true);
    setError(null);
    try {
      // 1. Load Stats
      try {
        const statsData = await api.applications.getStats();
        setStats(statsData);
      } catch (err) {
        console.warn("Could not load application stats:", err);
      }

      // 2. Load Applications according to role, queue & backend filters
      if (isStudent) {
        const [apps, off] = await Promise.all([
          api.applications.getMyApplications({
            status: filterStatus || undefined,
            application_type: filterType || undefined,
            query: searchQuery || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
          }),
          api.subjects.getOfferings().catch(() => []),
        ]);
        setApplications(apps);
        setOfferings(off);
      } else if (isFaculty) {
        let apps: AttendanceApplication[] = [];
        if (activeQueue === "coordinator" && isCoordinator) {
          apps = await api.applications.getCoordinatorApplications({
            status: filterStatus || undefined,
            application_type: filterType || undefined,
            query: searchQuery || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
          });
        } else if (activeQueue === "hod" && isHod) {
          apps = await api.applications.getHODApplications({
            status: filterStatus || undefined,
            application_type: filterType || undefined,
            query: searchQuery || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
          });
        } else {
          apps = await api.applications.getFacultyApplications({
            status: filterStatus || undefined,
            application_type: filterType || undefined,
            query: searchQuery || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
          });
        }
        setApplications(apps);
      } else if (isAdmin) {
        const apps = await api.applications.getAdminApplications({
          status: filterStatus || undefined,
          application_type: filterType || undefined,
          query: searchQuery || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        });
        setApplications(apps);
      }
    } catch (err: any) {
      console.error("Error loading applications:", err);
      setError(err?.message || "Failed to load attendance applications from the backend.");
    } finally {
      setLoading(false);
    }
  }

  // Client-side search filtering fallback for real-time responsiveness
  const filteredApplications = useMemo(() => {
    if (!searchQuery.trim()) return applications;
    const q = searchQuery.toLowerCase().trim();
    return applications.filter((app) => {
      const matchName = (app.student_name || "").toLowerCase().includes(q);
      const matchRoll = (app.student_roll_number || "").toLowerCase().includes(q);
      const matchSubject = (app.subject_name || "").toLowerCase().includes(q);
      const matchCode = (app.subject_code || "").toLowerCase().includes(q);
      const matchReason = (app.reason || "").toLowerCase().includes(q);
      const matchDesc = (app.description || "").toLowerCase().includes(q);
      const matchType = (app.application_type || "").toLowerCase().includes(q);
      const matchId = String(app.id).includes(q.replace("#", ""));
      return (
        matchName ||
        matchRoll ||
        matchSubject ||
        matchCode ||
        matchReason ||
        matchDesc ||
        matchType ||
        matchId
      );
    });
  }, [applications, searchQuery]);

  // Paginated applications
  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredApplications.slice(start, start + pageSize);
  }, [filteredApplications, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));

  function handleResetFilters() {
    setSearchQuery("");
    setFilterStatus("");
    setFilterType("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  }

  async function openDetailModal(app: AttendanceApplication) {
    setSelectedDetailApp(app);
    setHistoryLoading(true);
    try {
      const history = await api.applications.getApplicationHistory(app.id);
      setAppHistory(history);
    } catch (err) {
      console.error("Failed to load application history:", err);
      setAppHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openReviewModal(app: AttendanceApplication, mode: "faculty" | "coordinator" | "hod") {
    setSelectedApp(app);
    setReviewMode(mode);
    setDecision("approved");
    setRemarks("");
    setReviewError("");
  }

  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOfferingId) {
      setSubmitError("Please select a subject offering");
      return;
    }
    if (!reason.trim()) {
      setSubmitError("Please provide a summary reason");
      return;
    }
    if (!description.trim()) {
      setSubmitError("Please provide a detailed explanation of your absence");
      return;
    }

    setSubmitLoading(true);
    setSubmitError("");

    const formattedReason =
      applicationCategory !== "attendance_condonation"
        ? `[${formatCategoryName(applicationCategory)}] ${reason.trim()}`
        : reason.trim();

    try {
      await api.applications.submitApplication({
        subject_offering_id: Number(selectedOfferingId),
        reason: formattedReason,
        description: description.trim(),
        supporting_document_url: docUrl.trim() || undefined,
      });
      setShowSubmitModal(false);
      setReason("");
      setDescription("");
      setDocUrl("");
      setSelectedOfferingId("");
      await loadApplications();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit attendance application");
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleReviewApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedApp || !reviewMode) return;

    // Enforce mandatory remarks on rejection
    if (decision === "rejected" && !remarks.trim()) {
      setReviewError("Institutional policy requires a reason/remarks when rejecting an application.");
      return;
    }

    setReviewLoading(true);
    setReviewError("");

    try {
      if (reviewMode === "faculty") {
        await api.applications.reviewFacultyApplication(selectedApp.id, {
          decision,
          remarks: remarks.trim() || undefined,
        });
      } else if (reviewMode === "coordinator") {
        await api.applications.reviewCoordinatorApplication(selectedApp.id, {
          decision,
          remarks: remarks.trim() || undefined,
        });
      } else if (reviewMode === "hod") {
        await api.applications.reviewHODApplication(selectedApp.id, {
          decision,
          remarks: remarks.trim() || undefined,
        });
      }

      setSelectedApp(null);
      setReviewMode(null);
      setRemarks("");
      if (selectedDetailApp) {
        setSelectedDetailApp(null);
      }
      await loadApplications();
    } catch (err: any) {
      setReviewError(err.message || "Failed to submit decision");
    } finally {
      setReviewLoading(false);
    }
  }

  function formatCategoryName(type?: string | null) {
    switch (type) {
      case "medical_leave":
        return "Medical Leave";
      case "sports_representation":
        return "Sports Representation";
      case "duty_leave":
        return "Official Duty";
      case "personal_emergency":
        return "Personal Emergency";
      default:
        return "Attendance Condonation";
    }
  }

  function getCategoryBadge(type?: string | null) {
    switch (type) {
      case "medical_leave":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-950/50 text-red-300 border border-red-500/30">
            <Stethoscope className="w-3 h-3 text-red-400" /> Medical
          </span>
        );
      case "sports_representation":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-950/50 text-amber-300 border border-amber-500/30">
            <Trophy className="w-3 h-3 text-amber-400" /> Sports
          </span>
        );
      case "duty_leave":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-950/50 text-sky-300 border border-sky-500/30">
            <Briefcase className="w-3 h-3 text-sky-400" /> Official Duty
          </span>
        );
      case "personal_emergency":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-950/50 text-purple-300 border border-purple-500/30">
            <AlertOctagon className="w-3 h-3 text-purple-400" /> Emergency
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/50 text-emerald-300 border border-emerald-500/30">
            <FileText className="w-3 h-3 text-emerald-400" /> Condonation
          </span>
        );
    }
  }

  function getStatusBadge(status: ApplicationStatus) {
    switch (status) {
      case "pending_faculty":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Pending Faculty
          </span>
        );
      case "pending_coordinator":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-950/60 text-sky-400 border border-sky-500/30">
            <Clock className="w-3 h-3" /> Pending Coordinator
          </span>
        );
      case "faculty_approved":
      case "pending_hod":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-500/30">
            <Clock className="w-3 h-3" /> Pending HOD
          </span>
        );
      case "faculty_rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/70 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3 h-3 text-rose-400" /> Faculty Rejected
          </span>
        );
      case "approved":
      case "hod_approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Approved & Condoned
          </span>
        );
      case "rejected":
      case "hod_rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/70 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3 h-3 text-rose-400" /> Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-800 text-slate-300">
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
          <nav className="text-xs text-slate-400 mb-1">Dashboard / Leave Applications</nav>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-emerald-400" />
            Leave & Attendance Applications
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isStudent && "Submit attendance condonation requests, medical leaves, and track review status."}
            {isFaculty && "Review and approve student leave requests and attendance condonation."}
            {isAdmin && "Manage and track student leave applications and condonation status."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={loadApplications}
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

          {isStudent && (
            <Button
              onClick={() => {
                setSubmitError("");
                setShowSubmitModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 text-xs shadow-md shadow-emerald-950/40"
            >
              <Plus className="h-4 w-4" /> Submit Application
            </Button>
          )}
        </div>
      </div>

      {/* ── Multi-Stage Responsibility Queue Switcher for Faculty ── */}
      {isFaculty && (isCoordinator || isHod) && (
        <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-900/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-medium">Active Review Responsibilities:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveQueue("assigned")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeQueue === "assigned"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "bg-surface-950 text-slate-300 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <User className="w-3.5 h-3.5" /> Stage 1: My Classes
            </button>

            {isCoordinator && (
              <button
                onClick={() => setActiveQueue("coordinator")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  activeQueue === "coordinator"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-900/30"
                    : "bg-surface-950 text-slate-300 border border-slate-800 hover:border-slate-700"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-sky-400" /> Stage 2: Section Coordinator Desk
              </button>
            )}

            {isHod && (
              <button
                onClick={() => setActiveQueue("hod")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  activeQueue === "hod"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                    : "bg-surface-950 text-slate-300 border border-slate-800 hover:border-slate-700"
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Stage 3: HOD Final Decisions
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Dynamic KPI Summary Cards (3 Clean Metrics) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 border-slate-800/80 bg-surface-900/80 hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Applications</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">
              {stats ? stats.total_applications : applications.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Submitted student requests</p>
        </Card>

        <Card className="p-4 border-amber-900/40 bg-surface-900/80 hover:border-amber-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-300 font-mono">
              {stats ? (stats.pending_faculty || 0) + (stats.pending_coordinator || 0) + (stats.pending_hod || 0) : "0"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting approval</p>
        </Card>

        <Card className="p-4 border-emerald-950 bg-surface-900/80 hover:border-emerald-800/60 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Approved & Condoned</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">
              {stats ? stats.approved : "0"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Granted exam eligibility</p>
        </Card>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to connect to applications service</p>
              <p className="text-xs text-rose-300/80">{error}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={loadApplications}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs flex-shrink-0"
          >
            Retry Connection
          </Button>
        </div>
      )}

      {/* ── Search Bar & Filters ── */}
      <Card className="p-4 border-slate-800/80 bg-surface-900/70 space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Prominent Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name, roll number, application ID, subject..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/80 bg-surface-950 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
            />
          </div>

          {/* Application Type Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-44 px-3 py-2.5 rounded-xl border border-slate-700/80 bg-surface-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Application Types</option>
              <option value="attendance_condonation">Attendance Condonation</option>
              <option value="medical_leave">Medical Leave</option>
              <option value="sports_representation">Sports Representation</option>
              <option value="duty_leave">Official Duty</option>
              <option value="personal_emergency">Personal Emergency</option>
            </select>
          </div>

          {/* Workflow Status Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full sm:w-52 px-3 py-2.5 rounded-xl border border-slate-700/80 bg-surface-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Workflow Statuses</option>
              <option value="pending_faculty">Pending Faculty (Stage 1)</option>
              <option value="pending_coordinator">Pending Coordinator (Stage 2)</option>
              <option value="pending_hod">Pending HOD (Stage 3)</option>
              <option value="approved">Approved & Condoned</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Second Row: Date Range & Active Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/50">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Submitted Between:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-700/80 bg-surface-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-700/80 bg-surface-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />

            {(filterStatus || filterType || startDate || endDate || searchQuery) && (
              <button
                onClick={handleResetFilters}
                className="text-emerald-400 hover:text-emerald-300 underline font-medium ml-2"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Showing <span className="text-white font-semibold">{filteredApplications.length}</span> recorded applications
          </div>
        </div>
      </Card>

      {/* ── Responsive Applications Table ── */}
      <Card className="p-0 border-slate-800/80 bg-surface-900/70 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="text-left text-xs text-slate-400 bg-surface-950/60 border-b border-slate-800/80 font-medium">
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Subject & Class</th>
                <th className="py-3.5 px-4">Type & Reason</th>
                <th className="py-3.5 px-4">Attendance Impact</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                      <p className="text-sm">Loading attendance applications...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-slate-500" />
                      <p className="text-sm text-slate-300 font-medium">No applications found.</p>
                      <p className="text-xs text-slate-500">
                        Try resetting your search query or adjusting filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedApplications.map((app) => {
                  const canFacultyReview = isFaculty && app.status === "pending_faculty";
                  const canCoordinatorReview = isCoordinator && app.status === "pending_coordinator";
                  const canHodReview =
                    isHod && (app.status === "pending_hod" || app.status === "faculty_approved");

                  const attPct = app.attendance_percentage;
                  const threshold = app.attendance_threshold ?? 75.0;
                  const isEligible = app.is_exam_eligible;
                  const isCondoned = app.condonation_granted;

                  return (
                    <tr key={app.id} className="hover:bg-surface-800/40 transition">
                      {/* Student */}
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-white">{app.student_name || `Student #${app.student_id}`}</p>
                        <span className="text-[11px] font-mono text-emerald-400">
                          {app.student_roll_number || "N/A"}
                        </span>
                      </td>

                      {/* Subject & Section */}
                      <td className="py-3.5 px-4">
                        <p className="text-xs font-medium text-slate-200">{app.subject_name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {app.subject_code} · {app.section_name || "Section A"}
                        </p>
                      </td>

                      {/* Application Type & Reason */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="mb-1">{getCategoryBadge(app.application_type)}</div>
                        <p className="text-xs text-slate-300 truncate" title={app.reason}>
                          {app.reason}
                        </p>
                      </td>

                      {/* Attendance Context & Eligibility */}
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span
                              className={
                                isCondoned || (attPct !== null && attPct !== undefined && attPct >= threshold)
                                  ? "text-emerald-400 font-semibold"
                                  : "text-rose-400 font-semibold"
                              }
                            >
                              {attPct !== null && attPct !== undefined ? `${attPct}%` : "—"}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              (min {threshold}%)
                            </span>
                          </div>
                          <div className="text-[10px]">
                            {isCondoned ? (
                              <span className="text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Condoned & Eligible
                              </span>
                            ) : isEligible ? (
                              <span className="text-emerald-400">Exam Eligible</span>
                            ) : (
                              <span className="text-rose-400">Short Attendance</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(app.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDetailModal(app)}
                            className="border-slate-700 bg-surface-900 hover:bg-surface-800 text-slate-200 text-xs px-2.5 h-7"
                            title="View full details and audit history"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
                          </Button>

                          {canFacultyReview && (
                            <Button
                              size="sm"
                              onClick={() => openReviewModal(app, "faculty")}
                              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2.5 h-7"
                              title="Stage 1: Review as Assigned Subject Faculty"
                            >
                              Review
                            </Button>
                          )}

                          {canCoordinatorReview && (
                            <Button
                              size="sm"
                              onClick={() => openReviewModal(app, "coordinator")}
                              className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-2.5 h-7"
                              title="Stage 2: Review as Section Coordinator"
                            >
                              Review
                            </Button>
                          )}

                          {canHodReview && (
                            <Button
                              size="sm"
                              onClick={() => openReviewModal(app, "hod")}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 h-7"
                              title="Stage 3: Final Decision as Head of Department"
                            >
                              Decision
                            </Button>
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

      {/* ── Section 4: Complete Application Details & 3-Stage Approval Timeline Modal ── */}
      <Modal
        isOpen={!!selectedDetailApp}
        onClose={() => setSelectedDetailApp(null)}
        title={`Application #${selectedDetailApp?.id} Details & Workflow History`}
        description={`Student: ${selectedDetailApp?.student_name} (${selectedDetailApp?.student_roll_number})`}
        maxWidth="lg"
      >
        {selectedDetailApp && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Header Status & Category Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-800 bg-surface-950/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Current Workflow Stage:</span>
                {getStatusBadge(selectedDetailApp.status)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Category:</span>
                {getCategoryBadge(selectedDetailApp.application_type)}
              </div>
            </div>

            {/* Attendance Context & Institutional Eligibility Card */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-950/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Attendance Context & Exam Eligibility
                </span>
                {selectedDetailApp.condonation_granted ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="w-3.5 h-3.5" /> CONDONED — EXAM ELIGIBLE
                  </span>
                ) : selectedDetailApp.is_exam_eligible ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ELIGIBLE (≥{selectedDetailApp.attendance_threshold}%)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-500/40">
                    <XCircle className="w-3.5 h-3.5" /> SHORT ATTENDANCE (&lt;{selectedDetailApp.attendance_threshold}%)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div className="bg-surface-900/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Actual Attendance</span>
                  <span className="text-base font-bold font-mono text-white">
                    {selectedDetailApp.attendance_percentage !== null && selectedDetailApp.attendance_percentage !== undefined
                      ? `${selectedDetailApp.attendance_percentage}%`
                      : "—"}
                  </span>
                </div>
                <div className="bg-surface-900/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Policy Threshold</span>
                  <span className="text-base font-bold font-mono text-amber-400">
                    {selectedDetailApp.attendance_threshold ?? 75}%
                  </span>
                </div>
                <div className="bg-surface-900/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Conducted Sessions</span>
                  <span className="text-base font-bold font-mono text-slate-200">
                    {selectedDetailApp.total_sessions ?? 0}
                  </span>
                </div>
                <div className="bg-surface-900/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Attended Sessions</span>
                  <span className="text-base font-bold font-mono text-emerald-400">
                    {selectedDetailApp.attended_sessions ?? 0}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Raw session attendance records remain authentic and unmanipulated. Approved condonation grants official exam eligibility without fabricating attendance logs.
              </p>
            </div>

            {/* Academic Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-slate-800 bg-surface-950/60 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Student Name</span>
                <p className="font-semibold text-white">{selectedDetailApp.student_name}</p>
                <p className="text-[11px] text-slate-400 font-mono">{selectedDetailApp.student_roll_number}</p>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Subject Offering</span>
                <p className="font-semibold text-white">{selectedDetailApp.subject_name}</p>
                <p className="text-[11px] text-emerald-400 font-mono">
                  {selectedDetailApp.subject_code} {selectedDetailApp.class_type ? `(${selectedDetailApp.class_type})` : ""}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Department / Section</span>
                <p className="font-semibold text-white">{selectedDetailApp.department_name || "Engineering"}</p>
                <p className="text-[11px] text-slate-400">
                  {selectedDetailApp.section_name} {selectedDetailApp.student_group_name ? `• ${selectedDetailApp.student_group_name}` : ""}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Course / Semester</span>
                <p className="font-semibold text-white">
                  {selectedDetailApp.course_name || "B.Tech"} {selectedDetailApp.branch_name ? `(${selectedDetailApp.branch_name})` : ""}
                </p>
                <p className="text-[11px] text-slate-400">
                  {selectedDetailApp.semester ? `Semester ${selectedDetailApp.semester}` : "Current Semester"}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Submission Timestamp</span>
                <p className="font-mono text-slate-200">{formatDateTime(selectedDetailApp.submitted_at)}</p>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Supporting Document</span>
                {selectedDetailApp.supporting_document_url ? (
                  <a
                    href={selectedDetailApp.supporting_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-medium mt-0.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Document
                  </a>
                ) : (
                  <span className="text-slate-500 italic">No document attached</span>
                )}
              </div>
            </div>

            {/* Application Reason & Detailed Explanation */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-950/60 space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Reason & Context of Absence
              </span>
              <div className="p-2.5 rounded-lg bg-surface-900/60 border border-slate-800 text-xs font-medium text-slate-200">
                {selectedDetailApp.reason}
              </div>
              <div className="p-3 rounded-lg bg-surface-900/40 border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedDetailApp.description}
              </div>
            </div>

            {/* Three-Stage Approval Workflow Visual Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Stage 1: Faculty Review */}
              <div className="p-3 rounded-xl border border-slate-800 bg-surface-950/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" /> Stage 1: Faculty
                  </span>
                  {selectedDetailApp.faculty_decision ? (
                    <span
                      className={`font-semibold ${
                        selectedDetailApp.faculty_decision === "approved" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {selectedDetailApp.faculty_decision.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-amber-400 font-mono text-[11px]">PENDING</span>
                  )}
                </div>
                <div className="text-slate-400 text-[11px]">
                  Instructor: <span className="text-slate-200 font-medium">{selectedDetailApp.faculty_reviewer_name || "—"}</span>
                </div>
                {selectedDetailApp.faculty_remarks && (
                  <p className="text-slate-300 text-[11px] italic bg-surface-900/50 p-2 rounded border border-slate-800">
                    &ldquo;{selectedDetailApp.faculty_remarks}&rdquo;
                  </p>
                )}
                {selectedDetailApp.faculty_reviewed_at && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    {formatDateTime(selectedDetailApp.faculty_reviewed_at)}
                  </p>
                )}
              </div>

              {/* Stage 2: Section Coordinator Review */}
              <div className="p-3 rounded-xl border border-slate-800 bg-surface-950/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-sky-400" /> Stage 2: Coordinator
                  </span>
                  {selectedDetailApp.coordinator_decision ? (
                    <span
                      className={`font-semibold ${
                        selectedDetailApp.coordinator_decision === "approved" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {selectedDetailApp.coordinator_decision.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-mono text-[11px]">
                      {selectedDetailApp.status === "pending_coordinator"
                        ? "PENDING"
                        : selectedDetailApp.status === "pending_faculty"
                        ? "AWAITING S1"
                        : "—"}
                    </span>
                  )}
                </div>
                <div className="text-slate-400 text-[11px]">
                  Coordinator: <span className="text-slate-200 font-medium">{selectedDetailApp.coordinator_reviewer_name || "—"}</span>
                </div>
                {selectedDetailApp.coordinator_remarks && (
                  <p className="text-slate-300 text-[11px] italic bg-surface-900/50 p-2 rounded border border-slate-800">
                    &ldquo;{selectedDetailApp.coordinator_remarks}&rdquo;
                  </p>
                )}
                {selectedDetailApp.coordinator_reviewed_at && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    {formatDateTime(selectedDetailApp.coordinator_reviewed_at)}
                  </p>
                )}
              </div>

              {/* Stage 3: HOD Final Decision */}
              <div className="p-3 rounded-xl border border-slate-800 bg-surface-950/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-400" /> Stage 3: HOD Decision
                  </span>
                  {selectedDetailApp.hod_decision ? (
                    <span
                      className={`font-semibold ${
                        selectedDetailApp.hod_decision === "approved" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {selectedDetailApp.hod_decision === "approved" ? "CONDONED" : "REJECTED"}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-mono text-[11px]">
                      {selectedDetailApp.status === "pending_hod" || selectedDetailApp.status === "faculty_approved"
                        ? "PENDING"
                        : "AWAITING"}
                    </span>
                  )}
                </div>
                <div className="text-slate-400 text-[11px]">
                  HOD: <span className="text-slate-200 font-medium">{selectedDetailApp.hod_reviewer_name || "—"}</span>
                </div>
                {selectedDetailApp.hod_remarks && (
                  <p className="text-slate-300 text-[11px] italic bg-surface-900/50 p-2 rounded border border-slate-800">
                    &ldquo;{selectedDetailApp.hod_remarks}&rdquo;
                  </p>
                )}
                {selectedDetailApp.hod_reviewed_at && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    {formatDateTime(selectedDetailApp.hod_reviewed_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Chronological Institutional Audit Trail */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-950/60 space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-emerald-400" /> Chronological Approval History & Notifications
              </span>
              {historyLoading ? (
                <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> Loading history...
                </div>
              ) : appHistory.length === 0 ? (
                <div className="p-2.5 rounded-lg bg-surface-900/40 text-[11px] text-slate-500">
                  Application recorded on {formatDateTime(selectedDetailApp.submitted_at)}.
                </div>
              ) : (
                <div className="relative pl-5 space-y-3 border-l border-slate-800 ml-2 mt-2">
                  {appHistory.map((item) => (
                    <div key={item.id} className="relative">
                      <div className="absolute -left-[27px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-surface-950" />
                      <div className="p-2.5 rounded-lg border border-slate-800 bg-surface-900/50 text-xs space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{item.user_name}</span>
                          <span className="text-[10px] font-mono text-slate-500">{formatDateTime(item.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Action: <span className="text-emerald-400 font-mono">{item.action}</span>
                          {item.decision ? ` • Decision: ${item.decision.toUpperCase()}` : ""}
                        </p>
                        {item.remarks && (
                          <p className="text-[11px] text-slate-300 italic pt-0.5">&ldquo;{item.remarks}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons in Modal */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex gap-2">
                {isFaculty && selectedDetailApp.status === "pending_faculty" && (
                  <Button
                    size="sm"
                    onClick={() => openReviewModal(selectedDetailApp, "faculty")}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
                  >
                    Review as Faculty
                  </Button>
                )}
                {isCoordinator && selectedDetailApp.status === "pending_coordinator" && (
                  <Button
                    size="sm"
                    onClick={() => openReviewModal(selectedDetailApp, "coordinator")}
                    className="bg-sky-600 hover:bg-sky-500 text-white text-xs"
                  >
                    Review as Coordinator
                  </Button>
                )}
                {isHod && (selectedDetailApp.status === "pending_hod" || selectedDetailApp.status === "faculty_approved") && (
                  <Button
                    size="sm"
                    onClick={() => openReviewModal(selectedDetailApp, "hod")}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                  >
                    Take HOD Final Decision
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => setSelectedDetailApp(null)}
                className="text-xs border-slate-700 bg-surface-900 text-slate-300"
              >
                Close Details
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Student Submit Modal ── */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Attendance Application"
        description="Official application to request condonation for short attendance or report official absences."
        maxWidth="md"
      >
        <form onSubmit={handleSubmitApplication} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Offering *</label>
            <select
              value={selectedOfferingId}
              onChange={(e) => setSelectedOfferingId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-xl border border-slate-700 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              required
            >
              <option value="">Select enrolled subject offering...</option>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.subject_name} ({o.class_type}) · Sem {o.semester} ({o.section_name || "Section A"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Application Category *</label>
            <select
              value={applicationCategory}
              onChange={(e) => setApplicationCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="attendance_condonation">General Attendance Condonation</option>
              <option value="medical_leave">Medical Leave / Hospitalization</option>
              <option value="sports_representation">Sports / Inter-College Tournament</option>
              <option value="duty_leave">Official Institutional Duty / Hackathon</option>
              <option value="personal_emergency">Personal / Family Emergency</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Summary Reason *</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Hospitalization due to viral fever with doctor certificate"
              required
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Detailed Explanation *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-700 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              placeholder="Specify the dates of absence, lecture sessions missed, and circumstances..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Supporting Document URL <span className="text-[11px] text-slate-500 font-normal">(Optional Google Drive / Cloud link)</span>
            </label>
            <Input
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://drive.google.com/file/..."
              className="text-xs"
            />
          </div>

          {submitError && (
            <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/30">
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowSubmitModal(false)}
              className="text-xs border-slate-700 bg-surface-900"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitLoading}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {submitLoading ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Three-Stage Review Decision Modal (Faculty / Coordinator / HOD) ── */}
      <Modal
        isOpen={!!selectedApp && !!reviewMode}
        onClose={() => {
          setSelectedApp(null);
          setReviewMode(null);
        }}
        title={
          reviewMode === "faculty"
            ? `Stage 1: Faculty Review — Application #${selectedApp?.id}`
            : reviewMode === "coordinator"
            ? `Stage 2: Section Coordinator Review — Application #${selectedApp?.id}`
            : `Stage 3: HOD Final Decision — Application #${selectedApp?.id}`
        }
        description={`Student: ${selectedApp?.student_name} (${selectedApp?.student_roll_number}) · Subject: ${selectedApp?.subject_name}`}
        maxWidth="md"
      >
        <form onSubmit={handleReviewApplication} className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-surface-950/80 p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Application Type:</span>
              <span>{getCategoryBadge(selectedApp?.application_type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Attendance Context:</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {selectedApp?.attendance_percentage !== null && selectedApp?.attendance_percentage !== undefined
                  ? `${selectedApp.attendance_percentage}%`
                  : "—"}{" "}
                <span className="text-slate-400 font-normal">
                  (min {selectedApp?.attendance_threshold ?? 75}%)
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reason:</span>
              <span className="text-right text-slate-200 max-w-[70%] font-medium">{selectedApp?.reason}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Details:</span>
              <p className="text-slate-300 text-[11px] leading-relaxed bg-surface-900/60 p-2 rounded border border-slate-800">
                {selectedApp?.description}
              </p>
            </div>
            {selectedApp?.supporting_document_url && (
              <p className="pt-1">
                <a
                  href={selectedApp.supporting_document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Submitted Supporting Document
                </a>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Review Outcome *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecision("approved")}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center gap-2 ${
                  decision === "approved"
                    ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
                    : "border-slate-800 bg-surface-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div>
                    {reviewMode === "faculty"
                      ? "Approve & Forward"
                      : reviewMode === "coordinator"
                      ? "Approve & Forward to HOD"
                      : "Approve & Grant Condonation"}
                  </div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    {reviewMode === "faculty"
                      ? "Advance to Section Coordinator"
                      : reviewMode === "coordinator"
                      ? "Advance to Department HOD"
                      : "Official exam eligibility granted"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision("rejected")}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center gap-2 ${
                  decision === "rejected"
                    ? "border-rose-500 bg-rose-950/60 text-rose-300"
                    : "border-slate-800 bg-surface-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <div>
                  <div>Reject Application</div>
                  <div className="text-[10px] text-slate-500 font-normal">Requires mandatory reason</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Review Remarks {decision === "rejected" ? "*" : "(Optional)"}{" "}
              <span className="text-[11px] text-slate-500 font-normal">
                {decision === "rejected" ? "Mandatory for rejection" : "Recorded in institutional audit log"}
              </span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              required={decision === "rejected"}
              className="w-full rounded-xl border border-slate-700 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              placeholder={
                decision === "rejected"
                  ? "Enter the exact reason for rejecting this application (required)..."
                  : "Enter any verification notes or conditions..."
              }
            />
          </div>

          {reviewError && (
            <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/30">
              {reviewError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setSelectedApp(null);
                setReviewMode(null);
              }}
              disabled={reviewLoading}
              className="text-xs border-slate-700 bg-surface-900"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={reviewLoading}
              className={`text-xs text-white font-medium ${
                decision === "approved"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-rose-600 hover:bg-rose-500"
              }`}
            >
              {reviewLoading
                ? "Recording Decision..."
                : `Confirm ${decision === "approved" ? "Approval" : "Rejection"}`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
