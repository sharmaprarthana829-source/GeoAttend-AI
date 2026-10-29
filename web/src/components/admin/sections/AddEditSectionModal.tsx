"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createSection, updateSection, Section } from "@/lib/sections";

export default function AddEditSectionModal({ isOpen, onClose, onSave, initial }: { isOpen: boolean; onClose: () => void; onSave: (d: Section) => void; initial?: Section | null }) {
  const [name, setName] = useState("");
  const [batchId, setBatchId] = useState<number>(2);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name || "");
      setBatchId(initial.batch_id || 2);
    } else {
      setName(""); setBatchId(2);
    }
  }, [initial, isOpen]);

  async function handleSave() {
    setSaving(true);
    try {
      if (initial) {
        const updated = await updateSection(initial.id, { name, batch_id: batchId });
        onSave(updated);
      } else {
        const created = await createSection({ name, batch_id: batchId });
        onSave(created);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit Section" : "Add Section"} description={initial ? "Update section details" : "Create a new section"}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Section Name <span className="text-emerald-400">*</span>
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CSD-A" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Batch ID <span className="text-emerald-400">*</span>
          </label>
          <Input type="number" value={String(batchId)} onChange={(e) => setBatchId(Number(e.target.value || 1))} placeholder="e.g. 1" />
        </div>

        <div className="flex items-center justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
