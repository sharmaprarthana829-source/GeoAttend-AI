"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FacultyAssignment } from "@/lib/api";

export default function ViewAssignmentModal({
  isOpen,
  onClose,
  assignment,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  assignment?: FacultyAssignment | null;
  onEdit?: () => void;
}) {
  if (!assignment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Faculty Assignment Details"
      description={`Assignment #${assignment.id} for ${assignment.faculty_name || "Faculty"}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Faculty Hero */}
        <div className="rounded-xl bg-surface-950/70 p-4 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
              {assignment.faculty_name ? assignment.faculty_name.trim()[0]?.toUpperCase() : "F"}
            </div>
            <div className="flex-1">
              <h4 className="text-base font-bold text-white">{assignment.faculty_name}</h4>
              <p className="text-xs text-slate-400 font-mono">
                ID: <span className="text-emerald-400 font-bold">{assignment.faculty_employee_id || "N/A"}</span> • {assignment.faculty_designation || "Faculty Member"}
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                assignment.is_primary
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                  : "bg-surface-800 text-slate-300 border border-slate-700"
              }`}
            >
              {assignment.is_primary ? "Primary Faculty" : "Assistant Faculty"}
            </span>
          </div>
        </div>

        {/* Offering Academic Context */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Subject</span>
            <p className="font-semibold text-white mt-0.5">{assignment.subject_name || "—"}</p>
            <p className="font-mono text-[11px] text-emerald-400">{assignment.subject_code || "—"}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Class Type</span>
            <p className="font-semibold uppercase text-emerald-400 mt-0.5">{assignment.class_type || "THEORY"}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Branch</span>
            <p className="font-semibold text-slate-200 mt-0.5">{assignment.branch_name || "—"}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Semester & Section</span>
            <p className="font-semibold text-slate-200 mt-0.5">
              Sem {assignment.semester} • Sec {assignment.section_name}
              {assignment.student_group_name ? ` (Grp ${assignment.student_group_name})` : ""}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Batch / Year</span>
            <p className="font-semibold text-slate-200 mt-0.5">{assignment.batch_name || assignment.academic_year || "—"}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Status</span>
            <p className="mt-0.5">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  assignment.is_active
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                }`}
              >
                {assignment.is_active ? "Active Assignment" : "Inactive"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onEdit && (
            <Button
              onClick={() => {
                onClose();
                onEdit();
              }}
            >
              Edit Assignment
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
