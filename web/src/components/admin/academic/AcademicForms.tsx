"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Course,
  Department,
  Branch,
  Batch,
  Section,
  StudentGroup,
  AcademicEnrollment,
  StudentDetail,
  api,
} from "@/lib/api";
import { Loader2, AlertCircle } from "lucide-react";

// ============================================================================
// 1. Course Modal
// ============================================================================
export function CourseModal({
  isOpen,
  onClose,
  onSuccess,
  course,
  collegeId = 1,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  course?: Course | null;
  collegeId?: number;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [durationYears, setDurationYears] = useState(4);
  const [totalSemesters, setTotalSemesters] = useState(8);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (course) {
      setName(course.name);
      setCode(course.code);
      setDurationYears(course.duration_years ?? 4);
      setTotalSemesters(course.total_semesters);
      setIsActive(course.is_active);
    } else {
      setName("");
      setCode("");
      setDurationYears(4);
      setTotalSemesters(8);
      setIsActive(true);
    }
    setError(null);
  }, [course, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError("Course Name and Course Code are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (course) {
        await api.academic.updateCourse(course.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          duration_years: Number(durationYears),
          total_semesters: Number(totalSemesters),
          is_active: isActive,
        });
      } else {
        await api.academic.createCourse({
          college_id: collegeId,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          total_semesters: Number(totalSemesters),
        });
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save course");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={course ? "Edit Course" : "Add New Course"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Course Name <span className="text-red-400">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bachelor of Technology"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Course Code <span className="text-red-400">*</span>
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. BTECH"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Duration (Years)
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={durationYears}
              onChange={(e) => {
                const y = Number(e.target.value);
                setDurationYears(y);
                setTotalSemesters(y * 2);
              }}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Total Semesters
            </label>
            <Input
              type="number"
              min={1}
              max={20}
              value={totalSemesters}
              onChange={(e) => setTotalSemesters(Number(e.target.value))}
              required
            />
          </div>
        </div>

        {course && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="course-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500/20"
            />
            <label htmlFor="course-active" className="text-xs text-slate-300">
              Active status
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : course ? "Update Course" : "Create Course"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// 2. Department Modal
// ============================================================================
export function DepartmentModal({
  isOpen,
  onClose,
  onSuccess,
  department,
  parentCourse,
  collegeId = 1,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  department?: Department | null;
  parentCourse: Course;
  collegeId?: number;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (department) {
      setName(department.name);
      setCode(department.code);
      setIsActive(department.is_active);
    } else {
      setName("");
      setCode("");
      setIsActive(true);
    }
    setError(null);
  }, [department, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError("Department Name and Code are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (department) {
        await api.academic.updateDepartment(department.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          course_id: parentCourse.id,
          is_active: isActive,
        });
      } else {
        await api.academic.createDepartment({
          college_id: collegeId,
          course_id: parentCourse.id,
          name: name.trim(),
          code: code.trim().toUpperCase(),
        });
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save department");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={department ? "Edit Department" : "Add Department"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
          <span className="text-slate-500 block mb-0.5">Parent Course:</span>
          <span className="font-semibold text-white">{parentCourse.name}</span>
          <span className="font-mono text-[10px] text-emerald-400 ml-1.5 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/20">
            {parentCourse.code}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Department Name <span className="text-red-400">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Computer Science & Engineering"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Department Code <span className="text-red-400">*</span>
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. CSE"
            required
          />
        </div>

        {department && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="dept-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500/20"
            />
            <label htmlFor="dept-active" className="text-xs text-slate-300">
              Active status
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : department ? "Update Department" : "Create Department"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// 3. Branch Modal
// ============================================================================
export function BranchModal({
  isOpen,
  onClose,
  onSuccess,
  branch,
  parentDepartment,
  parentCourse,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  branch?: Branch | null;
  parentDepartment: Department;
  parentCourse: Course;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branch) {
      setName(branch.name);
      setCode(branch.code);
      setIsActive(branch.is_active);
    } else {
      setName("");
      setCode("");
      setIsActive(true);
    }
    setError(null);
  }, [branch, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError("Branch Name and Code are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (branch) {
        await api.academic.updateBranch(branch.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          department_id: parentDepartment.id,
          course_id: parentCourse.id,
          is_active: isActive,
        });
      } else {
        await api.academic.createBranch({
          department_id: parentDepartment.id,
          course_id: parentCourse.id,
          name: name.trim(),
          code: code.trim().toUpperCase(),
        });
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save branch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={branch ? "Edit Branch" : "Add Branch"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-1">
          <div>
            <span className="text-slate-500">Department: </span>
            <span className="font-semibold text-white">{parentDepartment.name} ({parentDepartment.code})</span>
          </div>
          <div>
            <span className="text-slate-500">Course: </span>
            <span className="font-semibold text-white">{parentCourse.name} ({parentCourse.code})</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Branch Name <span className="text-red-400">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Computer Science & Design"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Branch Code <span className="text-red-400">*</span>
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. CSD"
            required
          />
        </div>

        {branch && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="branch-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500/20"
            />
            <label htmlFor="branch-active" className="text-xs text-slate-300">
              Active status
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : branch ? "Update Branch" : "Create Branch"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// 4. Batch Modal
// ============================================================================
export function BatchModal({
  isOpen,
  onClose,
  onSuccess,
  batch,
  parentBranch,
  courseDuration = 4,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  batch?: Batch | null;
  parentBranch: Branch;
  courseDuration?: number;
}) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState("");
  const [startYear, setStartYear] = useState(currentYear);
  const [endYear, setEndYear] = useState(currentYear + courseDuration);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (batch) {
      setName(batch.name);
      setStartYear(batch.start_year);
      setEndYear(batch.end_year);
      setIsActive(batch.is_active);
    } else {
      setStartYear(currentYear);
      setEndYear(currentYear + courseDuration);
      setName(`${currentYear}-${currentYear + courseDuration}`);
      setIsActive(true);
    }
    setError(null);
  }, [batch, isOpen, courseDuration, currentYear]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (startYear >= endYear) {
      setError("Start Year (Admission) must be earlier than End Year (Graduation).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (batch) {
        await api.academic.updateBatch(batch.id, {
          name: name.trim() || `${startYear}-${endYear}`,
          start_year: Number(startYear),
          end_year: Number(endYear),
          branch_id: parentBranch.id,
          is_active: isActive,
        });
      } else {
        await api.academic.createBatch({
          branch_id: parentBranch.id,
          start_year: Number(startYear),
          end_year: Number(endYear),
        });
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save batch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={batch ? "Edit Academic Batch" : "Add Academic Batch"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
          <span className="text-slate-500 block mb-0.5">Parent Branch:</span>
          <span className="font-semibold text-white">{parentBranch.name}</span>
          <span className="font-mono text-[10px] text-purple-400 ml-1.5 bg-purple-950/60 px-1 py-0.2 rounded border border-purple-500/20">
            {parentBranch.code}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Admission Year <span className="text-red-400">*</span>
            </label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={startYear}
              onChange={(e) => {
                const s = Number(e.target.value);
                setStartYear(s);
                setName(`${s}-${endYear}`);
              }}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Graduation Year <span className="text-red-400">*</span>
            </label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={endYear}
              onChange={(e) => {
                const en = Number(e.target.value);
                setEndYear(en);
                setName(`${startYear}-${en}`);
              }}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Batch Name / Label
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 2024-2028"
          />
        </div>

        {batch && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="batch-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500/20"
            />
            <label htmlFor="batch-active" className="text-xs text-slate-300">
              Active status
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : batch ? "Update Batch" : "Create Batch"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// 5. Section Modal
// ============================================================================
export function SectionModal({
  isOpen,
  onClose,
  onSuccess,
  section,
  parentBatch,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  section?: Section | null;
  parentBatch: Batch;
}) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(60);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (section) {
      setName(section.name);
      setCapacity(section.capacity ?? 60);
      setIsActive(section.is_active);
    } else {
      setName("");
      setCapacity(60);
      setIsActive(true);
    }
    setError(null);
  }, [section, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Section Name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (section) {
        await api.academic.updateSection(section.id, {
          name: name.trim().toUpperCase(),
          capacity: Number(capacity),
          batch_id: parentBatch.id,
          is_active: isActive,
        });
      } else {
        await api.academic.createSection({
          batch_id: parentBatch.id,
          name: name.trim().toUpperCase(),
        });
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save section");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={section ? "Edit Section" : "Add Section"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
          <span className="text-slate-500 block mb-0.5">Parent Batch:</span>
          <span className="font-semibold text-white">{parentBatch.name}</span>
          <span className="text-slate-400 ml-1.5 text-[11px]">
            ({parentBatch.start_year}–{parentBatch.end_year})
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Section Name <span className="text-red-400">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder="e.g. A or CSD-A"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Max Student Capacity
          </label>
          <Input
            type="number"
            min={1}
            max={300}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            required
          />
        </div>

        {section && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="section-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500/20"
            />
            <label htmlFor="section-active" className="text-xs text-slate-300">
              Active status
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : section ? "Update Section" : "Create Section"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// 6. Student Group Modal (B1, B2)
// ============================================================================
export function StudentGroupModal({
  isOpen,
  onClose,
  onSuccess,
  group,
  parentSection,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  group?: StudentGroup | null;
  parentSection: Section;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? "");
      setIsActive(group.is_active);
    } else {
      setName("");
      setDescription("");
      setIsActive(true);
    }
    setError(null);
  }, [group, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group Name is required (e.g. B1, B2).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (group) {
        await api.academic.updateStudentGroup(group.id, {
          name: name.trim().toUpperCase(),
          description: description.trim() || undefined,
          is_active: isActive,
        });
      } else {
        await api.academic.createStudentGroup({
          section_id: parentSection.id,
          name: name.trim().toUpperCase(),
        });
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save student group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={group ? "Edit Student Group" : "Add Student Group"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
          <span className="text-slate-500 block mb-0.5">Parent Section:</span>
          <span className="font-semibold text-white">{parentSection.name}</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Group Name / Code <span className="text-red-400">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder="e.g. B1 or B2"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Description / Lab Group Details
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Practical Lab Group 1"
          />
        </div>

        {group && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="group-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500/20"
            />
            <label htmlFor="group-active" className="text-xs text-slate-300">
              Active status
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : group ? "Update Group" : "Create Group"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// 7. Enrollment Modal (Enroll Student into Hierarchy)
// ============================================================================
export function EnrollmentModal({
  isOpen,
  onClose,
  onSuccess,
  enrollment,
  parentCourse,
  parentBranch,
  parentBatch,
  parentSection,
  parentGroup,
  availableGroups = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  enrollment?: AcademicEnrollment | null;
  parentCourse: Course;
  parentBranch: Branch;
  parentBatch: Batch;
  parentSection: Section;
  parentGroup?: StudentGroup | null;
  availableGroups?: StudentGroup[];
}) {
  const [studentId, setStudentId] = useState<number | "">("");
  const [groupId, setGroupId] = useState<number | "">(parentGroup?.id ?? "");
  const [semester, setSemester] = useState(1);
  const [academicYear, setAcademicYear] = useState("2024-2025");
  const [status, setStatus] = useState("active");
  const [isCurrent, setIsCurrent] = useState(true);

  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStudents();
    }
  }, [isOpen]);

  async function loadStudents() {
    setStudentsLoading(true);
    try {
      const data = await api.students.getStudents();
      setStudents(data || []);
      if (!enrollment && data && data.length > 0) {
        setStudentId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setStudentsLoading(false);
    }
  }

  useEffect(() => {
    if (enrollment) {
      setStudentId(enrollment.student_id);
      setGroupId(enrollment.student_group_id ?? "");
      setSemester(enrollment.semester);
      setAcademicYear(enrollment.academic_year);
      setStatus(enrollment.status);
      setIsCurrent(enrollment.is_current);
    } else {
      setGroupId(parentGroup?.id ?? (availableGroups[0]?.id ?? ""));
      setSemester(1);
      setAcademicYear("2024-2025");
      setStatus("active");
      setIsCurrent(true);
    }
    setError(null);
  }, [enrollment, parentGroup, availableGroups, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      setError("Please select a student.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (enrollment) {
        await api.academic.updateEnrollment(enrollment.id, {
          student_group_id: groupId ? Number(groupId) : undefined,
          semester: Number(semester),
          academic_year: academicYear.trim(),
          status,
          is_current: isCurrent,
        });
      } else {
        await api.academic.createEnrollment({
          student_id: Number(studentId),
          course_id: parentCourse.id,
          branch_id: parentBranch.id,
          batch_id: parentBatch.id,
          section_id: parentSection.id,
          student_group_id: groupId ? Number(groupId) : null,
          semester: Number(semester),
          academic_year: academicYear.trim(),
          status,
          is_current: isCurrent,
        });
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save student enrollment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={enrollment ? "Edit Student Enrollment" : "Enroll Student"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Bound Scope */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Course / Branch:</span>
            <span className="font-semibold text-white">{parentCourse.code} • {parentBranch.code}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Batch / Section:</span>
            <span className="font-semibold text-white">{parentBatch.name} • {parentSection.name}</span>
          </div>
        </div>

        {/* Student Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Student Profile <span className="text-red-400">*</span>
          </label>
          {enrollment ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
              <div className="font-semibold">{enrollment.student_name ?? `Student ID #${enrollment.student_id}`}</div>
              <div className="font-mono text-slate-400 text-[11px]">{enrollment.student_roll_number} • {enrollment.student_email}</div>
            </div>
          ) : studentsLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading students directory...
            </div>
          ) : (
            <select
              value={studentId}
              onChange={(e) => setStudentId(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              required
            >
              <option value="" disabled>Select Student</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.full_name} ({st.roll_number}) — {st.email}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Group Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Student Group (Optional)
          </label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">None (Whole Section)</option>
            {availableGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} {g.description ? `(${g.description})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Semester <span className="text-red-400">*</span>
            </label>
            <Input
              type="number"
              min={1}
              max={parentCourse.total_semesters || 8}
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Academic Year <span className="text-red-400">*</span>
            </label>
            <Input
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="e.g. 2024-2025"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Enrollment Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="enr-current"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500/20"
            />
            <label htmlFor="enr-current" className="text-xs text-slate-300">
              Current Enrollment
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : enrollment ? "Update Enrollment" : "Confirm Enrollment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
