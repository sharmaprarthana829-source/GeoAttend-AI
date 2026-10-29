"use client";

import React from "react";
import DepartmentTable from "@/components/admin/departments/DepartmentTable";
import { Card } from "@/components/ui/Card";

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-2">Dashboard / Departments</nav>
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="text-sm text-slate-400 mt-1">Manage college departments.</p>
        </div>
      </div>

      <Card>
        <DepartmentTable />
      </Card>
    </div>
  );
}
