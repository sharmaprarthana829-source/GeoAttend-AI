"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  api,
  StudentDetail,
  Course,
  Branch,
  Batch,
  Section,
  StudentGroup,
} from "@/lib/api";
import {
  Users,
  Smartphone,
  RotateCcw,
  KeyRound,
  UserCheck,
  UserX,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Eye,
  Edit2,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Shield,
  AlertTriangle,
  BookOpen,
  X,
  Layers,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type SortField = "name" | "roll" | "section" | "status" | "attendance";
type SortOrder = "asc" | "desc";

export default function StudentsPage() {
  // Main Data States
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("all");
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Sorting & Pagination States
  const [sortField, setSortField] = useState<SortField>("roll");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Academic Dropdown Options (for Add / Edit forms)
  const [courses, setCourses] = useState<Course[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);

  // Selected Student for Modals
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);

  // Modal Visibility States
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBindDeviceModalOpen, setIsBindDeviceModalOpen] = useState(false);
  const [isResetDeviceModalOpen, setIsResetDeviceModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form Submissions Loading State
  const [submitting, setSubmitting] = useState(false);

  // Copy Feedback State
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);

  // Form State: Add Student
  const [newStudent, setNewStudent] = useState({
    full_name: "",
    email: "",
    roll_number: "",
    password: "Password@123",
    phone: "",
    enrollment_number: "",
    course_id: "",
    branch_id: "",
    batch_id: "",
    section_id: "",
    current_group_id: "",
    device_id: "",
  });

  // Form State: Edit Student
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    roll_number: "",
    enrollment_number: "",
    section_id: "",
    current_group_id: "",
    is_active: true,
  });

  // Form State: Device Bind / Reset / Password
  const [bindDeviceData, setBindDeviceData] = useState({
    device_id: "",
    platform: "Android",
    model: "",
  });
  const [unbindReason, setUnbindReason] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Load Students from Backend
  async function loadStudents(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params: {
        query?: string;
        section_id?: number;
        is_active?: boolean;
        has_device?: boolean;
      } = {};

      if (search.trim()) params.query = search.trim();
      if (selectedSectionFilter !== "all") params.section_id = Number(selectedSectionFilter);
      if (selectedDeviceFilter === "bound") params.has_device = true;
      else if (selectedDeviceFilter === "unbound") params.has_device = false;
      if (selectedStatusFilter === "active") params.is_active = true;
      else if (selectedStatusFilter === "deactivated") params.is_active = false;

      const data = await api.students.getStudents(params);
      setStudents(data);
      setActionError("");
    } catch (err: any) {
      setActionError(err.message || "Failed to load students from backend");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Load Academic Hierarchical Data for Dropdowns
  async function loadAcademicOptions() {
    try {
      const [crsList, allSecs] = await Promise.all([
        api.academic.getCourses().catch(() => []),
        api.academic.getSections().catch(() => []),
      ]);
      setCourses(crsList);
      setSections(allSecs);
    } catch (err) {
      console.error("Failed to preload academic options", err);
    }
  }

  useEffect(() => {
    loadAcademicOptions();
  }, []);

  useEffect(() => {
    loadStudents();
    setCurrentPage(1);
  }, [search, selectedSectionFilter, selectedDeviceFilter, selectedStatusFilter]);

  // Handle Cascading in Add Student Form
  async function handleCourseChange(courseId: string) {
    setNewStudent((prev) => ({
      ...prev,
      course_id: courseId,
      branch_id: "",
      batch_id: "",
      section_id: "",
      current_group_id: "",
    }));
    setBranches([]);
    setBatches([]);
    setGroups([]);
    if (courseId) {
      try {
        const brs = await api.academic.getBranches();
        setBranches(brs.filter((b) => b.course_id === Number(courseId)));
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function handleBranchChange(branchId: string) {
    setNewStudent((prev) => ({
      ...prev,
      branch_id: branchId,
      batch_id: "",
      section_id: "",
      current_group_id: "",
    }));
    setBatches([]);
    setGroups([]);
    if (branchId) {
      try {
        const bts = await api.academic.getBatches(Number(branchId));
        setBatches(bts);
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function handleBatchChange(batchId: string) {
    setNewStudent((prev) => ({
      ...prev,
      batch_id: batchId,
      section_id: "",
      current_group_id: "",
    }));
    setGroups([]);
    if (batchId) {
      try {
        const scs = await api.academic.getSections(Number(batchId));
        setSections(scs);
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function handleSectionChange(sectionId: string) {
    setNewStudent((prev) => ({
      ...prev,
      section_id: sectionId,
      current_group_id: "",
    }));
    setGroups([]);
    if (sectionId) {
      try {
        const gps = await api.academic.getStudentGroups(Number(sectionId));
        setGroups(gps);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Summary Metrics
  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.is_active).length;
    const bound = students.filter((s) => s.device_id).length;
    const unbound = total - bound;
    return { total, active, bound, unbound };
  }, [students]);

  // Sort and Paginate Students
  const sortedStudents = useMemo(() => {
    const list = [...students];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.full_name.localeCompare(b.full_name);
      } else if (sortField === "roll") {
        cmp = a.roll_number.localeCompare(b.roll_number);
      } else if (sortField === "section") {
        cmp = (a.section_name || "").localeCompare(b.section_name || "");
      } else if (sortField === "status") {
        cmp = Number(b.is_active) - Number(a.is_active);
      } else if (sortField === "attendance") {
        cmp = (a.attendance_count || 0) - (b.attendance_count || 0);
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  }, [students, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedStudents.slice(start, start + pageSize);
  }, [sortedStudents, currentPage, pageSize]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedUuid(text);
    setTimeout(() => setCopiedUuid(null), 2000);
  }

  // ── Actions ──

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError("");
    try {
      await api.students.createStudent({
        full_name: newStudent.full_name.trim(),
        email: newStudent.email.trim(),
        roll_number: newStudent.roll_number.trim(),
        password: newStudent.password,
        phone: newStudent.phone.trim() || undefined,
        enrollment_number: newStudent.enrollment_number.trim() || undefined,
        course_id: newStudent.course_id ? Number(newStudent.course_id) : undefined,
        branch_id: newStudent.branch_id ? Number(newStudent.branch_id) : undefined,
        batch_id: newStudent.batch_id ? Number(newStudent.batch_id) : undefined,
        section_id: newStudent.section_id ? Number(newStudent.section_id) : undefined,
        current_group_id: newStudent.current_group_id ? Number(newStudent.current_group_id) : undefined,
        device_id: newStudent.device_id.trim() || undefined,
      });

      setActionSuccess(`Student '${newStudent.full_name}' successfully created in database.`);
      setIsCreateModalOpen(false);
      setNewStudent({
        full_name: "",
        email: "",
        roll_number: "",
        password: "Password@123",
        phone: "",
        enrollment_number: "",
        course_id: "",
        branch_id: "",
        batch_id: "",
        section_id: "",
        current_group_id: "",
        device_id: "",
      });
      loadStudents();
    } catch (err: any) {
      setActionError(err.message || "Failed to create student");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(student: StudentDetail) {
    setSelectedStudent(student);
    setEditForm({
      full_name: student.full_name,
      phone: student.phone || "",
      roll_number: student.roll_number,
      enrollment_number: student.enrollment_number || "",
      section_id: student.section_id ? String(student.section_id) : "",
      current_group_id: student.current_group_id ? String(student.current_group_id) : "",
      is_active: student.is_active,
    });
    if (student.section_id) {
      api.academic.getStudentGroups(student.section_id).then(setGroups).catch(() => {});
    }
    setIsEditModalOpen(true);
  }

  async function handleUpdateStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    setSubmitting(true);
    setActionError("");
    try {
      await api.students.updateStudent(selectedStudent.id, {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        roll_number: editForm.roll_number.trim(),
        enrollment_number: editForm.enrollment_number.trim() || null,
        section_id: editForm.section_id ? Number(editForm.section_id) : null,
        current_group_id: editForm.current_group_id ? Number(editForm.current_group_id) : null,
        is_active: editForm.is_active,
      });

      setActionSuccess(`Student '${editForm.full_name}' updated successfully.`);
      setIsEditModalOpen(false);
      loadStudents();
    } catch (err: any) {
      setActionError(err.message || "Failed to update student");
    } finally {
      setSubmitting(false);
    }
  }

  function openBindDeviceModal(student: StudentDetail) {
    setSelectedStudent(student);
    setBindDeviceData({ device_id: "", platform: "Android", model: "" });
    setIsBindDeviceModalOpen(true);
  }

  async function handleBindDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !bindDeviceData.device_id.trim()) return;
    setSubmitting(true);
    setActionError("");
    try {
      await api.students.bindDevice(selectedStudent.id, {
        device_id: bindDeviceData.device_id.trim(),
        platform: bindDeviceData.platform,
        model: bindDeviceData.model.trim() || undefined,
      });
      setActionSuccess(`Device UUID bound successfully to ${selectedStudent.roll_number}.`);
      setIsBindDeviceModalOpen(false);
      loadStudents();
    } catch (err: any) {
      setActionError(err.message || "Failed to bind device");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetDevice() {
    if (!selectedStudent || !unbindReason.trim()) return;
    setSubmitting(true);
    setActionError("");
    try {
      await api.students.resetDevice(selectedStudent.id, unbindReason.trim());
      setActionSuccess(`Hardware device unbound successfully for ${selectedStudent.roll_number}.`);
      setIsResetDeviceModalOpen(false);
      setUnbindReason("");
      loadStudents();
    } catch (err: any) {
      setActionError(err.message || "Failed to unbind device");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || newPassword.length < 6) return;
    setSubmitting(true);
    setActionError("");
    try {
      await api.students.resetPassword(selectedStudent.id, newPassword);
      setActionSuccess(`Password reset successfully for ${selectedStudent.full_name}.`);
      setIsPasswordModalOpen(false);
      setNewPassword("");
    } catch (err: any) {
      setActionError(err.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(student: StudentDetail) {
    setActionError("");
    try {
      await api.students.toggleStatus(student.id);
      setActionSuccess(`Status toggled for ${student.full_name}.`);
      loadStudents();
    } catch (err: any) {
      setActionError(err.message || "Failed to toggle student account status");
    }
  }

  async function handleDeleteStudent(force: boolean = false) {
    if (!selectedStudent) return;
    setSubmitting(true);
    setActionError("");
    try {
      const res = await api.students.deleteStudent(selectedStudent.id, force);
      setActionSuccess(res.message || `Student ${selectedStudent.roll_number} deleted.`);
      setIsDeleteModalOpen(false);
      loadStudents();
    } catch (err: any) {
      setActionError(err.message || "Failed to delete student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Students & Hardware Devices
              </h1>
              <p className="text-xs text-slate-400 md:text-sm">
                Complete student records, academic grouping, and strict 1-to-1 hardware UUID enforcement.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadStudents(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition shadow-sm disabled:opacity-50"
            title="Refresh student list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition"
          >
            <Plus className="h-4 w-4" />
            Add Student
          </button>
        </div>
      </div>

      {/* ── Notification Banners ── */}
      {actionSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
          <p className="text-sm">{actionSuccess}</p>
          <button
            onClick={() => setActionSuccess("")}
            className="ml-auto text-xs underline text-emerald-400 hover:text-emerald-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
          <p className="text-sm">{actionError}</p>
          <button
            onClick={() => setActionError("")}
            className="ml-auto text-xs underline text-rose-400 hover:text-rose-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Top Metric Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Students</span>
            <GraduationCap className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats.total}</span>
            <span className="text-xs text-slate-500">enrolled</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Active Accounts</span>
            <UserCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{stats.active}</span>
            <span className="text-xs text-slate-500">
              {stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : "0%"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Devices Bound</span>
            <Smartphone className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats.bound}</span>
            <span className="text-xs text-emerald-400/80">1-to-1 secure</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Unbound Devices</span>
            <Laptop className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{stats.unbound}</span>
            <span className="text-xs text-slate-500">pending</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, roll no, email, or device UUID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition md:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Section Filter */}
          <select
            value={selectedSectionFilter}
            onChange={(e) => setSelectedSectionFilter(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Sections</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name} {sec.batch_name ? `(${sec.batch_name})` : ""}
              </option>
            ))}
          </select>

          {/* Device Filter */}
          <select
            value={selectedDeviceFilter}
            onChange={(e) => setSelectedDeviceFilter(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Devices</option>
            <option value="bound">Bound Only</option>
            <option value="unbound">Unbound Only</option>
          </select>

          {/* Account Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="deactivated">Disabled Only</option>
          </select>

          {(search || selectedSectionFilter !== "all" || selectedDeviceFilter !== "all" || selectedStatusFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedSectionFilter("all");
                setSelectedDeviceFilter("all");
                setSelectedStatusFilter("all");
              }}
              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-slate-300 hover:bg-slate-700 transition"
              title="Reset filters"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Students Data Table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th
                  onClick={() => handleSort("name")}
                  className="px-5 py-3.5 cursor-pointer hover:text-white select-none transition"
                >
                  <div className="flex items-center gap-1.5">
                    Student
                    {sortField === "name" ? (
                      sortOrder === "asc" ? <ArrowUp className="h-3 w-3 text-emerald-400" /> : <ArrowDown className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("roll")}
                  className="px-5 py-3.5 cursor-pointer hover:text-white select-none transition"
                >
                  <div className="flex items-center gap-1.5">
                    Roll No & Section
                    {sortField === "roll" ? (
                      sortOrder === "asc" ? <ArrowUp className="h-3 w-3 text-emerald-400" /> : <ArrowDown className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3.5">Academic Grouping</th>
                <th className="px-5 py-3.5">Hardware Device UUID</th>
                <th
                  onClick={() => handleSort("status")}
                  className="px-5 py-3.5 cursor-pointer hover:text-white select-none transition"
                >
                  <div className="flex items-center gap-1.5">
                    Account Status
                    {sortField === "status" ? (
                      sortOrder === "asc" ? <ArrowUp className="h-3 w-3 text-emerald-400" /> : <ArrowDown className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
                      <span>Loading real student records from backend...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-slate-600" />
                      <p className="font-medium text-slate-300">No student records found</p>
                      <p className="text-xs text-slate-500">
                        {search ? "No students matched your query or filters." : "Get started by adding your first student record."}
                      </p>
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Student
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition">
                    {/* Student Info */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 font-semibold text-emerald-400 text-xs">
                          {s.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{s.full_name}</div>
                          <div className="text-xs text-slate-400">{s.email}</div>
                          {s.phone && <div className="text-[11px] text-slate-500">{s.phone}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Roll / Section */}
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs font-bold text-emerald-400">
                        {s.roll_number}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        {s.section_name ? (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">
                            Sec: {s.section_name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">No Section</span>
                        )}
                        {s.current_group_name && (
                          <span className="ml-1 inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">
                            Grp: {s.current_group_name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Academic Affiliation */}
                    <td className="px-5 py-4">
                      <div className="text-xs text-slate-200 font-medium">
                        {s.course_name || "B.Tech"}
                        {s.branch_name ? ` • ${s.branch_name}` : ""}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {s.batch_name ? `Batch: ${s.batch_name}` : "Batch Unassigned"}
                      </div>
                      <div className="mt-1">
                        <span className="inline-flex items-center rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400 border border-slate-700/50">
                          {s.attendance_count ? `${s.attendance_count} records` : "0 attendance"}
                        </span>
                      </div>
                    </td>

                    {/* Hardware Device UUID */}
                    <td className="px-5 py-4">
                      {s.device_id ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[11px] text-emerald-400">
                              <Smartphone className="h-3 w-3" />
                              {s.device_id.slice(0, 16)}...
                            </span>
                            <button
                              onClick={() => copyToClipboard(s.device_id!)}
                              title="Copy full hardware UUID"
                              className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                              {copiedUuid === s.device_id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Shield className="h-2.5 w-2.5 text-emerald-500" />
                            Bound & Protected
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700/70 bg-slate-800/40 px-2 py-1 text-[11px] text-slate-400">
                            <Laptop className="h-3 w-3 text-slate-500" />
                            Unbound
                          </span>
                          <div>
                            <button
                              onClick={() => openBindDeviceModal(s)}
                              className="text-[11px] text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                            >
                              + Bind Device
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {s.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20">
                          Disabled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details */}
                        <button
                          onClick={() => {
                            setSelectedStudent(s);
                            setIsViewModalOpen(true);
                          }}
                          title="View Complete Student Details"
                          className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Edit Student */}
                        <button
                          onClick={() => openEditModal(s)}
                          title="Edit Student Profile"
                          className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Device Actions */}
                        {s.device_id ? (
                          <button
                            onClick={() => {
                              setSelectedStudent(s);
                              setIsResetDeviceModalOpen(true);
                            }}
                            title="Unbind/Reset Device"
                            className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-400 hover:bg-amber-500/20 transition"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openBindDeviceModal(s)}
                            title="Register / Bind Device"
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-400 hover:bg-emerald-500/20 transition"
                          >
                            <Smartphone className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Reset Password */}
                        <button
                          onClick={() => {
                            setSelectedStudent(s);
                            setIsPasswordModalOpen(true);
                          }}
                          title="Reset Password"
                          className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>

                        {/* Toggle Status */}
                        <button
                          onClick={() => handleToggleStatus(s)}
                          title={s.is_active ? "Deactivate Student" : "Activate Student"}
                          className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          {s.is_active ? (
                            <UserX className="h-3.5 w-3.5 text-rose-400" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                        </button>

                        {/* Delete Student */}
                        <button
                          onClick={() => {
                            setSelectedStudent(s);
                            setIsDeleteModalOpen(true);
                          }}
                          title="Delete / Deactivate Student"
                          className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Pagination ── */}
        {!loading && sortedStudents.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 bg-slate-950/40 px-5 py-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="ml-2 text-slate-500">
                Showing {Math.min((currentPage - 1) * pageSize + 1, sortedStudents.length)} -{" "}
                {Math.min(currentPage * pageSize, sortedStudents.length)} of {sortedStudents.length} students
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="px-2 text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── MODALS ── */}
      {/* ────────────────────────────────────────────────────────── */}

      {/* ── 1. VIEW STUDENT DETAILS MODAL ── */}
      {isViewModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold">
                  {selectedStudent.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedStudent.full_name}</h3>
                  <p className="text-xs text-slate-400">{selectedStudent.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs md:text-sm">
              {/* Profile & Identification */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                <div>
                  <span className="text-slate-500 text-xs">Roll Number</span>
                  <div className="font-mono font-semibold text-emerald-400">{selectedStudent.roll_number}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Enrollment Number</span>
                  <div className="text-slate-200">{selectedStudent.enrollment_number || "—"}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Phone Number</span>
                  <div className="text-slate-200">{selectedStudent.phone || "Not provided"}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Account Status</span>
                  <div>
                    {selectedStudent.is_active ? (
                      <span className="text-emerald-400 font-medium">Active</span>
                    ) : (
                      <span className="text-rose-400 font-medium">Deactivated</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Affiliation */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-2">
                <div className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                  Academic Affiliation
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-500 text-xs">Course:</span>{" "}
                    <span className="text-slate-200 font-medium">{selectedStudent.course_name || "B.Tech"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Department:</span>{" "}
                    <span className="text-slate-200">{selectedStudent.department_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Branch:</span>{" "}
                    <span className="text-slate-200">{selectedStudent.branch_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Batch:</span>{" "}
                    <span className="text-slate-200">{selectedStudent.batch_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Section:</span>{" "}
                    <span className="text-emerald-400 font-medium">{selectedStudent.section_name || "Unassigned"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Student Group:</span>{" "}
                    <span className="text-slate-200">{selectedStudent.current_group_name || "None"}</span>
                  </div>
                </div>
              </div>

              {/* Hardware Device Binding Security */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-2">
                <div className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Hardware Device Binding (1-to-1 Security Model)
                </div>
                {selectedStudent.device_id ? (
                  <div className="pt-1 space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-slate-900 p-2.5 border border-slate-800">
                      <div className="font-mono text-xs text-emerald-400 break-all">
                        {selectedStudent.device_id}
                      </div>
                      <button
                        onClick={() => copyToClipboard(selectedStudent.device_id!)}
                        className="ml-2 flex-shrink-0 text-slate-400 hover:text-white"
                        title="Copy UUID"
                      >
                        {copiedUuid === selectedStudent.device_id ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {selectedStudent.device_registered_at && (
                      <p className="text-[11px] text-slate-500">
                        Bound on: {new Date(selectedStudent.device_registered_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="pt-1 text-slate-400 text-xs">
                    No hardware device is currently bound to this student profile. Student will be prompted on first mobile app check-in or can be bound administratively.
                  </div>
                )}
              </div>

              {/* Attendance Protection Summary */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-xs">Historical Attendance Records</span>
                  <div className="text-base font-bold text-white">
                    {selectedStudent.attendance_count || 0} session(s) recorded
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                    Protected by Policy
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. ADD STUDENT MODAL ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateStudent}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                Register New Student
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Create a real student profile, user account, and initial academic structure enrollment in MySQL.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Full Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={newStudent.full_name}
                  onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Roll Number *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. 21CSD001"
                  value={newStudent.roll_number}
                  onChange={(e) => setNewStudent({ ...newStudent, roll_number: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">College Email *</label>
                <input
                  required
                  type="email"
                  placeholder="e.g. aarav@college.edu"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Initial Password *</label>
                <input
                  required
                  type="password"
                  placeholder="Min 6 characters"
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Enrollment / Univ No.</label>
                <input
                  type="text"
                  placeholder="Optional university ID"
                  value={newStudent.enrollment_number}
                  onChange={(e) => setNewStudent({ ...newStudent, enrollment_number: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Academic Structure Hierarchy Selectors */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-emerald-400" />
                Academic Structure Assignment (Live Backend APIs)
              </span>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Course</label>
                  <select
                    value={newStudent.course_id}
                    onChange={(e) => handleCourseChange(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Branch</label>
                  <select
                    value={newStudent.branch_id}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    disabled={!newStudent.course_id}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-40"
                  >
                    <option value="">Select Branch...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Batch</label>
                  <select
                    value={newStudent.batch_id}
                    onChange={(e) => handleBatchChange(e.target.value)}
                    disabled={!newStudent.branch_id}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-40"
                  >
                    <option value="">Select Batch...</option>
                    {batches.map((bt) => (
                      <option key={bt.id} value={bt.id}>
                        {bt.name} ({bt.start_year}-{bt.end_year})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Section</label>
                  <select
                    value={newStudent.section_id}
                    onChange={(e) => handleSectionChange(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Section...</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name} {sec.batch_name ? `(${sec.batch_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-400">Student Group (Optional)</label>
                  <select
                    value={newStudent.current_group_id}
                    onChange={(e) => setNewStudent({ ...newStudent, current_group_id: e.target.value })}
                    disabled={!newStudent.section_id}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-40"
                  >
                    <option value="">Select Student Group (e.g. B1, B2)...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Optional Hardware Device Binding */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                Initial Hardware Device UUID (Optional)
              </label>
              <input
                type="text"
                placeholder="Hardware identifier (e.g. a4f8c2e1-901b-43d2-bb56-91e0a29ef812)"
                value={newStudent.device_id}
                onChange={(e) => setNewStudent({ ...newStudent, device_id: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs font-mono text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">
                1-to-1 strict policy: Must be unique across all students. If omitted, device can be bound on first student login.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
              >
                {submitting ? "Creating Student..." : "Create Student Record"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 3. EDIT STUDENT MODAL ── */}
      {isEditModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleUpdateStudent}
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-emerald-400" />
                Edit Student Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Full Name</label>
                <input
                  required
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Roll Number</label>
                  <input
                    required
                    type="text"
                    value={editForm.roll_number}
                    onChange={(e) => setEditForm({ ...editForm, roll_number: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Enrollment Number</label>
                <input
                  type="text"
                  value={editForm.enrollment_number}
                  onChange={(e) => setEditForm({ ...editForm, enrollment_number: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Section</label>
                  <select
                    value={editForm.section_id}
                    onChange={(e) => {
                      setEditForm({ ...editForm, section_id: e.target.value, current_group_id: "" });
                      if (e.target.value) {
                        api.academic.getStudentGroups(Number(e.target.value)).then(setGroups).catch(() => {});
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">No Section</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name} {sec.batch_name ? `(${sec.batch_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Group</label>
                  <select
                    value={editForm.current_group_id}
                    onChange={(e) => setEditForm({ ...editForm, current_group_id: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">No Group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-300">Account Active Status</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 4. BIND DEVICE MODAL ── */}
      {isBindDeviceModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleBindDevice}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-400" />
                Bind Hardware Device
              </h3>
              <button
                type="button"
                onClick={() => setIsBindDeviceModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Bind a physical mobile device UUID to{" "}
              <strong className="text-white">{selectedStudent.full_name} ({selectedStudent.roll_number})</strong>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Hardware Device UUID *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Min 6 characters (e.g. 550e8400-e29b-41d4-a716-446655440000)"
                  value={bindDeviceData.device_id}
                  onChange={(e) => setBindDeviceData({ ...bindDeviceData, device_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Platform</label>
                  <select
                    value={bindDeviceData.platform}
                    onChange={(e) => setBindDeviceData({ ...bindDeviceData, platform: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Android">Android</option>
                    <option value="iOS">iOS</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Device Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Pixel 8, iPhone 15"
                    value={bindDeviceData.model}
                    onChange={(e) => setBindDeviceData({ ...bindDeviceData, model: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-[11px] text-emerald-300">
              <Shield className="inline h-3 w-3 mr-1" />
              <strong>1-to-1 Enforcement:</strong> The backend verifies that this device identifier is not bound to any other student profile.
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBindDeviceModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || bindDeviceData.device_id.trim().length < 6}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
              >
                {submitting ? "Binding..." : "Confirm Device Binding"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 5. RESET / UNBIND DEVICE MODAL ── */}
      {isResetDeviceModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-400" />
              Unbind Student Hardware Device
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              This will detach the hardware UUID from{" "}
              <strong className="text-white">{selectedStudent.full_name} ({selectedStudent.roll_number})</strong>.
              The student will be allowed to bind a new mobile phone on next check-in.
            </p>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-xs text-amber-400/90 break-all">
              {selectedStudent.device_id}
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold uppercase text-slate-400">
                Administrative Reason (Required for Audit Log) *
              </label>
              <textarea
                value={unbindReason}
                onChange={(e) => setUnbindReason(e.target.value)}
                placeholder="e.g. Student replaced damaged smartphone; Verified college ID"
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsResetDeviceModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDevice}
                disabled={submitting || !unbindReason.trim()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-500 disabled:opacity-50"
              >
                {submitting ? "Unbinding..." : "Confirm Device Unbind"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. RESET PASSWORD MODAL ── */}
      {isPasswordModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleResetPassword}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-400" />
              Reset Student Password
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              Set a new administrative password for <strong className="text-white">{selectedStudent.full_name}</strong>.
            </p>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase text-slate-400">
                New Password (min. 6 characters) *
              </label>
              <input
                required
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new secure password"
                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || newPassword.length < 6}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save New Password"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 7. DELETE / DEACTIVATE CONFIRMATION MODAL ── */}
      {isDeleteModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-400" />
              Delete Student Profile
            </h3>

            <p className="mt-2 text-xs text-slate-300">
              Student: <strong className="text-white">{selectedStudent.full_name}</strong> (Roll:{" "}
              <span className="font-mono text-emerald-400">{selectedStudent.roll_number}</span>)
            </p>

            {/* Attendance Protection Warning */}
            {selectedStudent.attendance_count && selectedStudent.attendance_count > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Historical Attendance Data Protection
                </div>
                <p>
                  This student has <strong>{selectedStudent.attendance_count}</strong> recorded attendance session(s).
                  To preserve institutional compliance and audit integrity, permanent deletion is prevented.
                </p>
                <p className="text-[11px] text-amber-200/80">
                  Please deactivate the student account instead. Deactivated students cannot mark attendance or log in, but historical session metrics remain intact.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <p>
                  This student has 0 historical attendance records. Permanent deletion will safely remove their student profile, enrollments, and login account. This action cannot be undone.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              {selectedStudent.attendance_count && selectedStudent.attendance_count > 0 ? (
                <>
                  <button
                    onClick={() => {
                      handleToggleStatus(selectedStudent);
                      setIsDeleteModalOpen(false);
                    }}
                    className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                  >
                    {selectedStudent.is_active ? "Deactivate Account (Recommended)" : "Keep Deactivated"}
                  </button>
                  <button
                    onClick={() => handleDeleteStudent(true)}
                    disabled={submitting}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-500/20 hover:bg-rose-500 disabled:opacity-50"
                  >
                    {submitting ? "Deleting..." : "Force Delete (All Records)"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleDeleteStudent(false)}
                  disabled={submitting}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-500/20 hover:bg-rose-500 disabled:opacity-50"
                >
                  {submitting ? "Deleting..." : "Permanently Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
