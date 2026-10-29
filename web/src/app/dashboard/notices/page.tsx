"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  api,
  Notice,
  AudienceType,
  Department,
  Branch,
  StudentGroup,
} from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  Megaphone,
  Plus,
  Calendar,
  Building2,
  Users,
  Grid,
  Layers,
  Trash2,
  Edit2,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpDown,
  Tag,
  Eye,
  ShieldCheck,
  RefreshCw,
  X,
  FileText,
} from "lucide-react";

const CATEGORIES = [
  "General",
  "Academic",
  "Examination",
  "Administrative",
  "Event",
  "Urgent",
];

export default function NoticesPage() {
  const { user } = useDashboard();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Search, filter & sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [detailNotice, setDetailNotice] = useState<Notice | null>(null);
  const [confirmDeleteNotice, setConfirmDeleteNotice] = useState<Notice | null>(null);

  // Form state (used for create & edit)
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [formAudienceType, setFormAudienceType] = useState<AudienceType>("all");
  const [formDeptId, setFormDeptId] = useState<number | "">("");
  const [formBranchId, setFormBranchId] = useState<number | "">("");
  const [formGroupId, setFormGroupId] = useState<number | "">("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const isAdmin = user?.role === "admin";
  const isCoordinator = user?.faculty_profile?.responsibilities?.some(
    (r) => r.responsibility_type === "coordinator" && r.is_active
  );

  useEffect(() => {
    loadNotices();
  }, [user]);

  async function loadNotices() {
    setLoading(true);
    try {
      if (isAdmin) {
        const [nList, depts, brs, grps] = await Promise.all([
          api.notices.getNotices(),
          api.academic.getDepartments().catch(() => []),
          api.academic.getBranches().catch(() => []),
          api.academic.getStudentGroups().catch(() => []),
        ]);
        // Deduplicate notices by ID
        const unique = Array.from(new Map(nList.map((n) => [n.id, n])).values());
        setNotices(unique);
        setDepartments(depts);
        setBranches(brs);
        setGroups(grps);
      } else {
        const myNotices = await api.notices.getMyNotices();
        // Deduplicate notices by ID
        const unique = Array.from(new Map(myNotices.map((n) => [n.id, n])).values());
        setNotices(unique);
      }
    } catch (err) {
      console.error("Error loading notices:", err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setFormTitle("");
    setFormContent("");
    setFormCategory("General");
    setFormAudienceType("all");
    setFormDeptId("");
    setFormBranchId("");
    setFormGroupId("");
    setFormExpiresAt("");
    setFormIsActive(true);
    setModalError("");
    setShowCreateModal(true);
  }

  function openEditModal(notice: Notice) {
    setEditingNotice(notice);
    setFormTitle(notice.title);
    setFormContent(notice.content);
    setFormCategory(notice.category || "General");
    setFormAudienceType(notice.audience_type);
    setFormDeptId(notice.department_id || "");
    setFormBranchId(notice.branch_id || "");
    setFormGroupId(notice.student_group_id || "");
    setFormExpiresAt(notice.expires_at ? notice.expires_at.split("T")[0] : "");
    setFormIsActive(notice.is_active);
    setModalError("");
  }

  async function handleCreateNotice(e: React.FormEvent) {
    e.preventDefault();
    setModalLoading(true);
    setModalError("");
    try {
      await api.notices.createNotice({
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        audience_type: formAudienceType,
        department_id: formAudienceType === "department" && formDeptId ? Number(formDeptId) : undefined,
        branch_id: formAudienceType === "branch" && formBranchId ? Number(formBranchId) : undefined,
        student_group_id: formAudienceType === "group" && formGroupId ? Number(formGroupId) : undefined,
        expires_at: formExpiresAt ? new Date(formExpiresAt).toISOString() : undefined,
        is_active: formIsActive,
      });
      setShowCreateModal(false);
      setActionSuccess("Notice published successfully to the bulletin board.");
      setTimeout(() => setActionSuccess(""), 4000);
      await loadNotices();
    } catch (err: any) {
      setModalError(err.message || "Failed to create notice");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleUpdateNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!editingNotice) return;
    setModalLoading(true);
    setModalError("");
    try {
      await api.notices.updateNotice(editingNotice.id, {
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        audience_type: formAudienceType,
        department_id: formAudienceType === "department" && formDeptId ? Number(formDeptId) : null,
        branch_id: formAudienceType === "branch" && formBranchId ? Number(formBranchId) : null,
        student_group_id: formAudienceType === "group" && formGroupId ? Number(formGroupId) : null,
        expires_at: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
        is_active: formIsActive,
      });
      setEditingNotice(null);
      setActionSuccess("Notice updated successfully.");
      setTimeout(() => setActionSuccess(""), 4000);
      await loadNotices();
    } catch (err: any) {
      setModalError(err.message || "Failed to update notice");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteNotice) return;
    setModalLoading(true);
    try {
      await api.notices.deleteNotice(confirmDeleteNotice.id);
      setConfirmDeleteNotice(null);
      setActionSuccess(`Notice #${confirmDeleteNotice.id} deactivated successfully.`);
      setTimeout(() => setActionSuccess(""), 4000);
      await loadNotices();
    } catch (err: any) {
      alert(err.message || "Failed to deactivate notice");
    } finally {
      setModalLoading(false);
    }
  }

  // Filtered and sorted notices
  const filteredNotices = useMemo(() => {
    return notices
      .filter((n) => {
        // Status filter (Admin only)
        if (isAdmin) {
          if (statusFilter === "active" && !n.is_active) return false;
          if (statusFilter === "inactive" && n.is_active) return false;
        }

        // Category filter
        if (categoryFilter !== "all" && (n.category || "General").toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }

        // Audience filter
        if (audienceFilter !== "all") {
          if (audienceFilter === "all_campus" && n.audience_type !== "all") return false;
          if (audienceFilter === "targeted" && n.audience_type === "all") return false;
          if (audienceFilter !== "all_campus" && audienceFilter !== "targeted" && n.audience_type !== audienceFilter) {
            return false;
          }
        }

        // Search query (title or content)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = n.title.toLowerCase().includes(q);
          const matchContent = n.content.toLowerCase().includes(q);
          const matchCreator = (n.creator_name || "").toLowerCase().includes(q);
          if (!matchTitle && !matchContent && !matchCreator) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.published_at).getTime();
        const timeB = new Date(b.published_at).getTime();
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
      });
  }, [notices, statusFilter, categoryFilter, audienceFilter, searchQuery, sortOrder, isAdmin]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = notices.length;
    const active = notices.filter((n) => n.is_active).length;
    const allCampus = notices.filter((n) => n.audience_type === "all").length;
    const targeted = notices.filter((n) => n.audience_type !== "all").length;
    return { total, active, allCampus, targeted };
  }, [notices]);

  function getCategoryBadge(category?: string | null) {
    const cat = category || "General";
    switch (cat.toLowerCase()) {
      case "academic":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-950/80 text-blue-300 border border-blue-500/30">
            Academic
          </span>
        );
      case "examination":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-500/30">
            Examination
          </span>
        );
      case "administrative":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
            Administrative
          </span>
        );
      case "event":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-950/80 text-purple-300 border border-purple-500/30">
            Event
          </span>
        );
      case "urgent":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/80 text-rose-300 border border-rose-500/30 animate-pulse">
            Urgent
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
            General
          </span>
        );
    }
  }

  function getAudienceBadge(type: AudienceType) {
    switch (type) {
      case "all":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-500/20">
            ALL CAMPUS
          </span>
        );
      case "students":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-500/20">
            STUDENTS ONLY
          </span>
        );
      case "faculty":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950 text-purple-400 border border-purple-500/20">
            FACULTY ONLY
          </span>
        );
      case "coordinators":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-500/20">
            COORDINATORS ONLY
          </span>
        );
      case "department":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-500/20">
            DEPARTMENT
          </span>
        );
      case "branch":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-950 text-teal-400 border border-teal-500/20">
            BRANCH
          </span>
        );
      case "group":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-500/20">
            STUDENT GROUP
          </span>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-slate-200">Notice Board</span>
            {isCoordinator && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                Section Coordinator
              </span>
            )}
          </nav>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            Campus Announcements & Notices
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isAdmin
              ? "Centralized administrative notice board: publish and manage notices with automated audience targeting."
              : "Official campus circulars and announcements targeted to your enrolled branch, department, or group."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadNotices}
            disabled={loading}
            className="border-slate-700 hover:border-slate-600 text-slate-300 flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {isAdmin && (
            <Button
              onClick={openCreateModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-950/30"
            >
              <Plus className="h-4 w-4" /> Create Notice
            </Button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-sm flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isAdmin ? "Total Notices" : "Visible Notices"}
            </span>
            <Megaphone className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{metrics.total}</span>
            <span className="text-xs text-slate-400">in database</span>
          </div>
        </Card>

        <Card className="p-4 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Campus Wide</span>
            <Building2 className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-400 font-mono">{metrics.allCampus}</span>
            <span className="text-xs text-slate-400">All users</span>
          </div>
        </Card>

        <Card className="p-4 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Targeted</span>
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-400 font-mono">{metrics.targeted}</span>
            <span className="text-xs text-slate-400">Dept/Branch/Group</span>
          </div>
        </Card>

        <Card className="p-4 border-slate-800/60 bg-surface-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isAdmin ? "Published & Active" : "Filtered Matches"}
            </span>
            <ShieldCheck className="h-4 w-4 text-teal-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-400 font-mono">
              {isAdmin ? metrics.active : filteredNotices.length}
            </span>
            <span className="text-xs text-slate-400">{isAdmin ? "active" : "showing"}</span>
          </div>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <Card className="p-4 border-slate-800/60 bg-surface-900/70 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search notices by title, content, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-900/80 border-slate-700/80 text-sm text-slate-200 placeholder:text-slate-500 w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Tag className="h-3.5 w-3.5" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Audience Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5" />
              <select
                value={audienceFilter}
                onChange={(e) => setAudienceFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Audiences</option>
                <option value="all_campus">All Campus</option>
                <option value="targeted">Targeted Only</option>
                <option value="students">Students Only</option>
                <option value="faculty">Faculty Only</option>
                <option value="coordinators">Coordinators Only</option>
                <option value="department">Specific Department</option>
                <option value="branch">Specific Branch</option>
                <option value="group">Student Group</option>
              </select>
            </div>

            {/* Status Filter (Admin Only) */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Filter className="h-3.5 w-3.5" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Deactivated Only</option>
                </select>
              </div>
            )}

            {/* Sort Order */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
              className="border-slate-700 hover:border-slate-600 text-xs text-slate-300 flex items-center gap-1.5"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortOrder === "newest" ? "Newest First" : "Oldest First"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Notices Feed */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-12 text-center border-slate-800/60 bg-surface-900/70">
            <RefreshCw className="h-8 w-8 text-emerald-500 mx-auto mb-3 animate-spin" />
            <p className="text-slate-400 text-sm">Loading campus notices from backend...</p>
          </Card>
        ) : filteredNotices.length === 0 ? (
          <Card className="p-12 text-center border-slate-800/60 bg-surface-900/70">
            <Megaphone className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-medium text-white mb-1">No notices found</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              {searchQuery || categoryFilter !== "all" || audienceFilter !== "all"
                ? "No published notices match your search or filter criteria. Try resetting filters."
                : "There are currently no active announcements published for your audience."}
            </p>
            {(searchQuery || categoryFilter !== "all" || audienceFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setAudienceFilter("all");
                }}
                className="mt-4 text-xs border-slate-700 text-slate-300"
              >
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          filteredNotices.map((n) => (
            <Card
              key={n.id}
              className={`p-6 border-slate-800/60 bg-surface-900/70 hover:border-slate-700/60 transition-colors ${
                !n.is_active ? "opacity-60 bg-surface-950/80" : ""
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-2 flex-1">
                  {/* Badges Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {getAudienceBadge(n.audience_type)}
                    {getCategoryBadge(n.category)}
                    {n.department_name && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-slate-500" />
                        {n.department_name}
                      </span>
                    )}
                    {n.branch_name && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Layers className="h-3 w-3 text-slate-500" />
                        {n.branch_name}
                      </span>
                    )}
                    {n.student_group_name && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Grid className="h-3 w-3 text-slate-500" />
                        Group: {n.student_group_name}
                      </span>
                    )}
                    {!n.is_active && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-400 font-semibold uppercase border border-rose-500/30">
                        Deactivated
                      </span>
                    )}
                  </div>

                  {/* Title & Preview */}
                  <h3
                    onClick={() => setDetailNotice(n)}
                    className="text-lg font-semibold text-white hover:text-emerald-400 cursor-pointer transition-colors"
                  >
                    {n.title}
                  </h3>
                  <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed line-clamp-3">
                    {n.content}
                  </p>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      Published: {new Date(n.published_at).toLocaleDateString()}
                    </span>
                    {n.creator_name && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-slate-500" />
                        By: {n.creator_name}
                      </span>
                    )}
                    {n.expires_at && (
                      <span className="flex items-center gap-1 text-amber-400/80">
                        <Clock className="h-3.5 w-3.5" />
                        Valid until: {new Date(n.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-1 sm:pt-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDetailNotice(n)}
                    className="text-slate-300 hover:text-white text-xs border-slate-700/80 flex items-center gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" /> View Notice
                  </Button>

                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(n)}
                        className="text-slate-300 hover:text-emerald-400 text-xs border-slate-700/80 p-2"
                        title="Edit Notice"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      {n.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDeleteNotice(n)}
                          className="text-rose-400 hover:text-rose-300 text-xs border-rose-500/20 p-2"
                          title="Deactivate Notice"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Notice Detail Modal */}
      <Modal
        isOpen={!!detailNotice}
        onClose={() => setDetailNotice(null)}
        title="Notice Announcement Details"
        description="Official institutional circular published on the GeoAttend AI bulletin board."
      >
        {detailNotice && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {getAudienceBadge(detailNotice.audience_type)}
                {getCategoryBadge(detailNotice.category)}
                {!detailNotice.is_active && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-400 font-semibold uppercase">
                    Deactivated
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white">{detailNotice.title}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono pt-1 border-t border-slate-800/80">
                <span>Published: {new Date(detailNotice.published_at).toLocaleString()}</span>
                {detailNotice.creator_name && <span>Published by: {detailNotice.creator_name}</span>}
                {detailNotice.expires_at && (
                  <span className="text-amber-400">
                    Expiry: {new Date(detailNotice.expires_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-surface-900 text-sm text-slate-200 leading-relaxed whitespace-pre-line max-h-96 overflow-y-auto">
              {detailNotice.content}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const target = detailNotice;
                    setDetailNotice(null);
                    openEditModal(target);
                  }}
                  className="text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1.5"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit Notice
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailNotice(null)}
                className="text-slate-300 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Admin Create Notice Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Publish Campus Notice"
        description="Creates an official notice on the bulletin board and automatically dispatches notifications to eligible users."
      >
        <form onSubmit={handleCreateNotice} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Notice Title *</label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g., Semester Examination & Attendance Policy"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Notice Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Audience *</label>
              <select
                value={formAudienceType}
                onChange={(e) => setFormAudienceType(e.target.value as AudienceType)}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">ALL CAMPUS (Students, Faculty, Staff)</option>
                <option value="students">STUDENTS ONLY</option>
                <option value="faculty">FACULTY ONLY</option>
                <option value="coordinators">COORDINATORS ONLY</option>
                <option value="department">SPECIFIC DEPARTMENT</option>
                <option value="branch">SPECIFIC BRANCH</option>
                <option value="group">SPECIFIC STUDENT GROUP</option>
              </select>
            </div>
          </div>

          {formAudienceType === "department" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Department *</label>
              <select
                value={formDeptId}
                onChange={(e) => setFormDeptId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                required
              >
                <option value="">Choose department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {formAudienceType === "branch" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Branch *</label>
              <select
                value={formBranchId}
                onChange={(e) => setFormBranchId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                required
              >
                <option value="">Choose branch...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {formAudienceType === "group" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Student Group *</label>
              <select
                value={formGroupId}
                onChange={(e) => setFormGroupId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                required
              >
                <option value="">Choose student group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Group {g.name} (Section #{g.section_id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Expiration Date (Optional)
            </label>
            <Input
              type="date"
              value={formExpiresAt}
              onChange={(e) => setFormExpiresAt(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Notice Content / Full Details *
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              placeholder="Enter full announcement circular text..."
              required
            />
          </div>

          {modalError && <p className="text-xs text-rose-400">{modalError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={modalLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {modalLoading ? "Publishing..." : "Publish Notice"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admin Edit Notice Modal */}
      <Modal
        isOpen={!!editingNotice}
        onClose={() => setEditingNotice(null)}
        title={`Edit Notice #${editingNotice?.id}`}
        description="Update published notice content, audience targeting, or publication status."
      >
        <form onSubmit={handleUpdateNotice} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Notice Title *</label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Notice Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Audience *</label>
              <select
                value={formAudienceType}
                onChange={(e) => setFormAudienceType(e.target.value as AudienceType)}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">ALL CAMPUS (Students, Faculty, Staff)</option>
                <option value="students">STUDENTS ONLY</option>
                <option value="faculty">FACULTY ONLY</option>
                <option value="coordinators">COORDINATORS ONLY</option>
                <option value="department">SPECIFIC DEPARTMENT</option>
                <option value="branch">SPECIFIC BRANCH</option>
                <option value="group">SPECIFIC STUDENT GROUP</option>
              </select>
            </div>
          </div>

          {formAudienceType === "department" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Department *</label>
              <select
                value={formDeptId}
                onChange={(e) => setFormDeptId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                required
              >
                <option value="">Choose department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {formAudienceType === "branch" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Branch *</label>
              <select
                value={formBranchId}
                onChange={(e) => setFormBranchId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                required
              >
                <option value="">Choose branch...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {formAudienceType === "group" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Student Group *</label>
              <select
                value={formGroupId}
                onChange={(e) => setFormGroupId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                required
              >
                <option value="">Choose student group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Group {g.name} (Section #{g.section_id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Expiration Date (Optional)
              </label>
              <Input
                type="date"
                value={formExpiresAt}
                onChange={(e) => setFormExpiresAt(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Publication Status</label>
              <select
                value={formIsActive ? "active" : "inactive"}
                onChange={(e) => setFormIsActive(e.target.value === "active")}
                className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="active">Active / Published</option>
                <option value="inactive">Deactivated / Hidden</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Notice Content / Full Details *
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          {modalError && <p className="text-xs text-rose-400">{modalError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setEditingNotice(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={modalLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {modalLoading ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admin Confirm Deactivate Modal */}
      <Modal
        isOpen={!!confirmDeleteNotice}
        onClose={() => setConfirmDeleteNotice(null)}
        title="Confirm Notice Deactivation"
        description="Deactivating this notice will remove it from the active feed while preserving historical audit records."
      >
        {confirmDeleteNotice && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold text-white">
                  Deactivate Notice #{confirmDeleteNotice.id}?
                </p>
                <p className="text-xs text-rose-300/90 mt-1">
                  Title: &quot;{confirmDeleteNotice.title}&quot;
                </p>
                <p className="text-xs text-rose-400/80 mt-1">
                  Students and faculty will no longer see this notice on their notice boards.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setConfirmDeleteNotice(null)}
                disabled={modalLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDelete}
                disabled={modalLoading}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                {modalLoading ? "Deactivating..." : "Yes, Deactivate Notice"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
