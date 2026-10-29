"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  api,
  SubjectMaster,
  SubjectOffering,
  Course,
  Branch,
  Batch,
  Section,
  StudentGroup,
  ClassType,
} from "@/lib/api";

export default function AddEditOfferingModal({
  isOpen,
  onClose,
  onSave,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (d: any) => Promise<void> | void;
  initial?: SubjectOffering | null;
}) {
  const [subjects, setSubjects] = useState<SubjectMaster[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);

  // Form Fields
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [batchId, setBatchId] = useState<number | "">("");
  const [semester, setSemester] = useState<number>(1);
  const [sectionId, setSectionId] = useState<number | "">("");
  const [studentGroupId, setStudentGroupId] = useState<number | "">("");
  const [classType, setClassType] = useState<ClassType>("theory");
  const [academicYear, setAcademicYear] = useState("2024-2028");
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
        api.subjects.getMasterSubjects({ is_active: true }).catch(() => []),
        api.academic.getCourses().catch(() => []),
        api.academic.getBranches().catch(() => []),
        api.academic.getBatches().catch(() => []),
        api.academic.getSections().catch(() => []),
        api.academic.getStudentGroups().catch(() => []),
      ])
        .then(([subs, crss, brs, bts, secs, grps]) => {
          setSubjects(subs);
          setCourses(crss);
          setBranches(brs);
          setBatches(bts);
          setSections(secs);
          setGroups(grps);

          if (initial) {
            setSubjectId(initial.subject_id);
            setCourseId(initial.course_id);
            setBranchId(initial.branch_id);
            setSemester(initial.semester);
            setSectionId(initial.section_id);
            setStudentGroupId(initial.student_group_id || "");
            setClassType(initial.class_type);
            setAcademicYear(initial.academic_year || "2024-2028");
            setIsActive(initial.is_active !== false);

            // Infer batch if not set
            const secObj = secs.find((s) => s.id === initial.section_id);
            if (secObj) setBatchId(secObj.batch_id);
          } else {
            const firstSub = subs[0]?.id || "";
            const firstCrs = crss[0]?.id || "";
            const crsBrs = brs.filter((b) => b.course_id === firstCrs);
            const firstBr = crsBrs[0]?.id || "";
            const brBts = bts.filter((b) => b.branch_id === firstBr);
            const firstBt = brBts[0]?.id || "";
            const btSecs = secs.filter((s) => s.batch_id === firstBt);
            const firstSec = btSecs[0]?.id || "";

            setSubjectId(firstSub);
            setCourseId(firstCrs);
            setBranchId(firstBr);
            setBatchId(firstBt);
            setSemester(1);
            setSectionId(firstSec);
            setStudentGroupId("");
            setClassType("theory");
            if (brBts[0]) {
              setAcademicYear(`${brBts[0].start_year}-${brBts[0].end_year}`);
            } else {
              setAcademicYear("2024-2028");
            }
            setIsActive(true);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [initial, isOpen]);

  // Cascading lists
  const availableBranches = useMemo(() => {
    if (!courseId) return branches;
    return branches.filter((b) => b.course_id === Number(courseId));
  }, [branches, courseId]);

  const availableBatches = useMemo(() => {
    if (!branchId) return batches;
    return batches.filter((b) => b.branch_id === Number(branchId));
  }, [batches, branchId]);

  const availableSections = useMemo(() => {
    if (!batchId) return sections;
    return sections.filter((s) => s.batch_id === Number(batchId));
  }, [sections, batchId]);

  const availableGroups = useMemo(() => {
    if (!sectionId) return [];
    return groups.filter((g) => g.section_id === Number(sectionId));
  }, [groups, sectionId]);

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === Number(courseId));
  }, [courses, courseId]);

  // Cascading change handlers
  function handleCourseChange(cid: number) {
    setCourseId(cid);
    const brs = branches.filter((b) => b.course_id === cid);
    const nextBrId = brs[0]?.id || "";
    setBranchId(nextBrId);

    const bts = batches.filter((b) => b.branch_id === nextBrId);
    const nextBtId = bts[0]?.id || "";
    setBatchId(nextBtId);
    if (bts[0]) setAcademicYear(`${bts[0].start_year}-${bts[0].end_year}`);

    const secs = sections.filter((s) => s.batch_id === nextBtId);
    setSectionId(secs[0]?.id || "");
    setStudentGroupId("");
    setError("");
  }

  function handleBranchChange(bid: number) {
    setBranchId(bid);
    const bts = batches.filter((b) => b.branch_id === bid);
    const nextBtId = bts[0]?.id || "";
    setBatchId(nextBtId);
    if (bts[0]) setAcademicYear(`${bts[0].start_year}-${bts[0].end_year}`);

    const secs = sections.filter((s) => s.batch_id === nextBtId);
    setSectionId(secs[0]?.id || "");
    setStudentGroupId("");
    setError("");
  }

  function handleBatchChange(btId: number) {
    setBatchId(btId);
    const btObj = batches.find((b) => b.id === btId);
    if (btObj) setAcademicYear(`${btObj.start_year}-${btObj.end_year}`);

    const secs = sections.filter((s) => s.batch_id === btId);
    setSectionId(secs[0]?.id || "");
    setStudentGroupId("");
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId) {
      setError("Please select a Master Subject.");
      return;
    }
    if (!courseId) {
      setError("Please select a Course.");
      return;
    }
    if (!branchId) {
      setError("Please select a Branch.");
      return;
    }
    if (!sectionId) {
      setError("Please select a Section.");
      return;
    }
    if (!semester || semester < 1) {
      setError("Please enter a valid semester number.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: any = {
        subject_id: Number(subjectId),
        course_id: Number(courseId),
        branch_id: Number(branchId),
        batch_id: batchId ? Number(batchId) : undefined,
        semester: Number(semester),
        section_id: Number(sectionId),
        student_group_id: studentGroupId ? Number(studentGroupId) : null,
        class_type: classType,
        academic_year: academicYear.trim() || undefined,
        is_active: isActive,
      };
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save subject offering.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? "Edit Subject Offering" : "Add Subject Offering"}
      description="Create a specific instance of a master subject for a branch, semester and section."
      maxWidth="lg"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading academic data...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Master Subject Selection */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Master Subject <span className="text-emerald-400">*</span>
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                disabled={saving}
                required
              >
                <option value="">Select Master Subject...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) — {s.credits} Credits
                  </option>
                ))}
              </select>
            </div>

            {/* Course */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Course / Program <span className="text-emerald-400">*</span>
              </label>
              <select
                value={courseId}
                onChange={(e) => handleCourseChange(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                disabled={saving}
                required
              >
                <option value="">Select Course...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Branch (cascades from Course) */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Branch / Discipline <span className="text-emerald-400">*</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => handleBranchChange(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                disabled={saving || availableBranches.length === 0}
                required
              >
                <option value="">Select Branch...</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Batch (cascades from Branch) */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Batch
              </label>
              <select
                value={batchId}
                onChange={(e) => handleBatchChange(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                disabled={saving || availableBatches.length === 0}
              >
                <option value="">Select Batch...</option>
                {availableBatches.map((bt) => (
                  <option key={bt.id} value={bt.id}>
                    {bt.name} ({bt.start_year}–{bt.end_year})
                  </option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Semester (1–{selectedCourse?.total_semesters || 8}) <span className="text-emerald-400">*</span>
              </label>
              <Input
                type="number"
                min={1}
                max={selectedCourse?.total_semesters || 12}
                value={String(semester)}
                onChange={(e) => setSemester(Number(e.target.value))}
                disabled={saving}
                required
              />
            </div>

            {/* Section (cascades from Batch) */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Section <span className="text-emerald-400">*</span>
              </label>
              <select
                value={sectionId}
                onChange={(e) => {
                  setSectionId(Number(e.target.value));
                  setStudentGroupId("");
                }}
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                disabled={saving || availableSections.length === 0}
                required
              >
                <option value="">Select Section...</option>
                {availableSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Section {sec.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Student Group (Optional, cascades from Section) */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Student Group (Optional)
              </label>
              <select
                value={studentGroupId}
                onChange={(e) => setStudentGroupId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                disabled={saving || !sectionId}
              >
                <option value="">Whole Section (All students)</option>
                {availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Group {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Class Type <span className="text-emerald-400">*</span>
              </label>
              <select
                value={classType}
                onChange={(e) => setClassType(e.target.value as ClassType)}
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none font-semibold uppercase"
                disabled={saving}
              >
                <option value="theory">THEORY</option>
                <option value="lab">LAB</option>
              </select>
            </div>

            {/* Academic Year */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Academic Year
              </label>
              <Input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2024-2028 or 2025-2026"
                disabled={saving}
              />
            </div>

            {/* Status (when editing) */}
            {initial && (
              <div className="md:col-span-2 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="offIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded accent-emerald-500 h-4 w-4"
                  disabled={saving}
                />
                <label htmlFor="offIsActive" className="text-xs text-slate-300 cursor-pointer">
                  Offering is Active for Timetable & Attendance Scheduling
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
            {saving ? "Saving..." : initial ? "Update Offering" : "Create Subject Offering"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
