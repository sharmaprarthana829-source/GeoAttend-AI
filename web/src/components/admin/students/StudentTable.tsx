"use client";

import React, { useEffect, useState } from "react";
import { listStudents, Student } from "@/lib/students";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import AddEditStudentModal from "./AddEditStudentModal";
import DeleteConfirm from "./DeleteConfirm";
import ProfileDrawer from "./ProfileDrawer";

export default function StudentTable() {
  const [students, setStudents] = useState<Student[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showAdd, setShowAdd] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [deleteStudent, setDeleteStudent] = useState<any>(null);
  const [profileStudent, setProfileStudent] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    listStudents({ page, per_page: perPage, q: query })
      .then((res) => {
        setStudents(res.data);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [page, perPage, query]);

  useEffect(() => {
    if (selectAll) {
      const map: Record<number, boolean> = {};
      students.forEach((s) => (map[s.id] = true));
      setSelected(map);
    } else {
      setSelected({});
    }
  }, [selectAll, students]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  function applySort(field: string) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  const sorted = React.useMemo(() => {
    if (!sortBy) return students;
    const arr = [...students];
    arr.sort((a: any, b: any) => {
      const va = a[sortBy as keyof Student];
      const vb = b[sortBy as keyof Student];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [students, sortBy, sortDir]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students..." />
          <Button variant="outline" onClick={() => { setQuery(""); setPage(1); }}>Clear</Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline">Import CSV</Button>
          <Button variant="outline">Export CSV</Button>
          <Button onClick={() => { setPage(1); }}>Refresh</Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-800/60 sticky top-0 z-10 bg-surface-900/90 backdrop-blur-md">
              <th className="py-3 pr-4 w-6"><input aria-label="Select all" type="checkbox" checked={selectAll} onChange={(e) => setSelectAll(e.target.checked)} /></th>
              <th className="py-3 pr-4 cursor-pointer" onClick={() => applySort("student_id")}>Student ID</th>
              <th className="py-3 pr-4 cursor-pointer" onClick={() => applySort("full_name")}>Name</th>
              <th className="py-3 pr-4">Email</th>
              <th className="py-3 pr-4">Phone</th>
              <th className="py-3 pr-4">Department</th>
              <th className="py-3 pr-4">Branch</th>
              <th className="py-3 pr-4">Section</th>
              <th className="py-3 pr-4">Semester</th>
              <th className="py-3 pr-4 cursor-pointer" onClick={() => applySort("attendance_percent")}>Attendance %</th>
              <th className="py-3 pr-4">GPS Status</th>
              <th className="py-3 pr-4">Device Status</th>
              <th className="py-3 pr-4">Last Check-in</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className={cn("divide-y divide-slate-800/60", loading && "opacity-70") }>
            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={15} className="py-12 text-center text-slate-400">No students found — try adjusting filters or import students.</td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={15} className="py-8">
                  <div className="h-2 w-full bg-slate-800/40 rounded animate-pulse" />
                </td>
              </tr>
            )}

            {sorted.map((s) => (
              <tr key={s.id} className="hover:bg-surface-800/40 transition-colors">
                <td className="py-3 pr-4"><input aria-label={`Select ${s.full_name}`} type="checkbox" checked={!!selected[s.id]} onChange={() => toggleSelect(s.id)} /></td>
                <td className="py-3 pr-4">{s.student_id}</td>
                <td className="py-3 pr-4 flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-slate-700/30 flex items-center justify-center text-xs">{s.full_name.split(" ")[0][0]}</div><div>{s.full_name}</div></td>
                <td className="py-3 pr-4">{s.email}</td>
                <td className="py-3 pr-4">{s.device_status ? "(phone)" : "—"}</td>
                <td className="py-3 pr-4">{s.department}</td>
                <td className="py-3 pr-4">{s.branch || "CSD"}</td>
                <td className="py-3 pr-4">{s.section}</td>
                <td className="py-3 pr-4">{s.semester}</td>
                <td className="py-3 pr-4">{s.attendance_percent}%</td>
                <td className="py-3 pr-4">{s.device_status === "Active" ? "GPS OK" : "GPS N/A"}</td>
                <td className="py-3 pr-4">{s.device_status}</td>
                <td className="py-3 pr-4">{new Date(s.last_checkin || Date.now()).toLocaleString()}</td>
                <td className="py-3 pr-4">{s.is_active ? "Active" : "Inactive"}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setProfileStudent(s)}>View</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditStudent(s)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteStudent(s)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-400">Showing {students.length} of {total} students</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
          <div className="text-sm">Page {page}</div>
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <AddEditStudentModal isOpen={showAdd} onClose={() => setShowAdd(false)} onSave={(d) => console.log("save", d)} />
      <AddEditStudentModal isOpen={!!editStudent} onClose={() => setEditStudent(null)} onSave={(d) => console.log("edit", d)} initial={editStudent} />
      <DeleteConfirm isOpen={!!deleteStudent} onClose={() => setDeleteStudent(null)} onConfirm={() => console.log("delete", deleteStudent)} name={deleteStudent?.full_name} />
      <ProfileDrawer isOpen={!!profileStudent} onClose={() => setProfileStudent(null)} student={profileStudent} />
    </Card>
  );
}
