"use client";

import React from "react";
import {
  GraduationCap,
  Building2,
  Layers,
  CalendarDays,
  Users,
  Grid,
} from "lucide-react";
import { AcademicHierarchyState } from "./types";

interface ParentContextBannerProps {
  state: AcademicHierarchyState;
}

export function ParentContextBanner({ state }: ParentContextBannerProps) {
  const {
    level,
    selectedCourse,
    selectedDepartment,
    selectedBranch,
    selectedBatch,
    selectedSection,
    selectedGroup,
  } = state;

  if (level === "courses" || !selectedCourse) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-surface-900/90 via-surface-900/60 to-surface-900/40 border border-slate-800/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-emerald-500/5 pointer-events-none blur-2xl" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center flex-wrap gap-2 text-slate-300">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
            Parent Context:
          </span>

          {selectedCourse && (
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-lg">
              <GraduationCap className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-400">Course:</span>
              <span className="font-semibold text-white">{selectedCourse.name}</span>
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/20">
                {selectedCourse.code}
              </span>
            </div>
          )}

          {selectedDepartment && level !== "departments" && (
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-lg">
              <Building2 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-slate-400">Dept:</span>
              <span className="font-semibold text-white">{selectedDepartment.name}</span>
              <span className="font-mono text-[10px] text-blue-400 bg-blue-950/60 px-1 py-0.2 rounded border border-blue-500/20">
                {selectedDepartment.code}
              </span>
            </div>
          )}

          {selectedBranch && !["departments", "branches"].includes(level) && (
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-lg">
              <Layers className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-slate-400">Branch:</span>
              <span className="font-semibold text-white">{selectedBranch.name}</span>
              <span className="font-mono text-[10px] text-purple-400 bg-purple-950/60 px-1 py-0.2 rounded border border-purple-500/20">
                {selectedBranch.code}
              </span>
            </div>
          )}

          {selectedBatch && !["departments", "branches", "batches"].includes(level) && (
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-lg">
              <CalendarDays className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-slate-400">Batch:</span>
              <span className="font-semibold text-white">{selectedBatch.name}</span>
              <span className="font-mono text-[10px] text-slate-400">
                ({selectedBatch.start_year}–{selectedBatch.end_year})
              </span>
            </div>
          )}

          {selectedSection && ["groups", "enrollments"].includes(level) && (
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-lg">
              <Grid className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-slate-400">Section:</span>
              <span className="font-semibold text-white">{selectedSection.name}</span>
              {selectedSection.capacity && (
                <span className="text-slate-400 text-[10px]">
                  (Cap: {selectedSection.capacity})
                </span>
              )}
            </div>
          )}

          {selectedGroup && level === "enrollments" && (
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-lg">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-400">Group:</span>
              <span className="font-semibold text-emerald-400">{selectedGroup.name}</span>
              {selectedGroup.description && (
                <span className="text-slate-400 text-[10px]">
                  ({selectedGroup.description})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Active Hierarchy Scope</span>
        </div>
      </div>
    </div>
  );
}
