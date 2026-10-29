"use client";

import { useEffect, useState, useCallback } from "react";
import { api, SystemSettingItem } from "@/lib/api";
import {
  Settings,
  Clock,
  MapPin,
  QrCode,
  Smartphone,
  Cpu,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setFieldErrors({});
      const data = await api.systemConfig.getSettings();
      setSettings(data);
      const initialForm: Record<string, string> = {};
      data.forEach((s) => {
        initialForm[s.key] = s.value;
      });
      setFormData(initialForm);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load system settings";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function handleChange(key: string, val: string) {
    setFormData((prev) => ({ ...prev, [key]: val }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!reason.trim()) {
      errors["_reason"] = "Administrative reason is required for audit logging.";
    } else if (reason.trim().length < 3) {
      errors["_reason"] = "Reason must be at least 3 characters long.";
    }

    settings.forEach((s) => {
      const val = (formData[s.key] ?? s.value ?? "").trim();
      if (!val) {
        errors[s.key] = "This field cannot be empty.";
        return;
      }

      if (s.value_type === "int") {
        const intVal = Number(val);
        if (!Number.isInteger(intVal) || isNaN(intVal)) {
          errors[s.key] = "Must be a valid whole number.";
        } else if (intVal < 0) {
          errors[s.key] = "Cannot be negative.";
        } else if (s.key === "default_session_duration_minutes" && intVal <= 0) {
          errors[s.key] = "Duration must be greater than 0 minutes.";
        } else if (s.key === "default_geofence_radius_meters" && intVal <= 0) {
          errors[s.key] = "Radius must be greater than 0 meters.";
        } else if (s.key === "qr_rotation_interval_seconds" && intVal < 5) {
          errors[s.key] = "Rotation must be at least 5 seconds.";
        }
      } else if (s.value_type === "float") {
        const floatVal = Number(val);
        if (isNaN(floatVal)) {
          errors[s.key] = "Must be a valid number.";
        } else if (
          (s.key === "minimum_attendance_percentage" || s.key === "high_risk_threshold") &&
          (floatVal < 0 || floatVal > 100)
        ) {
          errors[s.key] = "Must be between 0.0 and 100.0%.";
        } else if (
          (s.key === "rule_score_weight" || s.key === "ml_score_weight") &&
          (floatVal < 0 || floatVal > 1)
        ) {
          errors[s.key] = "Weight must be between 0.0 and 1.0.";
        } else if (s.key === "max_allowed_gps_accuracy_meters" && floatVal <= 0) {
          errors[s.key] = "GPS accuracy error must be greater than 0.0m.";
        }
      } else if (s.value_type === "bool") {
        if (!["true", "false", "1", "0"].includes(val.toLowerCase())) {
          errors[s.key] = "Must be true or false.";
        }
      }
    });

    // Logical relationship check: late threshold vs grace period
    const graceVal = Number(formData["attendance_grace_period_minutes"]);
    const lateVal = Number(formData["late_threshold_minutes"]);
    if (!isNaN(graceVal) && !isNaN(lateVal) && lateVal < graceVal) {
      errors["late_threshold_minutes"] = `Late threshold (${lateVal}m) cannot be less than grace period (${graceVal}m).`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) {
      setError("Please fix the validation errors below before saving.");
      return;
    }

    try {
      setSaving(true);
      const updated = await api.systemConfig.updateSettings(formData, reason.trim());
      setSuccess("System configuration updated and audited successfully!");
      setReason("");
      setFieldErrors({});

      // Reconcile state with server response
      if (Array.isArray(updated) && updated.length > 0) {
        setSettings(updated);
        const newForm: Record<string, string> = {};
        updated.forEach((s) => {
          newForm[s.key] = s.value;
        });
        setFormData(newForm);
      } else {
        await loadSettings();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update configuration settings";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const categories = [
    { key: "attendance", label: "Attendance & Scheduling", icon: <Clock className="h-5 w-5 text-blue-400" /> },
    { key: "gps", label: "GPS & Geofencing Parameters", icon: <MapPin className="h-5 w-5 text-emerald-400" /> },
    { key: "qr", label: "Dynamic Rotating QR Engine", icon: <QrCode className="h-5 w-5 text-amber-400" /> },
    { key: "ml", label: "AI / ML Anomaly & Hybrid Fusion", icon: <Cpu className="h-5 w-5 text-purple-400" /> },
    { key: "device", label: "Device Binding & Security Rules", icon: <Smartphone className="h-5 w-5 text-rose-400" /> },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-400" />
            Global System Configuration
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure dynamic attendance thresholds, GPS accuracy limits, QR refresh timing, and ML risk parameters.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading || saving}
            className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-sm"
            title="Reload current settings from server"
          >
            <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving Changes..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{success}</p>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="ml-auto text-xs underline hover:text-emerald-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto text-xs underline hover:text-rose-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Audit Reason Box */}
      <div
        className={`rounded-2xl border ${
          fieldErrors["_reason"]
            ? "border-rose-500/50 bg-rose-950/20"
            : "border-blue-500/20 bg-blue-500/5"
        } p-4 backdrop-blur-xl transition-colors`}
      >
        <label
          htmlFor="audit-reason-input"
          className="text-xs font-semibold uppercase tracking-wider text-blue-400"
        >
          Mandatory Administrative Reason for Audit Log
        </label>
        <input
          id="audit-reason-input"
          type="text"
          placeholder="e.g. Updated QR rotation speed for higher exam security / Tuned ML risk weight"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (fieldErrors["_reason"]) {
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next["_reason"];
                return next;
              });
            }
          }}
          className={`mt-1.5 w-full rounded-xl border ${
            fieldErrors["_reason"] ? "border-rose-500" : "border-slate-800"
          } bg-slate-950/80 p-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none`}
        />
        {fieldErrors["_reason"] && (
          <p className="mt-1.5 text-xs text-rose-400 font-medium">{fieldErrors["_reason"]}</p>
        )}
      </div>

      {/* Categorized Config Cards */}
      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-16 text-center text-slate-400 backdrop-blur-xl">
          <RefreshCw className="mx-auto h-8 w-8 text-blue-400 animate-spin mb-3" />
          <p className="text-sm font-medium">Loading system configurations...</p>
        </div>
      ) : settings.length === 0 ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-12 text-center backdrop-blur-xl">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-400 mb-3" />
          <h3 className="text-lg font-semibold text-white">No configurations loaded</h3>
          <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
            Unable to retrieve system configurations from the backend.
          </p>
          <button
            type="button"
            onClick={loadSettings}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
          >
            <RefreshCw className="h-4 w-4 text-blue-400" />
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {categories.map((cat) => {
            const catSettings = settings.filter((s) => s.category === cat.key);
            if (catSettings.length === 0) return null;

            return (
              <div
                key={cat.key}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl space-y-4"
              >
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  {cat.icon}
                  <h2 className="text-lg font-bold text-white">{cat.label}</h2>
                </div>

                <div className="space-y-4">
                  {catSettings.map((s) => {
                    const hasError = !!fieldErrors[s.key];
                    const val = formData[s.key] ?? s.value;

                    return (
                      <div key={s.key} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label
                            htmlFor={`setting-${s.key}`}
                            className="text-xs font-semibold text-slate-300 font-mono"
                          >
                            {s.key}
                          </label>
                          <span className="text-[10px] text-slate-500 uppercase">{s.value_type}</span>
                        </div>

                        {s.value_type === "bool" ? (
                          <select
                            id={`setting-${s.key}`}
                            value={val.toLowerCase() === "true" || val === "1" ? "true" : "false"}
                            onChange={(e) => handleChange(s.key, e.target.value)}
                            className={`w-full rounded-xl border ${
                              hasError
                                ? "border-rose-500 bg-rose-950/20"
                                : "border-slate-800 bg-slate-950/90"
                            } p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none`}
                          >
                            <option value="true" className="bg-slate-900 text-white">
                              True (Enforced / Enabled)
                            </option>
                            <option value="false" className="bg-slate-900 text-white">
                              False (Disabled)
                            </option>
                          </select>
                        ) : (
                          <input
                            id={`setting-${s.key}`}
                            type="text"
                            value={val}
                            onChange={(e) => handleChange(s.key, e.target.value)}
                            className={`w-full rounded-xl border ${
                              hasError
                                ? "border-rose-500 bg-rose-950/20"
                                : "border-slate-800 bg-slate-950/90"
                            } p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none font-mono`}
                          />
                        )}

                        {hasError && (
                          <p className="text-xs text-rose-400 font-medium">
                            {fieldErrors[s.key]}
                          </p>
                        )}

                        {s.description && (
                          <p className="text-xs text-slate-500">{s.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}
