"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function FiltersPanel({
  filters,
  onChange,
  onReset,
}: {
  filters: any;
  onChange: (name: string, value: any) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-surface-900/60 p-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Input placeholder="Student ID" value={filters.student_id || ""} onChange={(e) => onChange("student_id", e.target.value)} />
        <Input placeholder="Name" value={filters.name || ""} onChange={(e) => onChange("name", e.target.value)} />
        <Input placeholder="Email" value={filters.email || ""} onChange={(e) => onChange("email", e.target.value)} />
        <Input placeholder="Department" value={filters.department || ""} onChange={(e) => onChange("department", e.target.value)} />
        <Input placeholder="Branch" value={filters.branch || ""} onChange={(e) => onChange("branch", e.target.value)} />
        <Input placeholder="Section" value={filters.section || ""} onChange={(e) => onChange("section", e.target.value)} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button onClick={() => onReset()} variant="outline">Reset Filters</Button>
        <Button onClick={() => onChange("apply", true)}>Apply</Button>
      </div>
    </div>
  );
}
