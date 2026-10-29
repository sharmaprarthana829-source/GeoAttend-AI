"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { api, FacultyAssignment } from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function FacultySubjectsTable() {
  const { user } = useDashboard();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const assign = await api.subjects.getMyAssignments();
        if (!active) return;
        setAssignments(assign);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user]);

  const visible = assignments.filter((a) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const name = a.subject_offering?.subject_name || "";
    const code = a.subject_offering?.subject_code || "";
    return name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assigned subjects..." />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-800/60 sticky top-0 z-10 bg-surface-900/90 backdrop-blur-md">
              <th className="py-3 pr-4">Code</th>
              <th className="py-3 pr-4">Subject Name</th>
              <th className="py-3 pr-4">Class Type</th>
              <th className="py-3 pr-4">Section / Group</th>
              <th className="py-3 pr-4">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading && (
              <tr>
                <td colSpan={5} className="py-8">
                  <div className="h-2 w-full bg-slate-800/40 rounded animate-pulse" />
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No assigned subjects found.
                </td>
              </tr>
            )}

            {visible.map((a) => (
              <tr key={a.id} className="hover:bg-surface-800/40 transition-colors">
                <td className="py-3 pr-4 font-mono text-xs text-slate-300">
                  {a.subject_offering?.subject_code || "CS201"}
                </td>
                <td className="py-3 pr-4 font-medium text-white">
                  {a.subject_offering?.subject_name || "Data Structures"}
                </td>
                <td className="py-3 pr-4">
                  <span className="px-2 py-0.5 rounded text-xs uppercase bg-surface-800 text-slate-300">
                    {a.subject_offering?.class_type || "Theory"}
                  </span>
                </td>
                <td className="py-3 pr-4 text-xs text-slate-300">
                  {a.subject_offering?.section_name || "CSD-A"}
                  {a.subject_offering?.student_group_name ? ` (Group ${a.subject_offering.student_group_name})` : " (Whole Section)"}
                </td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    a.is_primary ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20" : "bg-surface-800 text-slate-400"
                  }`}>
                    {a.is_primary ? "Primary Faculty" : "Assistant Faculty"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
