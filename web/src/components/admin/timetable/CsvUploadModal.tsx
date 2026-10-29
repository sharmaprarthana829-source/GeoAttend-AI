"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import {
  Upload,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_CSV = `subject_code,section_name,student_group_name,faculty_email,class_type,day_of_week,start_time,end_time,room_number
CS201,CSD-A,,faculty@geoattend.ai,theory,monday,09:00,10:00,C-204
CS203,CSD-A,B1,faculty@geoattend.ai,lab,monday,10:00,11:00,LAB-1
CS203,CSD-A,B2,faculty2@geoattend.ai,lab,monday,10:00,11:00,LAB-2`;

export function CsvUploadModal({ isOpen, onClose, onSuccess }: CsvUploadModalProps) {
  const [csvContent, setCsvContent] = useState(SAMPLE_CSV);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    message?: string;
    errors?: string[];
  } | null>(null);

  function handleCopySample() {
    navigator.clipboard.writeText(SAMPLE_CSV);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvContent(text);
        setResult(null);
      }
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await api.timetable.uploadCSV(csvContent);
      setResult({
        success: true,
        message: `Successfully processed and created ${res.created_count} timetable schedule rows!`,
      });
      onSuccess();
    } catch (err: any) {
      const errorList = err.errors || (err.message ? [err.message] : ["CSV batch upload failed."]);
      setResult({
        success: false,
        message: "CSV validation failed. Entire batch was rejected atomically to prevent partial corruption.",
        errors: errorList,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Batch Upload Timetable via CSV"
      description="Upload CSV with atomic validation. All entries are validated against room, faculty, and group conflicts."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Sample CSV Card */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-950/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Required CSV Columns
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopySample}
              className="text-[11px] h-7 px-2.5 flex items-center gap-1 border-slate-700"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied Sample" : "Copy Template"}
            </Button>
          </div>
          <p className="text-[11px] font-mono text-slate-400 leading-relaxed overflow-x-auto whitespace-pre-wrap">
            subject_code, section_name, student_group_name, faculty_email, class_type, day_of_week, start_time, end_time, room_number
          </p>
        </div>

        {/* File Drag / Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Upload CSV File or Paste Raw Text
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-surface-800 file:text-slate-200 hover:file:bg-surface-700 cursor-pointer"
            />
          </div>

          <textarea
            value={csvContent}
            onChange={(e) => {
              setCsvContent(e.target.value);
              setResult(null);
            }}
            rows={7}
            placeholder="Paste CSV rows here..."
            className="w-full rounded-xl border border-slate-700 bg-surface-950 p-3 font-mono text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            required
          />
        </div>

        {/* Results Feedback */}
        {result?.success && (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{result.message}</span>
          </div>
        )}

        {result && !result.success && (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/40 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{result.message}</span>
            </div>
            {result.errors && result.errors.length > 0 && (
              <ul className="space-y-1 pl-5 list-disc text-rose-200/90 text-[11px] max-h-36 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Close
          </Button>
          <Button
            type="submit"
            disabled={loading || !csvContent.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2"
          >
            {loading ? "Validating & Uploading..." : "Process Batch CSV"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
