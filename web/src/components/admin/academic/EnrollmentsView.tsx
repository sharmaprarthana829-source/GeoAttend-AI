"use client";

import React, { useState, useMemo } from "react";
import {
  AcademicEnrollment,
  Section,
  StudentGroup,
  Batch,
  Branch,
  Course,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Search,
  UserCheck,
  GraduationCap,
  Sparkles,
} from "lucide-react";

interface EnrollmentsViewProps {
  enrollments: AcademicEnrollment[];
  parentSection: Section;
  parentGroup?: StudentGroup | null;
  parentBatch: Batch;
  parentBranch: Branch;
  parentCourse: Course;
  loading: boolean;
  onAddEnrollment: () => void;
  onEditEnrollment?: (enrollment: AcademicEnrollment) => void;
  onDeleteEnrollment: (enrollment: AcademicEnrollment) => void;
}

export function EnrollmentsView({
  enrollments,
  parentSection,
  parentGroup,
  parentBatch,
  parentBranch,
  parentCourse,
  loading,
  onAddEnrollment,
  onEditEnrollment,
  onDeleteEnrollment,
}: EnrollmentsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    return enrollments.filter((e) => {
      const sName = (e.student_name || "").toLowerCase();
      const sRoll = (e.student_roll_number || "").toLowerCase();
      const sEmail = (e.student_email || "").toLowerCase();
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        sName.includes(q) || sRoll.includes(q) || sEmail.includes(q);

      const matchesStatus =
        statusFilter === "all" ? true : e.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [enrollments, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/20 text-emerald-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              Student Enrollments
              {parentGroup ? (
                <span className="text-xs font-mono font-medium bg-pink-950/70 border border-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full">
                  Group {parentGroup.name}
                </span>
              ) : (
                <span className="text-xs font-mono font-medium bg-cyan-950/70 border border-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">
                  {parentSection.name}
                </span>
              )}
              <span className="text-xs font-mono font-normal bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                {filtered.length} {filtered.length === 1 ? "student" : "students"}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {parentCourse.name} • {parentBranch.code} • {parentBatch.name} • {parentSection.name}
              {parentGroup && ` • Group ${parentGroup.name}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onAddEnrollment}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Enroll Student
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-900/40 p-3 rounded-xl border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search by student name, roll no, email..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="dropped">Dropped</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-surface-900/70">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 font-semibold">Student Information</th>
              <th className="py-3 px-4 font-semibold">Roll Number</th>
              <th className="py-3 px-4 font-semibold">Group / Section</th>
              <th className="py-3 px-4 font-semibold">Semester / Year</th>
              <th className="py-3 px-4 font-semibold">Enrollment Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginated.length > 0 ? (
              paginated.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-emerald-400 text-xs">
                        {e.student_name ? e.student_name.charAt(0).toUpperCase() : "S"}
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {e.student_name || `Student #${e.student_id}`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {e.student_email || "No email on record"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-xs text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                      {e.student_roll_number || `ID: ${e.student_id}`}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/20 text-cyan-300 font-medium text-[11px]">
                        {e.section_name || parentSection.name}
                      </span>
                      {e.student_group_name ? (
                        <span className="px-2 py-0.5 rounded bg-pink-950/60 border border-pink-500/20 text-pink-300 font-medium text-[11px]">
                          Group {e.student_group_name}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">
                          No group assigned
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-slate-200 font-medium">
                      Sem {e.semester}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {e.academic_year}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      {e.status.toLowerCase() === "active" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      ) : e.status.toLowerCase() === "dropped" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-950/80 text-red-400 border border-red-500/20">
                          Dropped
                        </span>
                      ) : e.status.toLowerCase() === "completed" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-950/80 text-blue-400 border border-blue-500/20">
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          {e.status}
                        </span>
                      )}

                      {e.is_current && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <Sparkles className="h-2.5 w-2.5" />
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {onEditEnrollment && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditEnrollment(e)}
                          className="text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 h-7 w-7 p-0"
                          title="Edit Enrollment"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteEnrollment(e)}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/50 h-7 w-7 p-0"
                        title="Delete / Drop Enrollment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Users className="h-8 w-8 text-slate-600 mb-1" />
                    <p className="text-sm font-medium text-slate-300">
                      {searchTerm ? "No matching enrollments found" : "No students enrolled in this group/section"}
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {searchTerm
                        ? "Try clearing your search query or changing filters."
                        : "Enroll active students from the student pool into this academic branch, batch, and section."}
                    </p>
                    {!searchTerm && (
                      <Button
                        onClick={onAddEnrollment}
                        size="sm"
                        className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
                      >
                        <Plus className="h-3 w-3" />
                        Enroll First Student
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-2">
          <span>
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, filtered.length)} of {filtered.length} students
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-xs h-7 px-2.5"
            >
              Previous
            </Button>
            <span className="px-2 font-mono">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="text-xs h-7 px-2.5"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
