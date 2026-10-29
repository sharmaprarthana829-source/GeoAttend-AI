"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api, TimetableEntry } from "@/lib/api";
import { AlertTriangle, Trash2, ShieldCheck } from "lucide-react";

interface DeleteTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: TimetableEntry | null;
  onSuccess: () => void;
}

export function DeleteTimetableModal({
  isOpen,
  onClose,
  entry,
  onSuccess,
}: DeleteTimetableModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!entry) return null;

  async function handleConfirmDelete() {
    setLoading(true);
    setError("");
    try {
      await api.timetable.deleteEntry(entry!.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to deactivate timetable entry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deactivate Timetable Entry"
      description="Safely archive this academic schedule slot."
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 space-y-2">
          <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>Are you sure you want to deactivate this schedule entry?</span>
          </div>
          <div className="pl-6 text-xs text-slate-300 space-y-1">
            <p>
              <strong className="text-white">Subject:</strong> {entry.subject_name} ({entry.subject_code})
            </p>
            <p>
              <strong className="text-white">Time:</strong> {entry.day_of_week?.toUpperCase()} {entry.start_time?.slice(0, 5)} - {entry.end_time?.slice(0, 5)}
            </p>
            <p>
              <strong className="text-white">Room:</strong> {entry.room_number} • <strong className="text-white">Instructor:</strong> {entry.faculty_name}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-surface-950/60 text-xs text-slate-300 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong className="text-emerald-300">Historical Data Protected:</strong> Any attendance sessions, student check-in records, and anomaly logs previously recorded under this schedule slot will remain intact.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/40 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmDelete}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {loading ? "Deactivating..." : "Confirm Deactivation"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
