"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api, FacultyAssignment, FacultyDetail, SubjectOffering } from "@/lib/api";

export default function AddEditAssignmentModal({
  isOpen,
  onClose,
  onSave,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (d: any) => Promise<void> | void;
  initial?: FacultyAssignment | null;
}) {
  const [facultyList, setFacultyList] = useState<FacultyDetail[]>([]);
  const [offerings, setOfferings] = useState<SubjectOffering[]>([]);
  const [facultyId, setFacultyId] = useState<number | "">("");
  const [offeringId, setOfferingId] = useState<number | "">("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSaving(false);
      setLoading(true);

      Promise.all([
        api.faculty.getProfiles().catch(() => []),
        api.subjects.getOfferings({ is_active: true }).catch(() => []),
      ])
        .then(([facs, offs]) => {
          setFacultyList(facs);
          setOfferings(offs);

          if (initial) {
            setFacultyId(initial.faculty_id);
            setOfferingId(initial.subject_offering_id);
            setIsPrimary(initial.is_primary !== false);
            setIsActive(initial.is_active !== false);
          } else {
            setFacultyId(facs[0]?.id || "");
            setOfferingId(offs[0]?.id || "");
            setIsPrimary(true);
            setIsActive(true);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [initial, isOpen]);

  // Selected offering preview
  const selectedOffering = useMemo(() => {
    return offerings.find((o) => o.id === Number(offeringId));
  }, [offerings, offeringId]);

  // Selected faculty preview
  const selectedFaculty = useMemo(() => {
    return facultyList.find((f) => f.id === Number(facultyId));
  }, [facultyList, facultyId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!facultyId) {
      setError("Please select a real faculty member.");
      return;
    }
    if (!offeringId) {
      setError("Please select a valid subject offering.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: any = {
        faculty_id: Number(facultyId),
        subject_offering_id: Number(offeringId),
        is_primary: isPrimary,
        is_active: isActive,
      };
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save faculty assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? "Edit Faculty Assignment" : "Assign Faculty Member"}
      description="Connect a verified teacher to an academic subject offering for timetabling & attendance."
      maxWidth="lg"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading faculty & offerings...</div>
        ) : (
          <div className="space-y-4">
            {/* Faculty Selection */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Faculty Member <span className="text-emerald-400">*</span>
              </label>
              <select
                value={facultyId}
                onChange={(e) => setFacultyId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                disabled={saving}
                required
              >
                <option value="">Select Faculty Member...</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.full_name} ({f.employee_id}) — {f.department_name || f.designation || "Faculty"}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Offering Selection */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Subject Offering <span className="text-emerald-400">*</span>
              </label>
              <select
                value={offeringId}
                onChange={(e) => setOfferingId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                disabled={saving}
                required
              >
                <option value="">Select Subject Offering...</option>
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.subject_name} ({o.subject_code}) — {o.branch_name} • Sem {o.semester} Sec {o.section_name} [{o.class_type.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            {/* Live Offering Preview Card */}
            {selectedOffering && (
              <div className="rounded-xl bg-surface-950/70 p-4 border border-slate-800 space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400">
                  Offering Context Preview
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Subject</span>
                    <strong className="text-white font-medium">{selectedOffering.subject_name} ({selectedOffering.subject_code})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Branch & Course</span>
                    <span className="text-slate-200">{selectedOffering.branch_name} ({selectedOffering.course_name})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Class Type</span>
                    <span className="font-semibold uppercase text-emerald-400">{selectedOffering.class_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Semester & Section</span>
                    <span className="text-slate-200">Sem {selectedOffering.semester} • Sec {selectedOffering.section_name} {selectedOffering.student_group_name ? `(Grp ${selectedOffering.student_group_name})` : ""}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Batch / Academic Year</span>
                    <span className="text-slate-200">{selectedOffering.batch_name || selectedOffering.academic_year || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Currently Assigned</span>
                    <span className="text-slate-200">{selectedOffering.assigned_faculty_count ?? 0} Teacher(s)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Assignment Role: Primary vs Assistant */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Assignment Role <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsPrimary(true)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isPrimary
                      ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                      : "bg-surface-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <p className="text-xs font-bold">Primary Faculty</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Main instructor taking lectures & attendance</p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrimary(false)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    !isPrimary
                      ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                      : "bg-surface-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <p className="text-xs font-bold">Assistant / Co-Faculty</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Lab instructor or secondary teacher</p>
                </button>
              </div>
            </div>

            {/* Status (when editing) */}
            {initial && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="asgnIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded accent-emerald-500 h-4 w-4"
                  disabled={saving}
                />
                <label htmlFor="asgnIsActive" className="text-xs text-slate-300 cursor-pointer">
                  Assignment is Active for Timetable
                </label>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-800/80">
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || loading}>
            {saving ? "Saving..." : initial ? "Update Assignment" : "Assign Faculty Member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
