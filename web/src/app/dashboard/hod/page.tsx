"use client";

import React, { useEffect, useState } from "react";
import {
  api,
  AttendanceApplication,
  ReviewDecision,
} from "@/lib/api";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  Award,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function HODDashboardPage() {
  const { user } = useDashboard();
  const [applications, setApplications] = useState<AttendanceApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal state
  const [selectedApp, setSelectedApp] = useState<AttendanceApplication | null>(null);
  const [decision, setDecision] = useState<ReviewDecision>("approved");
  const [remarks, setRemarks] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const hodResp = user?.faculty_profile?.responsibilities?.find(
    (r) => r.responsibility_type === "hod" && r.is_active
  );

  useEffect(() => {
    loadHODApplications();
  }, [user]);

  async function loadHODApplications() {
    setLoading(true);
    try {
      const apps = await api.applications.getHODApplications();
      setApplications(apps);
    } catch (err) {
      console.error("Error loading HOD applications:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleHODDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedApp) return;
    setReviewLoading(true);
    setReviewError("");
    try {
      await api.applications.reviewHODApplication(selectedApp.id, {
        decision,
        remarks: remarks || undefined,
      });
      setSelectedApp(null);
      setRemarks("");
      await loadHODApplications();
    } catch (err: any) {
      setReviewError(err.message || "Failed to submit HOD decision");
    } finally {
      setReviewLoading(false);
    }
  }

  if (!hodResp) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-white">HOD Responsibility Required</h2>
        <p className="text-sm text-slate-400 mt-1">
          This portal is reserved for Faculty members with an active Head of Department (HOD) assignment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HOD Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-surface-900 to-surface-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Award className="h-4 w-4" /> Head of Department (HOD) Desk
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">Department Applications Queue</h1>
          <p className="text-sm text-slate-400 mt-1">
            Department ID: <span className="text-slate-200 font-mono">#{hodResp.department_id || "CSE"}</span> · Final Condonation & Debarment Decisions
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-4 py-2 text-right">
          <span className="text-xs text-slate-400">Pending HOD Review</span>
          <p className="text-2xl font-bold text-emerald-400">{applications.length}</p>
        </div>
      </div>

      {/* Applications Table */}
      <Card className="p-6 border-slate-800/60 bg-surface-900/70">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-emerald-400" /> Pending Department Condonations
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800/80">
                <th className="py-3 pr-4">App ID</th>
                <th className="py-3 pr-4">Student</th>
                <th className="py-3 pr-4">Subject</th>
                <th className="py-3 pr-4">Faculty Decision</th>
                <th className="py-3 pr-4">Reason</th>
                <th className="py-3 pr-4">Submitted</th>
                <th className="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No applications currently awaiting HOD decision.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-surface-800/40">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-400">#{app.id}</td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white">{app.student_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{app.student_roll_number}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-200">{app.subject_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{app.subject_code}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-emerald-400 font-semibold text-xs">APPROVED</span>
                      <p className="text-xs text-slate-400 truncate max-w-xs">{app.faculty_remarks || "Verified"}</p>
                    </td>
                    <td className="py-3 pr-4 max-w-xs">
                      <p className="text-slate-200 truncate">{app.reason}</p>
                      <p className="text-xs text-slate-400 truncate">{app.description}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs font-mono text-slate-400">
                      {new Date(app.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedApp(app);
                          setDecision("approved");
                          setRemarks("");
                          setReviewError("");
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                      >
                        Make Decision
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Decision Modal */}
      <Modal
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title={`Final HOD Decision — Application #${selectedApp?.id}`}
        description={`Student: ${selectedApp?.student_name} (${selectedApp?.student_roll_number})`}
      >
        <form onSubmit={handleHODDecision} className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-surface-950 p-3 text-xs space-y-1.5">
            <p className="text-slate-300"><span className="text-slate-400">Subject:</span> {selectedApp?.subject_name} ({selectedApp?.subject_code})</p>
            <p className="text-slate-300"><span className="text-slate-400">Reason:</span> {selectedApp?.reason}</p>
            <p className="text-slate-300"><span className="text-slate-400">Faculty Reviewer:</span> {selectedApp?.faculty_reviewer_name} ({selectedApp?.faculty_remarks})</p>
            {selectedApp?.supporting_document_url && (
              <p className="text-emerald-400 truncate">
                <a href={selectedApp.supporting_document_url} target="_blank" rel="noreferrer" className="underline">
                  View Attached Medical / Official Proof
                </a>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Final Departmental Decision</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="approved"
                  checked={decision === "approved"}
                  onChange={() => setDecision("approved")}
                  className="accent-emerald-500"
                />
                <span className="text-emerald-400 font-medium">Grant Condonation (Approve)</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="rejected"
                  checked={decision === "rejected"}
                  onChange={() => setDecision("rejected")}
                  className="accent-rose-500"
                />
                <span className="text-rose-400 font-medium">Reject Condonation</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">HOD Remarks / Official Notes</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              placeholder="Enter official HOD condonation notes..."
            />
          </div>

          {reviewError && <p className="text-xs text-rose-400">{reviewError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setSelectedApp(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={reviewLoading}
              className={decision === "approved" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"}
            >
              {reviewLoading ? "Saving..." : `Confirm ${decision === "approved" ? "Condonation" : "Rejection"}`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
