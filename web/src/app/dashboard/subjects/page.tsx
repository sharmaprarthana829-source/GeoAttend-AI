"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  api,
  SubjectMaster,
  SubjectOffering,
  FacultyAssignment,
  Branch,
  Department,
  FacultyDetail,
} from "@/lib/api";
import {
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  listOfferings,
  createOffering,
  updateOffering,
  deleteOffering,
  listAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from "@/lib/subjects";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import DeleteConfirm from "@/components/admin/students/DeleteConfirm";
import AddEditSubjectModal from "@/components/admin/subjects/AddEditSubjectModal";
import ViewSubjectModal from "@/components/admin/subjects/ViewSubjectModal";
import AddEditOfferingModal from "@/components/admin/subjects/AddEditOfferingModal";
import ViewOfferingModal from "@/components/admin/subjects/ViewOfferingModal";
import AddEditAssignmentModal from "@/components/admin/subjects/AddEditAssignmentModal";
import ViewAssignmentModal from "@/components/admin/subjects/ViewAssignmentModal";
import {
  BookOpen,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Layers,
  GraduationCap,
  Users,
} from "lucide-react";

type SubjectTab = "master" | "offerings" | "assignments";

export default function SubjectsPage() {
  const { user } = useDashboard();
  const [activeTab, setActiveTab] = useState<SubjectTab>("master");
  const [loading, setLoading] = useState(true);

  // Entities
  const [subjects, setSubjects] = useState<SubjectMaster[]>([]);
  const [offerings, setOfferings] = useState<SubjectOffering[]>([]);
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyDetail[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [departmentFilter, setDepartmentFilter] = useState<number | "">("");
  const [branchFilter, setBranchFilter] = useState<number | "">("");
  const [semesterFilter, setSemesterFilter] = useState<number | "">("");
  const [classTypeFilter, setClassTypeFilter] = useState<string>("all");
  const [facultyFilter, setFacultyFilter] = useState<number | "">("");

  // Modals state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editSubject, setEditSubject] = useState<SubjectMaster | null>(null);
  const [viewSubject, setViewSubject] = useState<SubjectMaster | null>(null);
  const [deleteSubjectItem, setDeleteSubjectItem] = useState<SubjectMaster | null>(null);

  const [showAddOffering, setShowAddOffering] = useState(false);
  const [editOffering, setEditOffering] = useState<SubjectOffering | null>(null);
  const [viewOffering, setViewOffering] = useState<SubjectOffering | null>(null);
  const [deleteOfferingItem, setDeleteOfferingItem] = useState<SubjectOffering | null>(null);

  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [editAssignment, setEditAssignment] = useState<FacultyAssignment | null>(null);
  const [viewAssignment, setViewAssignment] = useState<FacultyAssignment | null>(null);
  const [deleteAssignmentItem, setDeleteAssignmentItem] = useState<FacultyAssignment | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [subsRes, offsRes, asgnsRes, brs, depts, facs] = await Promise.all([
        listSubjects({ per_page: 500 }),
        listOfferings({ per_page: 500 }),
        listAssignments({ per_page: 500 }),
        api.academic.getBranches().catch(() => []),
        api.academic.getDepartments().catch(() => []),
        api.faculty.getProfiles().catch(() => []),
      ]);
      setSubjects(subsRes.data);
      setOfferings(offsRes.data);
      setAssignments(asgnsRes.data);
      setBranches(brs);
      setDepartments(depts);
      setFacultyList(facs);
    } catch (err) {
      console.error("Error loading subjects module data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Filtered Master Subjects
  const filteredSubjects = useMemo(() => {
    let list = subjects;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.description || "").toLowerCase().includes(q)
      );
    }
    if (departmentFilter !== "") {
      list = list.filter((s) => s.department_id === Number(departmentFilter));
    }
    if (statusFilter !== "all") {
      const shouldBeActive = statusFilter === "active";
      list = list.filter((s) => s.is_active === shouldBeActive);
    }
    return list;
  }, [subjects, searchQuery, departmentFilter, statusFilter]);

  // Filtered Subject Offerings
  const filteredOfferings = useMemo(() => {
    let list = offerings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          (o.subject_name || "").toLowerCase().includes(q) ||
          (o.subject_code || "").toLowerCase().includes(q) ||
          (o.branch_name || "").toLowerCase().includes(q) ||
          (o.course_name || "").toLowerCase().includes(q) ||
          (o.section_name || "").toLowerCase().includes(q)
      );
    }
    if (branchFilter !== "") {
      list = list.filter((o) => o.branch_id === Number(branchFilter));
    }
    if (semesterFilter !== "") {
      list = list.filter((o) => o.semester === Number(semesterFilter));
    }
    if (classTypeFilter !== "all") {
      list = list.filter((o) => o.class_type.toLowerCase() === classTypeFilter.toLowerCase());
    }
    if (statusFilter !== "all") {
      const shouldBeActive = statusFilter === "active";
      list = list.filter((o) => o.is_active === shouldBeActive);
    }
    return list;
  }, [offerings, searchQuery, branchFilter, semesterFilter, classTypeFilter, statusFilter]);

  // Filtered Faculty Assignments
  const filteredAssignments = useMemo(() => {
    let list = assignments;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          (a.faculty_name || "").toLowerCase().includes(q) ||
          (a.faculty_employee_id || "").toLowerCase().includes(q) ||
          (a.subject_name || "").toLowerCase().includes(q) ||
          (a.subject_code || "").toLowerCase().includes(q) ||
          (a.branch_name || "").toLowerCase().includes(q)
      );
    }
    if (facultyFilter !== "") {
      list = list.filter((a) => a.faculty_id === Number(facultyFilter));
    }
    if (classTypeFilter !== "all") {
      list = list.filter((a) => (a.class_type || "").toLowerCase() === classTypeFilter.toLowerCase());
    }
    if (statusFilter !== "all") {
      const shouldBeActive = statusFilter === "active";
      list = list.filter((a) => a.is_active === shouldBeActive);
    }
    return list;
  }, [assignments, searchQuery, facultyFilter, classTypeFilter, statusFilter]);

  // Handlers for Master Subjects
  async function handleCreateSubject(data: any) {
    await createSubject(data);
    await loadAllData();
  }

  async function handleUpdateSubject(data: any) {
    if (!editSubject) return;
    await updateSubject(editSubject.id, data);
    setEditSubject(null);
    await loadAllData();
  }

  async function handleDeleteSubject() {
    if (!deleteSubjectItem) return;
    await deleteSubject(deleteSubjectItem.id);
    setDeleteSubjectItem(null);
    await loadAllData();
  }

  // Handlers for Subject Offerings
  async function handleCreateOffering(data: any) {
    await createOffering(data);
    await loadAllData();
  }

  async function handleUpdateOffering(data: any) {
    if (!editOffering) return;
    await updateOffering(editOffering.id, data);
    setEditOffering(null);
    await loadAllData();
  }

  async function handleDeleteOffering() {
    if (!deleteOfferingItem) return;
    await deleteOffering(deleteOfferingItem.id);
    setDeleteOfferingItem(null);
    await loadAllData();
  }

  // Handlers for Faculty Assignments
  async function handleCreateAssignment(data: any) {
    await createAssignment(data);
    await loadAllData();
  }

  async function handleUpdateAssignment(data: any) {
    if (!editAssignment) return;
    await updateAssignment(editAssignment.id, data);
    setEditAssignment(null);
    await loadAllData();
  }

  async function handleDeleteAssignment() {
    if (!deleteAssignmentItem) return;
    await deleteAssignment(deleteAssignmentItem.id);
    setDeleteAssignmentItem(null);
    await loadAllData();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1">Dashboard / Subjects</nav>
          <h1 className="text-2xl font-bold text-white">Subjects & Faculty Assignments</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage academic course subjects, offerings, and teacher assignments.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={loadAllData}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            onClick={() => {
              if (activeTab === "master") setShowAddSubject(true);
              else if (activeTab === "offerings") setShowAddOffering(true);
              else setShowAddAssignment(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            Add {activeTab === "master" ? "Subject" : activeTab === "offerings" ? "Offering" : "Assignment"}
          </Button>
        </div>
      </div>

      {/* 3 Tabs Bar */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => {
            setActiveTab("master");
            setSearchQuery("");
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "master"
              ? "border-emerald-500 text-emerald-400 bg-surface-900/90"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Master Subjects
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-800 text-slate-300">
            {subjects.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("offerings");
            setSearchQuery("");
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "offerings"
              ? "border-emerald-500 text-emerald-400 bg-surface-900/90"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="h-4 w-4" />
          Subject Offerings
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-800 text-slate-300">
            {offerings.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("assignments");
            setSearchQuery("");
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "assignments"
              ? "border-emerald-500 text-emerald-400 bg-surface-900/90"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Faculty Assignments
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-800 text-slate-300">
            {assignments.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      <Card className="p-4 sm:p-6 bg-surface-900/80 border-slate-800">
        {/* Search & Filters Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "master"
                    ? "Search subjects by name, code..."
                    : activeTab === "offerings"
                    ? "Search offerings by subject, branch, section..."
                    : "Search assignments by faculty, subject, code..."
                }
                className="pl-3"
              />
            </div>
            {searchQuery && (
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                Clear
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Tab specific dropdown filters */}
            {activeTab === "master" && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value ? Number(e.target.value) : "")}
                className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}

            {activeTab === "offerings" && (
              <>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value ? Number(e.target.value) : "")}
                  className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>

                <select
                  value={semesterFilter}
                  onChange={(e) => setSemesterFilter(e.target.value ? Number(e.target.value) : "")}
                  className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>

                <select
                  value={classTypeFilter}
                  onChange={(e) => setClassTypeFilter(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none uppercase font-semibold"
                >
                  <option value="all">All Types</option>
                  <option value="theory">THEORY</option>
                  <option value="lab">LAB</option>
                </select>
              </>
            )}

            {activeTab === "assignments" && (
              <>
                <select
                  value={facultyFilter}
                  onChange={(e) => setFacultyFilter(e.target.value ? Number(e.target.value) : "")}
                  className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">All Faculty Members</option>
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.full_name} ({f.employee_id})
                    </option>
                  ))}
                </select>

                <select
                  value={classTypeFilter}
                  onChange={(e) => setClassTypeFilter(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none uppercase font-semibold"
                >
                  <option value="all">All Class Types</option>
                  <option value="theory">THEORY</option>
                  <option value="lab">LAB</option>
                </select>
              </>
            )}

            {/* Global Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-slate-800 bg-surface-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* ─── TAB 1: MASTER SUBJECTS TABLE ─── */}
        {activeTab === "master" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-800/80 sticky top-0 bg-surface-900/90 backdrop-blur-md">
                  <th className="py-3 pr-4 font-semibold">Subject & Code</th>
                  <th className="py-3 pr-4 font-semibold">Department</th>
                  <th className="py-3 pr-4 font-semibold">Credits</th>
                  <th className="py-3 pr-4 font-semibold">Active Offerings</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y divide-slate-800/60", loading && "opacity-60")}>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-8">
                      <div className="h-2 w-full bg-slate-800/40 rounded animate-pulse" />
                    </td>
                  </tr>
                )}

                {!loading && filteredSubjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No master subjects found. Click <strong>+ Add Subject</strong> to register one.
                    </td>
                  </tr>
                )}

                {filteredSubjects.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{s.name}</span>
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">
                          {s.code}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-300">
                      {s.department_name || "General"}
                    </td>
                    <td className="py-3 pr-4 text-xs font-semibold text-slate-200">
                      {s.credits} Credits
                    </td>
                    <td className="py-3 pr-4 text-xs font-mono">
                      <span className="px-2 py-0.5 rounded bg-surface-950 text-slate-300 border border-slate-800">
                        {s.offerings_count ?? 0} active
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1",
                          s.is_active
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.is_active ? "bg-emerald-400" : "bg-rose-400")} />
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setViewSubject(s)}>
                          View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditSubject(s)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteSubjectItem(s)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── TAB 2: SUBJECT OFFERINGS TABLE ─── */}
        {activeTab === "offerings" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-800/80 sticky top-0 bg-surface-900/90 backdrop-blur-md">
                  <th className="py-3 pr-4 font-semibold">Subject & Code</th>
                  <th className="py-3 pr-4 font-semibold">Course & Branch</th>
                  <th className="py-3 pr-4 font-semibold">Semester & Section</th>
                  <th className="py-3 pr-4 font-semibold">Assigned Faculty</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y divide-slate-800/60", loading && "opacity-60")}>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-8">
                      <div className="h-2 w-full bg-slate-800/40 rounded animate-pulse" />
                    </td>
                  </tr>
                )}

                {!loading && filteredOfferings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No subject offerings found. Click <strong>+ Add Offering</strong> to create one.
                    </td>
                  </tr>
                )}

                {filteredOfferings.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{o.subject_name || "Unknown Subject"}</span>
                        <span className="font-mono text-xs text-emerald-400 px-1.5 py-0.5 rounded bg-surface-950 border border-slate-800">
                          {o.subject_code || "—"}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold",
                            o.class_type === "lab"
                              ? "bg-amber-950/70 text-amber-300 border border-amber-500/30"
                              : "bg-surface-800 text-slate-300 border border-slate-700"
                          )}
                        >
                          {o.class_type}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <p className="text-slate-200 font-medium">{o.branch_name || "—"}</p>
                      <p className="text-slate-400">{o.course_name || "—"}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <span className="text-slate-200 font-medium">Sem {o.semester} · Sec {o.section_name || "—"}</span>
                      {o.student_group_name && (
                        <span className="text-emerald-400 ml-1 font-mono">(Grp {o.student_group_name})</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {o.assigned_faculty_names && o.assigned_faculty_names.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {o.assigned_faculty_names.map((name, i) => (
                            <span key={i} className="text-emerald-300 font-medium bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1",
                          o.is_active
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", o.is_active ? "bg-emerald-400" : "bg-rose-400")} />
                        {o.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setViewOffering(o)}>
                          View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditOffering(o)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteOfferingItem(o)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── TAB 3: FACULTY ASSIGNMENTS TABLE ─── */}
        {activeTab === "assignments" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-800/80 sticky top-0 bg-surface-900/90 backdrop-blur-md">
                  <th className="py-3 pr-4 font-semibold">Faculty Member</th>
                  <th className="py-3 pr-4 font-semibold">Subject & Code</th>
                  <th className="py-3 pr-4 font-semibold">Class & Section</th>
                  <th className="py-3 pr-4 font-semibold">Role</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y divide-slate-800/60", loading && "opacity-60")}>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-8">
                      <div className="h-2 w-full bg-slate-800/40 rounded animate-pulse" />
                    </td>
                  </tr>
                )}

                {!loading && filteredAssignments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No faculty assignments found. Click <strong>+ Add Assignment</strong> to connect teachers to offerings.
                    </td>
                  </tr>
                )}

                {filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">
                          {a.faculty_name ? a.faculty_name.trim()[0]?.toUpperCase() : "F"}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{a.faculty_name || "Faculty"}</p>
                          <p className="text-[11px] text-slate-400">
                            {a.faculty_employee_id ? `${a.faculty_employee_id} · ` : ""}{a.faculty_designation || "Faculty Member"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-200">{a.subject_name || "—"}</span>
                        <span className="px-1.5 py-0.5 rounded font-mono text-[11px] bg-surface-950 border border-slate-800 text-slate-300">
                          {a.subject_code || "—"}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-surface-800 text-slate-400">
                          {a.class_type || "THEORY"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <p className="text-slate-200">{a.branch_name || "—"}</p>
                      <p className="text-slate-400">
                        Sem {a.semester || "—"} · Sec {a.section_name || "—"}
                        {a.student_group_name && <span className="text-emerald-400 ml-1 font-mono">(Grp {a.student_group_name})</span>}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-semibold",
                          a.is_primary
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            : "bg-surface-800 text-slate-300 border border-slate-700"
                        )}
                      >
                        {a.is_primary ? "Primary Faculty" : "Assistant Faculty"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1",
                          a.is_active
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", a.is_active ? "bg-emerald-400" : "bg-rose-400")} />
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setViewAssignment(a)}>
                          View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditAssignment(a)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteAssignmentItem(a)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer counts */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing{" "}
            <strong className="text-slate-200">
              {activeTab === "master"
                ? filteredSubjects.length
                : activeTab === "offerings"
                ? filteredOfferings.length
                : filteredAssignments.length}
            </strong>{" "}
            of{" "}
            <strong className="text-slate-200">
              {activeTab === "master"
                ? subjects.length
                : activeTab === "offerings"
                ? offerings.length
                : assignments.length}
            </strong>{" "}
            records from verified database
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live Database Connected
          </div>
        </div>
      </Card>

      {/* ─── MODALS ─── */}
      {/* 1. Master Subject Modals */}
      <AddEditSubjectModal
        isOpen={showAddSubject}
        onClose={() => setShowAddSubject(false)}
        onSave={handleCreateSubject}
      />
      <AddEditSubjectModal
        isOpen={!!editSubject}
        onClose={() => setEditSubject(null)}
        onSave={handleUpdateSubject}
        initial={editSubject}
      />
      <ViewSubjectModal
        isOpen={!!viewSubject}
        onClose={() => setViewSubject(null)}
        subject={viewSubject}
        onEdit={() => setEditSubject(viewSubject)}
      />
      <DeleteConfirm
        isOpen={!!deleteSubjectItem}
        onClose={() => setDeleteSubjectItem(null)}
        onConfirm={handleDeleteSubject}
        name={deleteSubjectItem?.name}
        title="Delete / Deactivate Master Subject"
      />

      {/* 2. Subject Offering Modals */}
      <AddEditOfferingModal
        isOpen={showAddOffering}
        onClose={() => setShowAddOffering(false)}
        onSave={handleCreateOffering}
      />
      <AddEditOfferingModal
        isOpen={!!editOffering}
        onClose={() => setEditOffering(null)}
        onSave={handleUpdateOffering}
        initial={editOffering}
      />
      <ViewOfferingModal
        isOpen={!!viewOffering}
        onClose={() => setViewOffering(null)}
        offering={viewOffering}
        onEdit={() => setEditOffering(viewOffering)}
      />
      <DeleteConfirm
        isOpen={!!deleteOfferingItem}
        onClose={() => setDeleteOfferingItem(null)}
        onConfirm={handleDeleteOffering}
        name={
          deleteOfferingItem
            ? `${deleteOfferingItem.subject_name} (${deleteOfferingItem.class_type.toUpperCase()}) - Sem ${deleteOfferingItem.semester}`
            : undefined
        }
        title="Delete / Deactivate Subject Offering"
      />

      {/* 3. Faculty Assignment Modals */}
      <AddEditAssignmentModal
        isOpen={showAddAssignment}
        onClose={() => setShowAddAssignment(false)}
        onSave={handleCreateAssignment}
      />
      <AddEditAssignmentModal
        isOpen={!!editAssignment}
        onClose={() => setEditAssignment(null)}
        onSave={handleUpdateAssignment}
        initial={editAssignment}
      />
      <ViewAssignmentModal
        isOpen={!!viewAssignment}
        onClose={() => setViewAssignment(null)}
        assignment={viewAssignment}
        onEdit={() => setEditAssignment(viewAssignment)}
      />
      <DeleteConfirm
        isOpen={!!deleteAssignmentItem}
        onClose={() => setDeleteAssignmentItem(null)}
        onConfirm={handleDeleteAssignment}
        name={
          deleteAssignmentItem
            ? `${deleteAssignmentItem.faculty_name} -> ${deleteAssignmentItem.subject_name}`
            : undefined
        }
        title="Remove Faculty Assignment"
      />
    </div>
  );
}
