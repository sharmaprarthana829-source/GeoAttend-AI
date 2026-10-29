"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function StudentsHeader({
  total,
  lastUpdated,
  onAdd,
}: {
  total: number;
  lastUpdated?: string;
  onAdd?: () => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <nav className="text-xs text-slate-500" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>Admin</li>
            <li>▸</li>
            <li className="text-slate-300">Students</li>
          </ol>
        </nav>
        <h1 className="mt-2 text-2xl font-semibold">Student Management</h1>
        <p className="mt-1 text-sm text-slate-400">Manage students, imports, exports and profiles.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm text-slate-400">Total students</p>
          <p className="text-lg font-semibold">{total}</p>
          <p className="text-xs text-slate-500">Last updated: {lastUpdated ? formatDate(new Date(lastUpdated)) : "—"}</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={onAdd}>
          Add Student
        </Button>
      </div>
    </div>
  );
}
