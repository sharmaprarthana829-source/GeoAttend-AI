"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SubjectMaster } from "@/lib/api";

export default function ViewSubjectModal({
  isOpen,
  onClose,
  subject,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  subject?: SubjectMaster | null;
  onEdit?: () => void;
}) {
  if (!subject) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Master Subject Details"
      description={`Catalog record for ${subject.name}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface-950/60 p-4 border border-slate-800">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Subject Code</p>
            <p className="text-base font-bold font-mono text-emerald-400 mt-0.5">{subject.code}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Credits</p>
            <p className="text-base font-semibold text-slate-200 mt-0.5">{subject.credits} Credits</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Department</p>
            <p className="text-sm font-medium text-slate-300 mt-0.5">{subject.department_name || "General / Interdisciplinary"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Status</p>
            <span
              className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                subject.is_active
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}
            >
              {subject.is_active ? "Active in Catalog" : "Inactive / Archived"}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Subject Name</p>
          <p className="text-sm font-medium text-slate-200">{subject.name}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Description / Syllabus Overview</p>
          <p className="text-xs text-slate-300 bg-surface-950/50 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
            {subject.description || "No description provided."}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
          <span>Active Offerings: <strong className="text-slate-200">{subject.offerings_count ?? 0}</strong></span>
          <span>Subject ID: <strong className="text-slate-200">#{subject.id}</strong></span>
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
              Edit Subject
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
