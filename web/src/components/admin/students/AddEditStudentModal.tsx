"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function AddEditStudentModal({
  isOpen,
  onClose,
  onSave,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initial?: any;
}) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    setForm(initial || {});
  }, [initial]);

  function update(name: string, value: any) {
    setForm((f: any) => ({ ...f, [name]: value }));
  }

  function save() {
    // basic validation
    if (!form.student_id || !form.full_name || !form.email) return;
    onSave(form);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit Student" : "Add Student"} maxWidth="lg">
      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="Student ID" value={form.student_id || ""} onChange={(e) => update("student_id", e.target.value)} />
        <Input placeholder="Full name" value={form.full_name || ""} onChange={(e) => update("full_name", e.target.value)} />
        <Input placeholder="Email" value={form.email || ""} onChange={(e) => update("email", e.target.value)} />
        <Input placeholder="Phone" value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} />
        <Input placeholder="Department" value={form.department || ""} onChange={(e) => update("department", e.target.value)} />
        <Input placeholder="Branch" value={form.branch || ""} onChange={(e) => update("branch", e.target.value)} />
        <Input placeholder="Section" value={form.section || ""} onChange={(e) => update("section", e.target.value)} />
        <Input placeholder="Semester" value={form.semester || ""} onChange={(e) => update("semester", e.target.value)} />
        <Input placeholder="Device ID" value={form.device_id || ""} onChange={(e) => update("device_id", e.target.value)} />
        <Input placeholder="Password" value={form.password || ""} onChange={(e) => update("password", e.target.value)} type="password" />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save</Button>
      </div>
    </Modal>
  );
}
