"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createSession, AttendanceSession } from "@/lib/attendance";

export default function CreateSessionModal({ isOpen, onClose, onCreate, defaultSubject }: { isOpen: boolean; onClose: () => void; onCreate: (s: AttendanceSession) => void; defaultSubject?: string }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [startNow, setStartNow] = useState(true);
  const [startingAt, setStartingAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const payload: Partial<AttendanceSession> = {
        title: title || `${subject || "Session"} - ${new Date().toLocaleString()}`,
        subject,
        start_time: startNow ? new Date().toISOString() : (startingAt || undefined),
        is_active: startNow,
        created_by_role: "super_admin",
      };
      const s = await createSession(payload);
      onCreate(s);
      setTitle("");
      setSubject("");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Attendance Session">
      <div className="space-y-4">
        <div>
          <label className="text-sm text-slate-300">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session title" />
        </div>
        <div>
          <label className="text-sm text-slate-300">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject name" />
        </div>
        <div>
          <label className="text-sm text-slate-300">Start Now</label>
          <div className="mt-2 flex items-center gap-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="start" checked={startNow} onChange={() => setStartNow(true)} /> <span className="text-sm text-slate-400">Yes</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="start" checked={!startNow} onChange={() => setStartNow(false)} /> <span className="text-sm text-slate-400">Schedule</span>
            </label>
          </div>
          {!startNow && (
            <Input type="datetime-local" value={startingAt || ""} onChange={(e) => setStartingAt(e.target.value)} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Creating..." : "Create"}</Button>
        </div>
      </div>
    </Modal>
  );
}
