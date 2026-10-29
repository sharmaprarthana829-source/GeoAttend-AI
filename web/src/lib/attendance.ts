import { api, AttendanceSession, AttendanceRecord, SessionStatus } from "./api";

export type { AttendanceSession, AttendanceRecord };

export interface ListResponse<T> {
  data: T[];
  total: number;
}

export async function listSessions(params: { page?: number; per_page?: number; q?: string; onlyActive?: boolean } = {}): Promise<ListResponse<AttendanceSession>> {
  const sessions = await api.attendance.getAdminSessions();
  let filtered = sessions;
  if (params.onlyActive) {
    filtered = sessions.filter((s) => s.status === "active");
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = filtered.filter((s) => (s.subject_name || "").toLowerCase().includes(q) || (s.faculty_name || "").toLowerCase().includes(q));
  }
  const page = params.page || 1;
  const perPage = params.per_page || 25;
  const start = (page - 1) * perPage;
  return {
    data: filtered.slice(start, start + perPage),
    total: filtered.length,
  };
}

export async function startSession(timetableEntryId: number, sessionDate?: string): Promise<AttendanceSession> {
  return api.attendance.startSession({ timetable_entry_id: timetableEntryId, session_date: sessionDate });
}

export async function createSession(payload: any): Promise<AttendanceSession> {
  const timetableId = payload.timetable_entry_id || 1;
  return api.attendance.startSession({ timetable_entry_id: timetableId });
}

export async function endSession(sessionId: number): Promise<AttendanceSession> {
  return api.attendance.closeSession(sessionId);
}

export async function getSessionRecords(sessionId: number): Promise<AttendanceRecord[]> {
  return api.attendance.getSessionRecords(sessionId);
}
