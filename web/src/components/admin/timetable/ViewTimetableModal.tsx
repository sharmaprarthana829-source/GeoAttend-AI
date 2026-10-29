"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TimetableEntry } from "@/lib/api";
import {
  Calendar,
  Clock,
  BookOpen,
  UserCheck,
  DoorClosed,
  Layers,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Edit,
  Trash2,
  AlertOctagon,
} from "lucide-react";

interface ViewTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: TimetableEntry | null;
  onEdit: (entry: TimetableEntry) => void;
  onDelete: (entry: TimetableEntry) => void;
}

export function ViewTimetableModal({
  isOpen,
  onClose,
  entry,
  onEdit,
  onDelete,
}: ViewTimetableModalProps) {
  if (!entry) return null;

  const hasConflict = entry.has_conflict && entry.conflicts && entry.conflicts.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Timetable Schedule Details — #${entry.id}`}
      description="Comprehensive schedule parameters and real-time conflict diagnostics."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Status & Conflict Banner */}
        {hasConflict ? (
          <div className="p-4 rounded-2xl border border-rose-500/40 bg-rose-950/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                <AlertOctagon className="h-4 w-4 text-rose-400" />
                {entry.conflicts!.length} Conflict{entry.conflicts!.length > 1 ? "s" : ""} Recorded on This Entry
              </span>
              <div className="flex gap-1.5">
                {entry.conflict_types?.map((ct) => (
                  <span
                    key={ct}
                    className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30"
                  >
                    {ct.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {entry.conflicts!.map((c, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-rose-500/30 bg-surface-950/80 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      #{c.conflicting_entry_id}: {c.conflicting_subject_name} ({c.conflicting_subject_code})
                    </span>
                    <span className="font-mono text-[11px] text-amber-300">
                      Window: {c.overlapping_interval}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{c.description}</p>
                  <div className="flex flex-wrap gap-3 text-[10px] font-mono text-slate-400 pt-0.5">
                    <span>Teacher: {c.conflicting_faculty_name}</span>
                    <span>Room: {c.conflicting_room}</span>
                    <span>Section: {c.conflicting_section_name} {c.conflicting_group_name ? `(${c.conflicting_group_name})` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="font-medium">Conflict-Free: Validated by the deterministic conflict engine.</span>
          </div>
        )}

        {/* Schedule Time & Location Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-900/60">
            <span className="text-xs font-mono text-slate-400 uppercase flex items-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-400" /> Day of Week
            </span>
            <p className="text-sm font-bold text-white capitalize">{entry.day_of_week}</p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-900/60">
            <span className="text-xs font-mono text-slate-400 uppercase flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-emerald-400" /> Time Interval
            </span>
            <p className="text-sm font-bold font-mono text-emerald-400">
              {entry.start_time?.slice(0, 5)} - {entry.end_time?.slice(0, 5)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-900/60">
            <span className="text-xs font-mono text-slate-400 uppercase flex items-center gap-1.5 mb-1">
              <DoorClosed className="h-3.5 w-3.5 text-emerald-400" /> Room / Classroom
            </span>
            <p className="text-sm font-bold font-mono text-white">{entry.room_number}</p>
          </div>
        </div>

        {/* Subject & Academic Context */}
        <div className="p-4 rounded-xl border border-slate-800 bg-surface-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-emerald-400" /> Subject & Academic Context
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase font-mono bg-surface-800 text-emerald-400 border border-emerald-500/20">
              {entry.class_type}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Subject</span>
              <p className="font-semibold text-white text-sm">
                {entry.subject_name} <span className="font-mono text-xs text-slate-400">({entry.subject_code})</span>
              </p>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Course / Branch</span>
              <p className="font-medium text-slate-200">
                {entry.course_name ? `${entry.course_name} — ` : ""}{entry.branch_name || "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Semester & Section</span>
              <p className="font-medium text-slate-200">
                Semester {entry.semester || "—"} • Section {entry.section_name || "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Cohort / Student Group</span>
              <p className="font-medium text-slate-200">
                {entry.student_group_name ? `Group ${entry.student_group_name}` : "Whole Section"}
              </p>
            </div>
          </div>
        </div>

        {/* Instructor Details */}
        <div className="p-4 rounded-xl border border-slate-800 bg-surface-900/40 space-y-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-emerald-400" /> Instructor
          </span>
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-white text-sm">{entry.faculty_name || "Unassigned"}</p>
              {entry.employee_id && (
                <p className="text-[11px] font-mono text-slate-400">Employee ID: {entry.employee_id}</p>
              )}
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-800 text-slate-300 border border-slate-700">
              Assigned Faculty
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              onDelete(entry);
            }}
            className="text-rose-400 hover:text-rose-300 border-rose-500/20 text-xs flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Deactivate
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onEdit(entry);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" /> Edit Entry
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
