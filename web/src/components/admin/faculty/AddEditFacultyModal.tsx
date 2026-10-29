"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api, Department } from "@/lib/api";

export default function AddEditFacultyModal({
  isOpen,
  onClose,
  onSave,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (d: any) => Promise<void> | void;
  initial?: any;
}) {
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (isOpen) {
      setForm(initial ? { ...initial } : { password: "Faculty@12345" });
      setError("");
      setSaving(false);
      api.academic
        .getDepartments()
        .then((depts) => setDepartments(depts || []))
        .catch(() => setDepartments([]));
    }
  }, [initial, isOpen]);

  function update(name: string, value: any) {
    setForm((f: any) => ({ ...f, [name]: value }));
    setError("");
  }

  async function save() {
    if (!form.faculty_id?.trim()) {
      setError("Faculty / Employee ID is required.");
      return;
    }
    if (!form.full_name?.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!form.email?.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!initial && (!form.password || form.password.length < 6)) {
      setError("Initial password must be at least 6 characters.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await onSave(form);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save faculty record. Please verify the input.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? "Edit Faculty Profile" : "Add Faculty"}
      description="Enter the faculty member's profile details, department, and academic responsibilities."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Faculty ID */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Faculty / Employee ID <span className="text-emerald-400">*</span>
            </label>
            <Input
              placeholder="e.g. FAC101"
              value={form.faculty_id || ""}
              onChange={(e) => update("faculty_id", e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Full Name <span className="text-emerald-400">*</span>
            </label>
            <Input
              placeholder="e.g. Dr. Priya Sharma"
              value={form.full_name || ""}
              onChange={(e) => update("full_name", e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              College Email <span className="text-emerald-400">*</span>
            </label>
            <Input
              type="email"
              placeholder="e.g. priya.sharma@college.edu"
              value={form.email || ""}
              onChange={(e) => update("email", e.target.value)}
              disabled={saving || (initial && initial.id)}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Phone Number
            </label>
            <Input
              type="tel"
              placeholder="e.g. +91 9876543210"
              value={form.phone || ""}
              onChange={(e) => update("phone", e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Department Selection */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Department
            </label>
            {departments.length > 0 ? (
              <select
                className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none transition-colors"
                value={form.department_id || ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  const deptObj = departments.find((d) => d.id === val);
                  setForm((f: any) => ({
                    ...f,
                    department_id: val,
                    department: deptObj ? deptObj.name : "",
                  }));
                  setError("");
                }}
                disabled={saving}
              >
                <option value="">Select Department or General...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="e.g. Computer Science & Engineering"
                value={form.department || ""}
                onChange={(e) => update("department", e.target.value)}
                disabled={saving}
              />
            )}
          </div>

          {/* Designation */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Designation
            </label>
            <Input
              placeholder="e.g. Associate Professor / HOD"
              value={form.designation || ""}
              onChange={(e) => update("designation", e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Subjects */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Subjects (comma separated)
            </label>
            <Input
              placeholder="e.g. Data Structures, AI, Networks"
              value={Array.isArray(form.subjects) ? form.subjects.join(", ") : form.subjects || ""}
              onChange={(e) =>
                update(
                  "subjects",
                  e.target.value
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                )
              }
              disabled={saving}
            />
          </div>

          {/* Assigned Sections */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Assigned Sections (comma separated)
            </label>
            <Input
              placeholder="e.g. CSD-A, CSD-B"
              value={
                Array.isArray(form.sections_assigned)
                  ? form.sections_assigned.join(", ")
                  : form.sections_assigned || ""
              }
              onChange={(e) =>
                update(
                  "sections_assigned",
                  e.target.value
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                )
              }
              disabled={saving}
            />
          </div>

          {/* Password (only for new faculty) */}
          {!initial && (
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Initial Password <span className="text-emerald-400">*</span>
              </label>
              <Input
                type="password"
                placeholder="Min 6 characters (e.g. Faculty@12345)"
                value={form.password || ""}
                onChange={(e) => update("password", e.target.value)}
                disabled={saving}
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800/80 pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : initial ? "Update Faculty" : "Save Faculty"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
