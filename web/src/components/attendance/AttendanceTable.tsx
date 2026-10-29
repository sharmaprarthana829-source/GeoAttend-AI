"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { listSessions, AttendanceSession, startSession, endSession, createSession } from "@/lib/attendance";
import CreateSessionModal from "./CreateSessionModal";
import SessionDrawer from "./SessionDrawer";
import { useDashboard } from "@/components/dashboard/DashboardContext";

export default function AttendanceTable({ role }: { role: "admin" | "faculty" | "student" }) {
  const { user } = useDashboard();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<AttendanceSession | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        let onlyActive = false;
        if (role === "student") onlyActive = true;
        const res = await listSessions({ per_page: 100, q: query, onlyActive });
        if (!active) return;
        if (role === "student") {
          setItems(res.data.filter((s) => s.status === "active"));
        } else {
          setItems(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [role, query]);

  async function handleCreate(s: AttendanceSession) {
    setItems((prev) => [s, ...prev]);
    setShowCreate(false);
  }

  async function handleStart(s: AttendanceSession) {
    try {
      const updated = await startSession(s.id);
      setItems((prev) => prev.map((p) => (p.id === s.id ? { ...p, ...updated } : p)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleEnd(s: AttendanceSession) {
    try {
      const updated = await endSession(s.id);
      setItems((prev) => prev.map((p) => (p.id === s.id ? { ...p, ...updated } : p)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMark(s: AttendanceSession) {
    // For students: mark attendance locally
    if (!user) return;
    const p = { student_id: String(user.id || user.email), name: user.full_name || user.email, time: new Date().toISOString(), marked: true };
    setItems((prev) => prev.map((it) => (it.id === s.id ? { ...it, participants: [...(it.participants || []), p] } : it)));
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sessions..." />
        </div>

        <div className="flex items-center gap-2">
          {role !== "student" && <Button variant="outline" onClick={() => setShowCreate(true)}>Create Session</Button>}
          <Button onClick={() => { /* refresh */ setQuery((q)=>q) }}>Refresh</Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-800/60 sticky top-0 z-10 bg-surface-900/90 backdrop-blur-md">
              <th className="py-3 pr-4">Title</th>
              <th className="py-3 pr-4">Subject</th>
              <th className="py-3 pr-4">Start</th>
              <th className="py-3 pr-4">End</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Participants</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading && (
              <tr>
                <td colSpan={7} className="py-8">
                  <div className="h-2 w-full bg-slate-800/40 rounded animate-pulse" />
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">No sessions found.</td>
              </tr>
            )}

            {items.map((s) => (
              <tr key={s.id} className="hover:bg-surface-800/40 transition-colors">
                <td className="py-3 pr-4 font-medium">{s.subject_name || `Session #${s.id}`}</td>
                <td className="py-3 pr-4">{s.subject_name || "—"}</td>
                <td className="py-3 pr-4 font-mono text-xs">{s.session_date || "—"} {s.start_time ? s.start_time.slice(0, 5) : (s.started_at ? new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "")}</td>
                <td className="py-3 pr-4 font-mono text-xs">{s.end_time ? s.end_time.slice(0, 5) : (s.ended_at ? new Date(s.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—")}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                    s.status === "active" ? "bg-emerald-950 text-emerald-300" : "bg-surface-800 text-slate-400"
                  }`}>
                    {s.status}
                  </span>
                </td>
                <td className="py-3 pr-4">{s.total_enrolled ?? "—"}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelected(s)}>View</Button>
                    {role !== "student" && s.status !== "active" && <Button size="sm" onClick={() => handleStart(s)}>Start</Button>}
                    {role !== "student" && s.status === "active" && <Button size="sm" variant="danger" onClick={() => handleEnd(s)}>End</Button>}
                    {role === "student" && s.status === "active" && <Button size="sm" onClick={() => handleMark(s)}>Mark</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-slate-400">Showing {items.length} sessions</div>

      <CreateSessionModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      <SessionDrawer isOpen={!!selected} onClose={() => setSelected(null)} session={selected} />
    </Card>
  );
}
