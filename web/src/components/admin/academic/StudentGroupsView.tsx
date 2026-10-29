"use client";

import React, { useState, useMemo } from "react";
import { StudentGroup, Section, Batch, Branch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  Search,
  Users,
} from "lucide-react";

interface StudentGroupsViewProps {
  groups: StudentGroup[];
  parentSection: Section;
  parentBatch: Batch;
  parentBranch: Branch;
  loading: boolean;
  onOpenEnrollments: (group: StudentGroup) => void;
  onAddGroup: () => void;
  onEditGroup: (group: StudentGroup) => void;
  onDeleteGroup: (group: StudentGroup) => void;
}

export function StudentGroupsView({
  groups,
  parentSection,
  parentBatch,
  parentBranch,
  loading,
  onOpenEnrollments,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
}: StudentGroupsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      const matchesSearch =
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? g.is_active
          : !g.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [groups, searchTerm, statusFilter]);

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
          <div className="p-2.5 rounded-xl bg-pink-950/60 border border-pink-500/20 text-pink-400">
            <FolderTree className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              Student Groups in {parentSection.name}
              <span className="text-xs font-mono font-normal bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                {filtered.length} {filtered.length === 1 ? "group" : "groups"}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Section: <span className="text-white font-medium">{parentSection.name}</span> • Batch: <span className="text-white font-medium">{parentBatch.name}</span> • Branch: <span className="text-white font-medium">{parentBranch.code}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onAddGroup}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Group (e.g. B1, B2)
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
            placeholder="Search groups by code or description..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-surface-900/70">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 font-semibold">Group Code / Name</th>
              <th className="py-3 px-4 font-semibold">Description</th>
              <th className="py-3 px-4 font-semibold">Section</th>
              <th className="py-3 px-4 font-semibold">Enrolled Students</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginated.length > 0 ? (
              paginated.map((grp) => (
                <tr
                  key={grp.id}
                  className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  onClick={() => onOpenEnrollments(grp)}
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-pink-950/60 border border-pink-500/20 text-pink-400 font-mono font-bold text-xs">
                        {grp.name}
                      </div>
                      <span className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        Group {grp.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    {grp.description || <span className="text-slate-500 italic">No description</span>}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-medium">
                    {parentSection.name}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/20 text-emerald-300 font-medium">
                      <Users className="h-3 w-3" />
                      {grp.enrolled_count ?? 0} {grp.enrolled_count === 1 ? "student" : "students"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {grp.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td
                    className="py-3.5 px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpenEnrollments(grp)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50 h-7 px-2 flex items-center gap-1"
                        title="View Enrolled Students"
                      >
                        Enrolled Students
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditGroup(grp)}
                        className="text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 h-7 w-7 p-0"
                        title="Edit Group"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteGroup(grp)}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/50 h-7 w-7 p-0"
                        title="Delete Group"
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
                    <FolderTree className="h-8 w-8 text-slate-600 mb-1" />
                    <p className="text-sm font-medium text-slate-300">
                      {searchTerm ? "No matching groups found" : "No student groups in this section"}
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {searchTerm
                        ? "Try clearing your search query or changing filters."
                        : "Subdivide this section into lab/tutorial groups such as B1, B2, or Batch Alpha for practical sessions."}
                    </p>
                    {!searchTerm && (
                      <Button
                        onClick={onAddGroup}
                        size="sm"
                        className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
                      >
                        <Plus className="h-3 w-3" />
                        Create Group (e.g. B1)
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
            {Math.min(page * pageSize, filtered.length)} of {filtered.length} groups
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
