"use client";

import { useEffect, useState, useCallback } from "react";
import { api, AuditLogEntry } from "@/lib/api";
import {
  ShieldCheck,
  Search,
  Clock,
  User,
  FileCode,
  AlertCircle,
  Eye,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  Layers,
  Activity,
  Hash,
} from "lucide-react";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * pageSize;
      const parsedEntityId = entityIdFilter.trim() ? parseInt(entityIdFilter.trim(), 10) : undefined;

      const res = await api.audit.getLogs({
        query: searchQuery.trim() || undefined,
        action: actionFilter.trim() || undefined,
        entity_type: entityFilter.trim() || undefined,
        entity_id: !isNaN(parsedEntityId as number) ? parsedEntityId : undefined,
        role: roleFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: pageSize,
        offset: offset,
      });

      setLogs(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      console.error("Failed to load audit logs:", err);
      const message =
        err instanceof Error ? err.message : "Failed to load audit logs from the database.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, actionFilter, entityFilter, roleFilter, entityIdFilter, startDate, endDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Reset to page 1 on filter changes
  function handleFilterChange(setter: (val: string) => void, val: string) {
    setter(val);
    setPage(1);
  }

  function handleClearFilters() {
    setSearchQuery("");
    setActionFilter("");
    setEntityFilter("");
    setRoleFilter("");
    setEntityIdFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  }

  const hasActiveFilters = Boolean(
    searchQuery || actionFilter || entityFilter || roleFilter || entityIdFilter || startDate || endDate
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function getActionBadge(action: string) {
    const upper = action.toUpperCase();
    if (upper.includes("OVERRIDE")) {
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    }
    if (upper.includes("UNBIND") || upper.includes("RESET") || upper.includes("DELETE") || upper.includes("REJECT")) {
      return "border-rose-500/30 bg-rose-500/10 text-rose-400";
    }
    if (upper.includes("CREATE") || upper.includes("APPROV")) {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    }
    if (upper.includes("CONFIG") || upper.includes("SETTING")) {
      return "border-blue-500/30 bg-blue-500/10 text-blue-400";
    }
    if (upper.includes("REVIEW") || upper.includes("SUBMIT")) {
      return "border-indigo-500/30 bg-indigo-500/10 text-indigo-400";
    }
    return "border-purple-500/30 bg-purple-500/10 text-purple-400";
  }

  function getRoleBadge(role?: string | null) {
    if (!role) return "border-slate-800 bg-slate-900 text-slate-400";
    const r = role.toLowerCase();
    if (r === "admin") return "border-purple-500/30 bg-purple-500/10 text-purple-400";
    if (r === "faculty") return "border-blue-500/30 bg-blue-500/10 text-blue-400";
    if (r === "student") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    return "border-slate-800 bg-slate-900 text-slate-400";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
            Administrative Audit Log Desk
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Immutable, read-only audit log tracking administrative modifications, overrides, device resets, and security events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-sm"
            title="Refresh audit log stream"
          >
            <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-rose-300 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={loadLogs}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
          >
            <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
            Retry
          </button>
        </div>
      )}

      {/* Search & Filters Controls */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Universal Query Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search keyword, actor, reason..."
              value={searchQuery}
              onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <Activity className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Action (e.g. OVERRIDE, CONFIG)..."
              value={actionFilter}
              onChange={(e) => handleFilterChange(setActionFilter, e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>

          {/* Entity Type Filter */}
          <div className="relative">
            <Layers className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Entity Type (e.g. STUDENT, ROOM)..."
              value={entityFilter}
              onChange={(e) => handleFilterChange(setEntityFilter, e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => handleFilterChange(setRoleFilter, e.target.value)}
              aria-label="Filter by actor role"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="faculty">Faculty</option>
              <option value="student">Student</option>
            </select>
          </div>
        </div>

        {/* Secondary Filters: Entity ID & Date Range */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1 border-t border-slate-800/60">
          <div className="relative">
            <Hash className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Entity ID (e.g. 106)..."
              value={entityIdFilter}
              onChange={(e) => handleFilterChange(setEntityIdFilter, e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
              aria-label="Filter start date"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
              aria-label="Filter end date"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium"
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
              </button>
            )}
            <div className="text-xs text-slate-400">
              Showing <strong>{logs.length}</strong> of <strong>{totalCount}</strong> events
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Stream Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <div className="overflow-x-auto min-w-full">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="w-48 px-5 py-4">Timestamp</th>
                <th className="w-56 px-5 py-4">Actor & Role</th>
                <th className="w-44 px-5 py-4">Action</th>
                <th className="w-48 px-5 py-4">Entity</th>
                <th className="px-5 py-4">Reason / Justification</th>
                <th className="w-20 px-5 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 text-blue-400 animate-spin mb-2" />
                    <span>Loading audit stream from database...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <ShieldCheck className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-300">No audit events found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {hasActiveFilters
                        ? "No events match your current filter parameters. Try clearing filters."
                        : "No administrative or security audit events recorded yet."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700"
                      >
                        <X className="h-3 w-3" />
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const createdDate = new Date(log.created_at);
                  const formattedTime = createdDate.toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-800/30 transition group"
                    >
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-400 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span>{formattedTime}</span>
                        </div>
                      </td>

                      {/* Actor & Role */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white flex items-center gap-1.5 truncate max-w-[200px]">
                          <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          <span className="truncate">{log.user_name || "System Automated"}</span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          {log.user_role && (
                            <span
                              className={`rounded border px-1.5 py-0.2 text-[9px] uppercase font-mono font-semibold ${getRoleBadge(
                                log.user_role
                              )}`}
                            >
                              {log.user_role}
                            </span>
                          )}
                          <span className="truncate text-slate-500 text-[11px]">
                            {log.user_email || "system@geoattend.local"}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-200">{log.entity_type}</span>
                          {log.entity_id !== null && log.entity_id !== undefined && (
                            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-xs text-blue-400 font-mono font-bold">
                              #{log.entity_id}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="px-5 py-3.5 text-xs text-slate-300 max-w-xs truncate" title={log.reason || ""}>
                        {log.reason || <span className="text-slate-600">—</span>}
                      </td>

                      {/* Details View Button */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                          title="View Full Audit Event Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-800 bg-slate-950/40 px-5 py-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
              className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="ml-2 text-slate-500">
              Page {page} of {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
                <FileCode className="h-5 w-5 text-blue-400" />
                Audit Record Event #{selectedLog.id}
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Action</span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${getActionBadge(
                        selectedLog.action
                      )}`}
                    >
                      {selectedLog.action}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Timestamp</span>
                  <p className="mt-1 text-slate-300 font-mono text-xs">
                    {new Date(selectedLog.created_at).toISOString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Actor</span>
                  <p className="mt-1 text-white font-medium">
                    {selectedLog.user_name || "System"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedLog.user_email || "system@geoattend.local"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Entity Affected</span>
                  <p className="mt-1 font-mono text-sm text-slate-200">
                    {selectedLog.entity_type}{" "}
                    {selectedLog.entity_id ? (
                      <span className="text-blue-400 font-bold">#{selectedLog.entity_id}</span>
                    ) : (
                      ""
                    )}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Administrative Reason / Justification
                </span>
                <p className="mt-1 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-slate-300 text-xs leading-relaxed">
                  {selectedLog.reason || "No explicit reason logged."}
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Audit Snapshot Metadata Payload
                </span>
                <pre className="mt-1 max-h-56 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-400">
                  {selectedLog.metadata_json
                    ? JSON.stringify(JSON.parse(selectedLog.metadata_json), null, 2)
                    : "{}"}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
