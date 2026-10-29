"use client";

import React, { useEffect, useState } from "react";
import {
  listFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  Faculty,
} from "@/lib/faculty";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import AddEditFacultyModal from "./AddEditFacultyModal";
import { Trash2, AlertTriangle, CheckCircle2, XCircle, X } from "lucide-react";
import FacultyProfileDrawer from "./ProfileDrawer";

export default function FacultyTable() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Faculty | null>(null);
  const [deleteItem, setDeleteItem] = useState<Faculty | null>(null);
  const [profileItem, setProfileItem] = useState<Faculty | null>(null);

  const reloadData = async () => {
    setLoading(true);
    try {
      const res = await listFaculty({ page, per_page: perPage, q: query });
      setFaculty(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load faculty:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, [page, perPage, query]);

  useEffect(() => {
    if (selectAll) {
      const map: Record<number, boolean> = {};
      faculty.forEach((f) => (map[f.id] = true));
      setSelected(map);
    } else setSelected({});
  }, [selectAll, faculty]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  function applySort(field: string) {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  const sorted = React.useMemo(() => {
    if (!sortBy) return faculty;
    const arr = [...faculty];
    arr.sort((a: any, b: any) => {
      const va = a[sortBy as keyof Faculty];
      const vb = b[sortBy as keyof Faculty];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number")
        return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [faculty, sortBy, sortDir]);

  async function handleCreateFaculty(data: any) {
    await createFaculty(data);
    await reloadData();
  }

  async function handleUpdateFaculty(data: any) {
    if (!editItem) return;
    await updateFaculty(editItem.id, data);
    setEditItem(null);
    await reloadData();
  }

  async function handleDeleteFaculty(force: boolean = false) {
    if (!deleteItem) return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await deleteFaculty(deleteItem.id, force);
      setActionSuccess(res?.message || `Faculty ${deleteItem.full_name} processed.`);
      setDeleteItem(null);
      await reloadData();
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes("not found")) {
        setActionSuccess(`Faculty member was already removed or updated.`);
        setDeleteItem(null);
        await reloadData();
      } else {
        setActionError(err?.message || "Failed to delete faculty member");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="p-4">
      {actionSuccess && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, email, dept..."
          />
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => reloadData()}>
            Refresh
          </Button>
          <Button onClick={() => setShowAdd(true)}>+ Add Faculty</Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-800/60 sticky top-0 z-10 bg-surface-900/90 backdrop-blur-md">
              <th className="py-3 pr-4 w-6">
                <input
                  aria-label="Select all"
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => setSelectAll(e.target.checked)}
                />
              </th>
              <th
                className="py-3 pr-4 cursor-pointer"
                onClick={() => applySort("faculty_id")}
              >
                Faculty ID
              </th>
              <th
                className="py-3 pr-4 cursor-pointer"
                onClick={() => applySort("full_name")}
              >
                Name
              </th>
              <th className="py-3 pr-4">Email</th>
              <th className="py-3 pr-4">Phone</th>
              <th className="py-3 pr-4">Department</th>
              <th className="py-3 pr-4">Designation</th>
              <th className="py-3 pr-4">Subjects</th>
              <th className="py-3 pr-4">Assigned Sections</th>
              <th className="py-3 pr-4">Today's Sessions</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className={cn("divide-y divide-slate-800/60", loading && "opacity-70")}>
            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400">
                  No faculty found — click "+ Add Faculty" to create one.
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={12} className="py-8">
                  <div className="h-2 w-full bg-slate-800/40 rounded animate-pulse" />
                </td>
              </tr>
            )}

            {sorted.map((f) => (
              <tr key={f.id} className="hover:bg-surface-800/40 transition-colors">
                <td className="py-3 pr-4">
                  <input
                    aria-label={`Select ${f.full_name}`}
                    type="checkbox"
                    checked={!!selected[f.id]}
                    onChange={() => toggleSelect(f.id)}
                  />
                </td>
                <td className="py-3 pr-4 font-mono font-medium text-emerald-400">
                  {f.faculty_id}
                </td>
                <td className="py-3 pr-4 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-xs font-semibold">
                    {f.full_name ? f.full_name.trim()[0]?.toUpperCase() : "F"}
                  </div>
                  <div className="font-medium text-slate-100">{f.full_name}</div>
                </td>
                <td className="py-3 pr-4 text-slate-300">{f.email}</td>
                <td className="py-3 pr-4 text-slate-400">{f.phone || "—"}</td>
                <td className="py-3 pr-4 text-slate-300">{f.department || "General"}</td>
                <td className="py-3 pr-4 text-slate-300">{f.designation || "Faculty"}</td>
                <td className="py-3 pr-4 text-slate-400">
                  {(f.subjects || []).length > 0 ? (f.subjects || []).join(", ") : "—"}
                </td>
                <td className="py-3 pr-4 text-slate-400">
                  {(f.sections_assigned || []).length > 0
                    ? (f.sections_assigned || []).join(", ")
                    : "—"}
                </td>
                <td className="py-3 pr-4 font-mono text-center">
                  <span className="px-2 py-0.5 rounded bg-surface-800 text-slate-300">
                    {f.todays_sessions || 0}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1",
                      f.is_active
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        f.is_active ? "bg-emerald-400" : "bg-rose-400"
                      )}
                    />
                    {f.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProfileItem(f)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditItem(f)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteItem(f)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          Showing {faculty.length} of {total} faculty members
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </Button>
          <div className="text-sm px-2">Page {page}</div>
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={faculty.length < perPage}
          >
            Next
          </Button>
        </div>
      </div>

      <AddEditFacultyModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleCreateFaculty}
      />
      <AddEditFacultyModal
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        onSave={handleUpdateFaculty}
        initial={editItem || undefined}
      />
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-400" />
              Delete Faculty Profile
            </h3>

            <p className="mt-2 text-xs text-slate-300">
              Faculty: <strong className="text-white">{deleteItem.full_name}</strong> (Employee ID:{" "}
              <span className="font-mono text-emerald-400">{deleteItem.faculty_id}</span>)
            </p>

            {(() => {
              const sessionCount = (deleteItem.total_sessions ?? 0) || (deleteItem.todays_sessions ?? 0);
              const hasSessions = sessionCount > 0;

              return (
                <>
                  {hasSessions ? (
                    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-amber-400">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        Historical Attendance Sessions Exist ({sessionCount} session{sessionCount > 1 ? "s" : ""})
                      </div>
                      <p>
                        This faculty member has conducted attendance sessions. Deactivating preserves historical class metrics for institutional accreditation.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                      <p>
                        Permanent deletion will safely remove this faculty member, their assignments, responsibilities, and login credentials.
                      </p>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDeleteItem(null)} disabled={deleting}>
                      Cancel
                    </Button>

                    {hasSessions ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                          onClick={() => handleDeleteFaculty(false)}
                          disabled={deleting}
                        >
                          {deleting ? "Processing..." : "Deactivate Instead"}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteFaculty(true)}
                          disabled={deleting}
                        >
                          {deleting ? "Deleting..." : "Force Delete (All Records)"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteFaculty(false)}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting..." : "Permanently Delete"}
                      </Button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      <FacultyProfileDrawer
        isOpen={!!profileItem}
        onClose={() => setProfileItem(null)}
        faculty={profileItem}
      />
    </Card>
  );
}
