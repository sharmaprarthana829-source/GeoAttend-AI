"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  api,
  TimetableEntry,
  SubjectOffering,
  FacultyAssignment,
  DayOfWeek,
  ConflictItem,
} from "@/lib/api";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DoorClosed,
  UserCheck,
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

interface AddEditTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: TimetableEntry | null;
  offerings: SubjectOffering[];
  assignments: FacultyAssignment[];
  rooms: string[];
  onSuccess: () => void;
}

export function AddEditTimetableModal({
  isOpen,
  onClose,
  initialData,
  offerings,
  assignments,
  rooms,
  onSuccess,
}: AddEditTimetableModalProps) {
  const isEditing = Boolean(initialData);

  const [offeringId, setOfferingId] = useState<number | "">("");
  const [assignmentId, setAssignmentId] = useState<number | "">("");
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>("monday");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [roomNumber, setRoomNumber] = useState("C-204");

  // Conflict validation state
  const [validating, setValidating] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [timeError, setTimeError] = useState("");
  const [allowOverride, setAllowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Initialize form state
  useEffect(() => {
    if (initialData) {
      setOfferingId(initialData.subject_offering_id);
      setAssignmentId(initialData.faculty_assignment_id);
      setDayOfWeek(initialData.day_of_week);
      setStartTime(initialData.start_time ? initialData.start_time.slice(0, 5) : "09:00");
      setEndTime(initialData.end_time ? initialData.end_time.slice(0, 5) : "10:00");
      setRoomNumber(initialData.room_number || "C-204");
    } else {
      setOfferingId(offerings[0]?.id || "");
      // Pick first assignment that matches the offering if possible
      const defaultOffId = offerings[0]?.id;
      const matchingAsgn = assignments.find((a) => a.subject_offering_id === defaultOffId);
      setAssignmentId(matchingAsgn?.id || assignments[0]?.id || "");
      setDayOfWeek("monday");
      setStartTime("09:00");
      setEndTime("10:00");
      setRoomNumber(rooms[0] || "C-204");
    }
    setConflicts([]);
    setTimeError("");
    setAllowOverride(false);
    setOverrideReason("");
    setSubmitError("");
  }, [initialData, isOpen, offerings, assignments, rooms]);

  // Selected offering metadata
  const selectedOffering = useMemo(() => {
    return offerings.find((o) => o.id === Number(offeringId));
  }, [offerings, offeringId]);

  // Filter assignments relevant to the selected offering if available
  const relevantAssignments = useMemo(() => {
    if (!offeringId) return assignments;
    const directMatches = assignments.filter((a) => a.subject_offering_id === Number(offeringId));
    return directMatches.length > 0 ? directMatches : assignments;
  }, [assignments, offeringId]);

  // Auto-align assignment when offering changes
  function handleOfferingChange(newOffId: number) {
    setOfferingId(newOffId);
    const matches = assignments.filter((a) => a.subject_offering_id === newOffId);
    if (matches.length > 0) {
      setAssignmentId(matches[0].id);
    }
  }

  // Run backend conflict check whenever key fields change
  useEffect(() => {
    if (!isOpen || !offeringId || !assignmentId || !startTime || !endTime || !roomNumber) {
      return;
    }

    if (startTime >= endTime) {
      setTimeError("Start time must be strictly earlier than end time.");
      setConflicts([]);
      return;
    } else {
      setTimeError("");
    }

    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await api.timetable.validateConflicts({
          day_of_week: dayOfWeek,
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          room_number: roomNumber.trim(),
          subject_offering_id: Number(offeringId),
          faculty_assignment_id: Number(assignmentId),
          exclude_entry_id: initialData?.id || null,
        });

        if (res.errors && res.errors.length > 0) {
          setTimeError(res.errors[0]);
          setConflicts([]);
        } else {
          setTimeError("");
          setConflicts(res.conflicts || []);
        }
      } catch (err: any) {
        console.error("Conflict validation check failed:", err);
      } finally {
        setValidating(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [isOpen, offeringId, assignmentId, dayOfWeek, startTime, endTime, roomNumber, initialData?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (startTime >= endTime) {
      setSubmitError("Start time must be strictly earlier than end time.");
      return;
    }

    if (conflicts.length > 0 && !allowOverride) {
      setSubmitError("Unresolved conflict detected. Please adjust time/room or authorize an administrative override.");
      return;
    }

    if (conflicts.length > 0 && allowOverride && !overrideReason.trim()) {
      setSubmitError("An explicit override reason is required for audit logs when overriding conflicts.");
      return;
    }

    setSaving(true);
    try {
      if (isEditing && initialData) {
        await api.timetable.updateEntry(initialData.id, {
          subject_offering_id: Number(offeringId),
          faculty_assignment_id: Number(assignmentId),
          day_of_week: dayOfWeek,
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          room_number: roomNumber.trim(),
          allow_override: allowOverride,
          override_reason: allowOverride ? overrideReason.trim() : null,
        });
      } else {
        await api.timetable.createEntry({
          subject_offering_id: Number(offeringId),
          faculty_assignment_id: Number(assignmentId),
          day_of_week: dayOfWeek,
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          room_number: roomNumber.trim(),
          allow_override: allowOverride,
          override_reason: allowOverride ? overrideReason.trim() : null,
          is_active: true,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to persist timetable schedule entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Timetable Entry #${initialData?.id}` : "Schedule New Timetable Entry"}
      description="Deterministic conflict detection enforces faculty availability, room bookings, and student cohort overlaps."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Academic Offering Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Subject Offering <span className="text-emerald-400">*</span>
          </label>
          <select
            value={offeringId}
            onChange={(e) => handleOfferingChange(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            required
          >
            {offerings.length === 0 ? (
              <option value="">No subject offerings available</option>
            ) : (
              offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.subject_code} - {o.subject_name} ({o.class_type?.toUpperCase()}) | {o.branch_name || "Branch"} - Sem {o.semester}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Live Context Preview Card */}
        {selectedOffering && (
          <div className="p-3 rounded-xl border border-slate-800 bg-surface-950/70 text-xs text-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Course / Branch</span>
              <span className="font-medium text-slate-200">{selectedOffering.branch_name || "—"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Batch / Sem</span>
              <span className="font-medium text-slate-200">
                {selectedOffering.batch_name || "—"} (Sem {selectedOffering.semester})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Section / Cohort</span>
              <span className="font-medium text-slate-200">
                {selectedOffering.section_name || "CSD-A"}{" "}
                {selectedOffering.student_group_name ? `(Group ${selectedOffering.student_group_name})` : "(Whole Section)"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Class Type</span>
              <span className="font-semibold text-emerald-400 uppercase font-mono">
                {selectedOffering.class_type}
              </span>
            </div>
          </div>
        )}

        {/* Faculty Assignment Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Instructor / Faculty Assignment <span className="text-emerald-400">*</span>
          </label>
          <select
            value={assignmentId}
            onChange={(e) => setAssignmentId(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            required
          >
            {relevantAssignments.length === 0 ? (
              <option value="">No faculty assignments found</option>
            ) : (
              relevantAssignments.map((a) => {
                const empId = a.employee_id || a.faculty_employee_id;
                return (
                  <option key={a.id} value={a.id}>
                    {a.faculty_name || "Faculty"} {empId ? `(${empId})` : ""} — {a.is_primary ? "Primary Faculty" : "Assistant"}
                  </option>
                );
              })
            )}
          </select>
        </div>

        {/* Day & Room Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Day of Week <span className="text-emerald-400">*</span>
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
              className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 capitalize focus:border-emerald-500 focus:outline-none"
            >
              {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const).map((d) => (
                <option key={d} value={d} className="capitalize">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Room / Lab Number <span className="text-emerald-400">*</span>
            </label>
            <div className="relative">
              <Input
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. C-204, LAB-1"
                required
                className="pr-20"
              />
              {rooms.length > 0 && (
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  <select
                    onChange={(e) => e.target.value && setRoomNumber(e.target.value)}
                    className="text-[11px] rounded-lg border border-slate-700 bg-surface-800 text-slate-300 px-2 py-0.5 focus:outline-none"
                    value=""
                  >
                    <option value="" disabled>
                      Picks
                    </option>
                    {rooms.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Time Interval Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Start Time <span className="text-emerald-400">*</span>
            </label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              End Time <span className="text-emerald-400">*</span>
            </label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Interval Error Banner */}
        {timeError && (
          <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/40 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{timeError}</span>
          </div>
        )}

        {/* Live Conflict Engine Banner */}
        {validating ? (
          <div className="p-3 rounded-xl border border-slate-800 bg-surface-950/50 text-xs text-slate-400 flex items-center gap-2">
            <div className="h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Inspecting system-wide timetable conflicts...</span>
          </div>
        ) : conflicts.length > 0 ? (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 space-y-3">
            <div className="flex items-center justify-between text-rose-300">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                {conflicts.length} Timetable Clash{conflicts.length > 1 ? "es" : ""} Detected
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-200">
                Action Required
              </span>
            </div>

            <div className="space-y-2">
              {conflicts.map((c, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-rose-500/20 bg-surface-950/80 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1">
                      {c.conflict_type === "faculty" && <UserCheck className="h-3.5 w-3.5 text-amber-400" />}
                      {c.conflict_type === "room" && <DoorClosed className="h-3.5 w-3.5 text-rose-400" />}
                      {c.conflict_type === "student_group" && <Layers className="h-3.5 w-3.5 text-purple-400" />}
                      <span className="capitalize">{c.conflict_type.replace("_", " ")}: {c.title}</span>
                    </span>
                    <span className="font-mono text-[11px] text-amber-300">
                      Overlap: {c.overlapping_interval}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{c.description}</p>
                </div>
              ))}
            </div>

            {/* Administrative Override Section */}
            <div className="pt-2 border-t border-rose-500/30">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                <input
                  type="checkbox"
                  checked={allowOverride}
                  onChange={(e) => setAllowOverride(e.target.checked)}
                  className="rounded border-slate-700 bg-surface-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Authorize Administrative Override (Audit Logged)</span>
              </label>

              {allowOverride && (
                <div className="mt-2.5 space-y-1">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Justification / Reason for Conflict Override <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Combined special demonstration session authorized by Dean"
                    required={allowOverride}
                    className="w-full rounded-lg border border-slate-700 bg-surface-900 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    This action will be permanently recorded in the system audit logs.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          !timeError && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Conflict Engine validated: No faculty, room, or student group clashes!</span>
            </div>
          )
        )}

        {/* Submission Error Banner */}
        {submitError && (
          <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/50 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Modal Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || Boolean(timeError) || (conflicts.length > 0 && !allowOverride)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2"
          >
            {saving ? "Persisting Schedule..." : isEditing ? "Save Changes" : "Schedule Entry"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
