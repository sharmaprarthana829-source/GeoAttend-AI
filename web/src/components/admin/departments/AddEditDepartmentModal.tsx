"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createDepartment, updateDepartment, Department } from "@/lib/departments";

export default function AddEditDepartmentModal({ isOpen, onClose, onSave, initial }: { isOpen: boolean; onClose: () => void; onSave: (d: Department) => void; initial?: Department | null }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name || "");
      setCode(initial.code || "");
    } else {
      setName(""); setCode("");
    }
  }, [initial, isOpen]);

  async function handleSave() {
    setSaving(true);
    try {
      if (initial) {
        const updated = await updateDepartment(initial.id, { name, code });
        onSave(updated);
      } else {
        const created = await createDepartment({ name, code });
        onSave(created);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit Department" : "Add Department"} description={initial ? "Update department details" : "Create a new department"}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Department Name <span className="text-emerald-400">*</span>
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Computer Science & Engineering" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Department Code <span className="text-emerald-400">*</span>
          </label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CSE" />
        </div>

        <div className="flex items-center justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
