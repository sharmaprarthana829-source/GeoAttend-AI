"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SubjectOffering } from "@/lib/api";

export default function ViewOfferingModal({
  isOpen,
  onClose,
  offering,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  offering?: SubjectOffering | null;
  onEdit?: () => void;
}) {
  if (!offering) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Subject Offering Details"
      description={`Offering instance #${offering.id} for ${offering.subject_name || "Subject"}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Header Hero */}
        <div className="rounded-xl bg-surface-950/70 p-4 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-white">{offering.subject_name || "Unknown Subject"}</h4>
              <p className="text-xs font-mono text-emerald-400 mt-0.5">{offering.subject_code} • {offering.credits ? `${offering.credits} Credits` : ""}</p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                offering.class_type === "lab"
                  ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                  : "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {offering.class_type}
            </span>
          </div>
        </div>

        {/* Academic Hierarchy Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Course</span>
            <p className="font-semibold text-slate-200 mt-0.5">{offering.course_name || "—"}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Branch</span>
            <p className="font-semibold text-slate-200 mt-0.5">{offering.branch_name || "—"}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Semester</span>
            <p className="font-semibold text-slate-200 mt-0.5">Semester {offering.semester}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Section / Group</span>
            <p className="font-semibold text-slate-200 mt-0.5">
              Section {offering.section_name || "—"}
              {offering.student_group_name ? ` (Group ${offering.student_group_name})` : " (Whole Section)"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Batch / Year</span>
            <p className="font-semibold text-slate-200 mt-0.5">{offering.batch_name || offering.academic_year || "—"}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Status</span>
            <p className="mt-0.5">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  offering.is_active
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                }`}
              >
                {offering.is_active ? "Active Offering" : "Inactive"}
              </span>
            </p>
          </div>
        </div>

        {/* Assigned Faculty */}
        <div className="p-3 rounded-xl bg-surface-950/40 border border-slate-800/80">
          <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Assigned Teachers</span>
          {offering.assigned_faculty_names && offering.assigned_faculty_names.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {offering.assigned_faculty_names.map((name, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-surface-800 border border-slate-700 text-xs text-slate-200 font-medium">
                  👨‍🏫 {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-1 italic">No faculty assigned yet to this offering.</p>
          )}
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
              Edit Offering
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
