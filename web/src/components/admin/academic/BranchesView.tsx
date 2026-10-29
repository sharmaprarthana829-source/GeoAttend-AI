"use client";

import React, { useState, useMemo } from "react";
import { Branch, Department, Course } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  Search,
  CalendarDays,
  Building2,
} from "lucide-react";

interface BranchesViewProps {
  branches: Branch[];
  parentDepartment: Department;
  parentCourse: Course;
  loading: boolean;
  onOpenBatches: (branch: Branch) => void;
  onAddBranch: () => void;
  onEditBranch: (branch: Branch) => void;
  onDeleteBranch: (branch: Branch) => void;
}

export function BranchesView({
  branches,
  parentDepartment,
  parentCourse,
  loading,
  onOpenBatches,
  onAddBranch,
  onEditBranch,
  onDeleteBranch,
}: BranchesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    return branches.filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? b.is_active
          : !b.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [branches, searchTerm, statusFilter]);

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
          <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/20 text-purple-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              Branches in {parentDepartment.code}
              <span className="text-xs font-mono font-normal bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                {filtered.length} {filtered.length === 1 ? "branch" : "branches"}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Department: <span className="text-white font-medium">{parentDepartment.name}</span> • Course: <span className="text-white font-medium">{parentCourse.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onAddBranch}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Branch
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
            placeholder="Search by branch name or code..."
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

      {/* Table / List */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-surface-900/70">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 font-semibold">Branch Name</th>
              <th className="py-3 px-4 font-semibold">Code</th>
              <th className="py-3 px-4 font-semibold">Department</th>
              <th className="py-3 px-4 font-semibold">Batches</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginated.length > 0 ? (
              paginated.map((b) => (
                <tr
                  key={b.id}
                  className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  onClick={() => onOpenBatches(b)}
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-purple-950/40 text-purple-400 group-hover:bg-purple-900/40 border border-purple-500/20 transition-colors">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-white group-hover:text-purple-300 transition-colors">
                          {b.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: #{b.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] border border-slate-700/60">
                      {b.code}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Building2 className="h-3.5 w-3.5 text-blue-400" />
                      <span>{parentDepartment.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/60 text-amber-400 border border-amber-500/20">
                      <CalendarDays className="h-3 w-3" />
                      {b.batch_count ?? 0} {b.batch_count === 1 ? "Batch" : "Batches"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {b.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenBatches(b)}
                        className="bg-purple-950/30 hover:bg-purple-900/50 text-purple-400 hover:text-purple-300 border-purple-500/30 text-xs px-2.5 py-1 h-7 flex items-center gap-1"
                      >
                        <span>Batches</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      <button
                        type="button"
                        onClick={() => onEditBranch(b)}
                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title="Edit Branch"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBranch(b)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-red-950/30 transition-colors"
                        title="Delete Branch"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-full text-slate-600">
                      <Layers className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-300">No branches found for this department</p>
                      <p className="text-xs text-slate-500">
                        {searchTerm ? "Try adjusting your search criteria" : `Add the first branch to ${parentDepartment.name}.`}
                      </p>
                    </div>
                    {!searchTerm && (
                      <Button
                        size="sm"
                        onClick={onAddBranch}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs mt-2"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add First Branch
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
        <div className="flex items-center justify-between text-xs text-slate-400 px-2 py-1">
          <div>
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, filtered.length)} of {filtered.length} branches
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 text-xs px-2.5"
            >
              Previous
            </Button>
            <span className="px-2 text-slate-300 font-medium">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 text-xs px-2.5"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
