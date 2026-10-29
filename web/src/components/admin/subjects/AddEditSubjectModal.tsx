"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api, Department, SubjectMaster } from "@/lib/api";

export default function AddEditSubjectModal({
  isOpen,
  onClose,
  onSave,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (d: any) => Promise<void> | void;
  initial?: SubjectMaster | null;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [credits, setCredits] = useState<number>(4);
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [isActive, setIsActive] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSaving(false);
      api.academic
        .getDepartments()
        .then((res) => setDepartments(res || []))
        .catch(() => setDepartments([]));

      if (initial) {
        setName(initial.name || "");
        setCode(initial.code || "");
        setDescription(initial.description || "");
        setCredits(initial.credits || 4);
        setDepartmentId(initial.department_id ?? "");
        setIsActive(initial.is_active !== false);
      } else {
        setName("");
        setCode("");
        setDescription("");
        setCredits(4);
        setDepartmentId("");
        setIsActive(true);
      }
    }
  }, [initial, isOpen]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Subject Name is required.");
      return;
    }
    if (!code.trim()) {
      setError("Subject Code is required.");
      return;
    }
    if (credits < 1 || credits > 10) {
      setError("Credits must be between 1 and 10.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: any = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        credits: Number(credits),
        description: description.trim() || undefined,
        department_id: departmentId ? Number(departmentId) : undefined,
        is_active: isActive,
      };
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save master subject.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? "Edit Master Subject" : "Add Master Subject"}
      description="Define central catalog subjects reusable across semesters and branches."
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Subject Name <span className="text-emerald-400">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="e.g. Data Structures & Algorithms"
            disabled={saving}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Subject Code <span className="text-emerald-400">*</span>
            </label>
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              placeholder="e.g. CS201"
              disabled={saving}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Credits (1–10) <span className="text-emerald-400">*</span>
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={String(credits)}
              onChange={(e) => setCredits(Number(e.target.value || 0))}
              disabled={saving}
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Department
          </label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-xl border border-slate-800 bg-surface-900 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            disabled={saving}
          >
            <option value="">Select Department or General...</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief course objectives and syllabus overview..."
            disabled={saving}
          />
        </div>

        {initial && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="subIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded accent-emerald-500 h-4 w-4"
              disabled={saving}
            />
            <label htmlFor="subIsActive" className="text-xs text-slate-300 cursor-pointer">
              Subject is Active in Curriculum
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-800/80">
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : initial ? "Update Subject" : "Create Master Subject"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
