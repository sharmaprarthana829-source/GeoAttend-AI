"use client";

import React from "react";
import SectionTable from "@/components/admin/sections/SectionTable";
import { Card } from "@/components/ui/Card";

export default function SectionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-2">Dashboard / Sections</nav>
          <h1 className="text-2xl font-semibold">Sections</h1>
          <p className="text-sm text-slate-400 mt-1">Manage class sections.</p>
        </div>
      </div>

      <Card>
        <SectionTable />
      </Card>
    </div>
  );
}
