/**
 * GeoAttend AI — Frontend API Client (Phase 11)
 *
 * Provides strongly-typed API methods for all backend endpoints across:
 * - Authentication & Roles
 * - Academic Structure & Enrollments
 * - Subjects, Offerings & Faculty Assignments
 * - Timetable Engine & Conflict Validation
 * - Attendance Sessions, QR & Check-In
 * - Suspicious Activity & Anomaly Detection
 * - Attendance Applications & Debarment Workflow
 * - Notice Board & Notifications System
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// ─────────────────────────────────────────────────────────────────────────────
// Common & Enum Types
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "faculty" | "student";
export type ResponsibilityType = "professor" | "hod" | "dean" | "principal" | "coordinator";
export type ScopeType = "college" | "department" | "section";
export type ClassType = "theory" | "lab";
export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type SessionStatus = "scheduled" | "active" | "completed" | "closed" | "cancelled";
export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type DetectionMethod = "gps" | "wifi" | "bluetooth" | "device" | "timing" | "multi_signal";
export type ReviewStatus = "pending" | "reviewed" | "dismissed" | "confirmed";
export type ApplicationStatus =
  | "pending_faculty"
  | "pending_coordinator"
  | "pending_hod"
  | "approved"
  | "rejected"
  | "faculty_approved"
  | "faculty_rejected"
  | "hod_approved"
  | "hod_rejected";
export type ReviewDecision = "approved" | "rejected";
export type AudienceType = "all" | "students" | "faculty" | "coordinators" | "department" | "branch" | "group";
export type NotificationType = "notice" | "attendance" | "application" | "system";

// ─────────────────────────────────────────────────────────────────────────────
// Domain Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface FacultyResponsibility {
  id: number;
  faculty_id: number;
  responsibility_type: ResponsibilityType;
  scope_type: ScopeType;
  college_id?: number | null;
  department_id?: number | null;
  section_id?: number | null;
  section_name?: string | null;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
}

export interface FacultyClassRead {
  assignment_id: number;
  subject_offering_id: number;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  credits: number;
  course_name: string;
  branch_name: string;
  semester: number;
  section_id: number;
  section_name: string;
  student_group_id?: number | null;
  student_group_name?: string | null;
  class_type: ClassType;
  total_enrolled: number;
  total_sessions_conducted: number;
}

export interface CoordinatorDeskSummary {
  has_coordinator_role: boolean;
  section_id?: number | null;
  section_name?: string | null;
  branch_name?: string | null;
  course_name?: string | null;
  semester?: number | null;
  total_students: number;
  average_section_attendance?: number | null;
  short_attendance_count: number;
  attendance_threshold?: number;
}

export interface CoordinatorSubjectHeader {
  subject_code: string;
  subject_name: string;
  code?: string;
  name?: string;
  class_type?: string | null;
  total_conducted?: number;
}

export interface CoordinatorSubjectAttendance {
  subject_code: string;
  subject_name: string;
  class_type?: string | null;
  attended: number;
  total: number;
  percentage?: number | null;
}

export interface CoordinatorStudentRow {
  student_id: number;
  user_id: number;
  full_name: string;
  roll_number: string;
  email: string;
  total_attended?: number;
  total_eligible?: number;
  overall_percentage?: number | null;
  is_short_attendance: boolean;
  subjects: CoordinatorSubjectAttendance[];
}

export interface CoordinatorMatrixResponse {
  section_id: number;
  section_name: string;
  attendance_threshold?: number;
  subjects_header: CoordinatorSubjectHeader[];
  students: CoordinatorStudentRow[];
}

export interface FacultyProfile {
  id: number;
  user_id: number;
  department_id: number;
  department_name?: string | null;
  employee_id: string;
  designation?: string | null;
  responsibilities: FacultyResponsibility[];
}

export interface FacultyDetail {
  id: number;
  user_id: number;
  department_id: number;
  department_name?: string | null;
  employee_id: string;
  designation?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  responsibilities: FacultyResponsibility[];
  subjects: string[];
  sections_assigned: string[];
  todays_sessions: number;
  total_sessions?: number;
  created_at?: string | null;
}

export interface StudentProfile {
  id: number;
  user_id: number;
  section_id: number;
  current_group_id?: number | null;
  roll_number: string;
  enrollment_number?: string | null;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  college_id: number | null;
  is_active: boolean;
  faculty_profile?: FacultyProfile | null;
  student_profile?: StudentProfile | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: UserRole;
  responsibilities: string[];
}

export interface College {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  is_active: boolean;
}

export interface Course {
  id: number;
  college_id: number;
  name: string;
  code: string;
  duration_years?: number;
  total_semesters: number;
  is_active: boolean;
  created_at?: string;
  department_count?: number;
}

export interface Department {
  id: number;
  college_id: number;
  campus_id?: number | null;
  course_id?: number | null;
  name: string;
  code: string;
  is_active: boolean;
  created_at?: string;
  branch_count?: number;
  course_name?: string | null;
}

export interface Branch {
  id: number;
  department_id: number;
  course_id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at?: string;
  batch_count?: number;
  department_name?: string | null;
  course_name?: string | null;
}

export interface Batch {
  id: number;
  branch_id: number;
  name: string;
  start_year: number;
  end_year: number;
  is_active: boolean;
  created_at?: string;
  section_count?: number;
  branch_name?: string | null;
}

export interface Section {
  id: number;
  batch_id: number;
  name: string;
  capacity?: number;
  is_active: boolean;
  created_at?: string;
  group_count?: number;
  student_count?: number;
  batch_name?: string | null;
}

export interface StudentGroup {
  id: number;
  section_id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  enrolled_count?: number;
  section_name?: string | null;
}

export interface AcademicEnrollment {
  id: number;
  student_id: number;
  course_id: number;
  branch_id: number;
  batch_id: number;
  section_id: number;
  student_group_id?: number | null;
  semester: number;
  academic_year: string;
  status: string;
  is_current: boolean;
  created_at?: string;
  enrolled_at?: string;
  student_name?: string | null;
  student_roll_number?: string | null;
  student_email?: string | null;
  course_name?: string | null;
  branch_name?: string | null;
  batch_name?: string | null;
  section_name?: string | null;
  student_group_name?: string | null;
}

export interface SubjectMaster {
  id: number;
  college_id?: number;
  department_id?: number | null;
  department_name?: string | null;
  name: string;
  code: string;
  description?: string | null;
  credits: number;
  is_active: boolean;
  offerings_count?: number;
  created_at?: string;
}

export interface SubjectOffering {
  id: number;
  subject_id: number;
  course_id: number;
  branch_id: number;
  batch_id?: number | null;
  semester: number;
  academic_year?: string | null;
  section_id: number;
  student_group_id?: number | null;
  class_type: ClassType;
  is_active: boolean;
  created_at?: string;
  subject_name?: string | null;
  subject_code?: string | null;
  credits?: number | null;
  course_name?: string | null;
  branch_name?: string | null;
  batch_name?: string | null;
  section_name?: string | null;
  student_group_name?: string | null;
  assigned_faculty_count?: number;
  assigned_faculty_names?: string[];
}

export interface FacultyAssignment {
  id: number;
  subject_offering_id: number;
  faculty_id: number;
  is_primary: boolean;
  is_active: boolean;
  created_at?: string;
  faculty_name?: string | null;
  faculty_employee_id?: string | null;
  employee_id?: string | null;
  faculty_designation?: string | null;
  subject_id?: number;
  subject_name?: string | null;
  subject_code?: string | null;
  course_name?: string | null;
  branch_name?: string | null;
  batch_name?: string | null;
  section_name?: string | null;
  student_group_name?: string | null;
  semester?: number;
  academic_year?: string | null;
  class_type?: ClassType | null;
  subject_offering?: SubjectOffering | null;
}

export interface ConflictItem {
  conflict_type: "faculty" | "room" | "student_group" | string;
  severity: "warning" | "error" | string;
  title: string;
  description: string;
  conflicting_entry_id: number;
  conflicting_subject_code: string;
  conflicting_subject_name: string;
  conflicting_faculty_name: string;
  conflicting_room: string;
  conflicting_section_name: string;
  conflicting_group_name?: string | null;
  conflicting_time: string;
  overlapping_interval: string;
}

export interface TimetableConflictSummary {
  total_entries: number;
  faculty_conflicts: number;
  room_conflicts: number;
  student_group_conflicts: number;
  conflict_free: number;
  has_any_conflict: boolean;
}

export interface ConflictValidationResponse {
  has_conflict: boolean;
  conflicts: ConflictItem[];
  errors: string[];
}

export interface TimetableEntry {
  id: number;
  subject_offering_id: number;
  faculty_assignment_id: number;
  faculty_id?: number;
  faculty_name?: string | null;
  employee_id?: string | null;
  subject_id?: number;
  subject_name?: string | null;
  subject_code?: string | null;
  course_id?: number;
  course_name?: string | null;
  branch_id?: number;
  branch_name?: string | null;
  section_id: number;
  section_name?: string | null;
  student_group_id?: number | null;
  student_group_name?: string | null;
  semester?: number;
  class_type: ClassType;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  room_number: string;
  is_active: boolean;
  has_conflict?: boolean;
  conflict_types?: string[];
  conflicts?: ConflictItem[];
  created_at?: string;
}

export interface AttendanceSession {
  id: number;
  timetable_entry_id?: number | null;
  subject_offering_id?: number | null;
  faculty_assignment_id?: number | null;
  faculty_id?: number | null;
  faculty_name?: string | null;
  faculty_employee_id?: string | null;
  subject_name?: string | null;
  subject_code?: string | null;
  course_name?: string | null;
  branch_name?: string | null;
  section_id?: number | null;
  section_name?: string | null;
  student_group_id?: number | null;
  student_group_name?: string | null;
  session_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  status: SessionStatus;
  qr_token?: string | null;
  qr_expires_at?: string | null;
  active_qr_token?: string | null;
  room_number?: string | null;
  class_type?: ClassType | null;
  total_enrolled?: number;
  total_present?: number;
  present_count?: number;
  late_count?: number;
  absent_count?: number;
  geofence_latitude?: number | null;
  geofence_longitude?: number | null;
  geofence_radius_meters?: number | null;
  title?: string;
  subject?: string;
  is_active?: boolean;
  participants?: any[];
  created_by_role?: string;
}

export interface AttendanceRecord {
  id: number;
  session_id: number;
  student_id: number;
  status: AttendanceStatus;
  check_in_time: string;
  marked_at?: string;
  distance_meters?: number | null;
  is_suspicious: boolean;
  student_name?: string | null;
  roll_number?: string | null;
  enrollment_number?: string | null;
}

export interface SuspiciousActivityStats {
  total_flagged: number;
  pending_reviews: number;
  high_risk: number;
  confirmed_violations: number;
  false_positives: number;
  data_quality_issues: number;
}

export interface SuspiciousActivityHistoryItem {
  id: number;
  action: string;
  user_id?: number | null;
  user_name: string;
  user_role?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
  created_at?: string | null;
}

export interface SuspiciousActivity {
  id: number;
  attendance_record_id: number;
  student_id: number;
  student_name?: string | null;
  student_roll_number?: string | null;
  session_id: number;
  subject_name?: string | null;
  subject_code?: string | null;
  section_name?: string | null;
  room_number?: string | null;
  faculty_name?: string | null;
  risk_score: number;
  severity: "low" | "medium" | "high" | "critical";
  detection_method: DetectionMethod;
  reason: string;
  raw_signals?: any;
  review_status: ReviewStatus;
  reviewed_by?: number | null;
  reviewer_name?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  marked_at?: string | null;
  session_started_at?: string | null;
  distance_meters?: number | null;
  device_id?: string | null;
  attendance_status?: string | null;
  is_data_quality_issue: boolean;
  data_quality_reason?: string | null;
  related_activities_count: number;
  created_at: string;
}

export interface ApplicationStats {
  total_applications: number;
  pending_faculty: number;
  pending_coordinator: number;
  pending_hod: number;
  approved: number;
  rejected: number;
}

export interface ApplicationHistoryItem {
  id: number;
  action: string;
  user_id?: number | null;
  user_name: string;
  user_role?: string | null;
  stage?: string | null;
  decision?: string | null;
  remarks?: string | null;
  created_at?: string | null;
}

export interface AttendanceApplication {
  id: number;
  student_id: number;
  student_name?: string | null;
  student_roll_number?: string | null;
  student_email?: string | null;
  subject_offering_id: number;
  subject_name?: string | null;
  subject_code?: string | null;
  course_name?: string | null;
  branch_name?: string | null;
  semester?: number | null;
  class_type?: string | null;
  application_type?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  section_name?: string | null;
  student_group_name?: string | null;
  reason: string;
  description: string;
  supporting_document_url?: string | null;
  status: ApplicationStatus;
  faculty_reviewer_id?: number | null;
  faculty_reviewer_name?: string | null;
  faculty_decision?: ReviewDecision | null;
  faculty_remarks?: string | null;
  faculty_reviewed_at?: string | null;
  coordinator_reviewer_id?: number | null;
  coordinator_reviewer_name?: string | null;
  coordinator_decision?: ReviewDecision | null;
  coordinator_remarks?: string | null;
  coordinator_reviewed_at?: string | null;
  hod_reviewer_id?: number | null;
  hod_reviewer_name?: string | null;
  hod_decision?: ReviewDecision | null;
  hod_remarks?: string | null;
  hod_reviewed_at?: string | null;
  attendance_percentage?: number | null;
  attendance_threshold?: number;
  total_sessions?: number;
  attended_sessions?: number;
  is_exam_eligible?: boolean;
  condonation_granted?: boolean;
  submitted_at: string;
  created_at: string;
}

export interface Notice {
  id: number;
  title: string;
  content: string;
  created_by: number;
  creator_name?: string | null;
  audience_type: AudienceType;
  department_id?: number | null;
  department_name?: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  student_group_id?: number | null;
  student_group_name?: string | null;
  category?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  published_at: string;
  created_at: string;
  updated_at?: string | null;
}

export interface NotificationCounts {
  all: number;
  unread: number;
  read: number;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: NotificationType;
  related_entity_id?: number | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  link_url?: string | null;
  action_label?: string | null;
}

export interface DashboardStats {
  total_colleges: number;
  total_students: number;
  total_faculty: number;
  active_sessions: number;
  today_attendance_count: number;
}

export interface StudentSummaryItem {
  subject_id?: number;
  subject_name: string;
  subject_code: string;
  class_type: ClassType;
  total_classes: number;
  attended_classes: number;
  total_sessions?: number;
  attended?: number;
  percentage: number;
}

export interface StudentDetail {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  roll_number: string;
  enrollment_number?: string | null;
  section_id?: number | null;
  section_name?: string | null;
  current_group_id?: number | null;
  current_group_name?: string | null;
  device_id?: string | null;
  device_registered_at?: string | null;
  is_active: boolean;
  created_at: string;
  course_name?: string | null;
  department_name?: string | null;
  branch_name?: string | null;
  batch_name?: string | null;
  enrollment_status?: string | null;
  attendance_count?: number;
}

export interface AuditLogEntry {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  reason?: string | null;
  metadata_json?: string | null;
  created_at: string;
}

export interface SystemSettingItem {
  id: number;
  category: string;
  key: string;
  value: string;
  value_type: string;
  description?: string | null;
  is_public: boolean;
  updated_at?: string | null;
}

export interface RoomItem {
  id: number;
  campus_id: number;
  name: string;
  building?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_meters: number;
  gps_accuracy_threshold: number;
  capacity?: number | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminAnalyticsData {
  total_students: number;
  total_faculty: number;
  total_departments: number;
  total_courses: number;
  total_subjects: number;
  total_active_sessions: number;
  today_sessions_count: number;
  today_attendance_count: number;
  overall_attendance_percentage: number;
  pending_applications: number;
  total_suspicious_activities: number;
  high_risk_anomalies: number;
  department_attendance: {
    department_id: number;
    department_name: string;
    department_code: string;
    student_count: number;
    attendance_rate: number;
  }[];
  attendance_by_day: { day: string; rate: number }[];
  risk_distribution: {
    low_risk: number;
    high_risk: number;
    pending_review: number;
    dismissed: number;
    confirmed_fraud: number;
  };
}

export interface AdminAttendanceStats {
  active_sessions: number;
  scheduled_today: number;
  completed_today: number;
  students_present: number;
  late_checkins: number;
  suspicious_checkins: number;
  total_records: number;
}

export interface RecordAuditLogItem {
  id: number;
  action: string;
  user_id: number | null;
  user_name: string;
  user_email: string | null;
  user_role: string | null;
  reason: string | null;
  old_status: string | null;
  new_status: string | null;
  created_at: string | null;
}

export interface AdminAttendanceRecordItem {
  id: number;
  session_id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  enrollment_number?: string | null;
  subject_name: string;
  subject_code?: string | null;
  faculty_name?: string | null;
  section_name: string;
  student_group_name?: string | null;
  class_type?: string | null;
  status: string;
  original_status?: string | null;
  is_manually_adjusted: boolean;
  adjustment_reason?: string | null;
  adjusted_by_name?: string | null;
  marked_at: string;
  check_in_time?: string | null;
  distance_meters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  device_id?: string | null;
  is_suspicious: boolean;
  suspicion_reason?: string | null;
  gps_status?: string;
  device_status?: string;
  wifi_status?: string;
  bt_status?: string;
  verifications?: any[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Storage & Refresh Logic
// ─────────────────────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

export function setTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Handle 401 with Token Refresh
  if (res.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      throw new Error("Session expired. Please log in again.");
    }

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!refreshRes.ok) {
          clearTokens();
          isRefreshing = false;
          throw new Error("Session refresh failed. Please log in again.");
        }

        const tokenData: TokenResponse = await refreshRes.json();
        setTokens(tokenData.access_token, tokenData.refresh_token);
        isRefreshing = false;
        onRefreshed(tokenData.access_token);
      } catch (refreshErr) {
        clearTokens();
        isRefreshing = false;
        throw refreshErr;
      }
    }

    // Wait for the token refresh to complete
    const newToken = await new Promise<string>((resolve) => {
      subscribeTokenRefresh((t) => resolve(t));
    });

    headers["Authorization"] = `Bearer ${newToken}`;
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP error ${res.status}` }));
    const errorDetail = Array.isArray(err.detail)
      ? err.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ")
      : err.detail || "Request failed";
    throw new Error(errorDetail);
  }

  // If response is empty or 204
  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed API Services
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  // ── Authentication ──
  auth: {
    login: (email: string, password: string) =>
      apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    refresh: (refreshToken: string) =>
      apiFetch<TokenResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
    me: () => apiFetch<User>("/auth/me"),
  },

  // Direct shortcuts for legacy calls
  login: (email: string, password: string) =>
    apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => apiFetch<User>("/auth/me"),
  dashboardStats: () => apiFetch<DashboardStats>("/attendance/dashboard/stats"),
  colleges: () => apiFetch<College[]>("/colleges"),

  // ── Academic Structure & Enrollments ──
  academic: {
    getCourses: (collegeId?: number) =>
      apiFetch<Course[]>(`/academic/courses${collegeId ? `?college_id=${collegeId}` : ""}`),
    createCourse: (data: { college_id: number; name: string; code: string; total_semesters: number }) =>
      apiFetch<Course>("/academic/courses", { method: "POST", body: JSON.stringify(data) }),
    updateCourse: (id: number, data: Partial<Course>) =>
      apiFetch<Course>(`/academic/courses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteCourse: (id: number) =>
      apiFetch<Course>(`/academic/courses/${id}`, { method: "DELETE" }),

    getDepartments: (courseId?: number) =>
      apiFetch<Department[]>(`/academic/departments${courseId ? `?course_id=${courseId}` : ""}`),
    createDepartment: (data: { college_id: number; course_id?: number; name: string; code: string }) =>
      apiFetch<Department>("/academic/departments", { method: "POST", body: JSON.stringify(data) }),
    updateDepartment: (id: number, data: Partial<Department>) =>
      apiFetch<Department>(`/academic/departments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteDepartment: (id: number) =>
      apiFetch<Department>(`/academic/departments/${id}`, { method: "DELETE" }),

    getBranches: (departmentId?: number) =>
      apiFetch<Branch[]>(`/academic/branches${departmentId ? `?department_id=${departmentId}` : ""}`),
    createBranch: (data: { department_id: number; course_id: number; name: string; code: string }) =>
      apiFetch<Branch>("/academic/branches", { method: "POST", body: JSON.stringify(data) }),
    updateBranch: (id: number, data: Partial<Branch>) =>
      apiFetch<Branch>(`/academic/branches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteBranch: (id: number) =>
      apiFetch<Branch>(`/academic/branches/${id}`, { method: "DELETE" }),

    getBatches: (branchId?: number) =>
      apiFetch<Batch[]>(`/academic/batches${branchId ? `?branch_id=${branchId}` : ""}`),
    createBatch: (data: { branch_id: number; start_year: number; end_year: number }) =>
      apiFetch<Batch>("/academic/batches", { method: "POST", body: JSON.stringify(data) }),
    updateBatch: (id: number, data: Partial<Batch>) =>
      apiFetch<Batch>(`/academic/batches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteBatch: (id: number) =>
      apiFetch<Batch>(`/academic/batches/${id}`, { method: "DELETE" }),

    getSections: (batchId?: number) =>
      apiFetch<Section[]>(`/academic/sections${batchId ? `?batch_id=${batchId}` : ""}`),
    createSection: (data: { batch_id: number; name: string }) =>
      apiFetch<Section>("/academic/sections", { method: "POST", body: JSON.stringify(data) }),
    updateSection: (id: number, data: Partial<Section>) =>
      apiFetch<Section>(`/academic/sections/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteSection: (id: number) =>
      apiFetch<Section>(`/academic/sections/${id}`, { method: "DELETE" }),

    getStudentGroups: (sectionId?: number) =>
      apiFetch<StudentGroup[]>(`/academic/groups${sectionId ? `?section_id=${sectionId}` : ""}`),
    createStudentGroup: (data: { section_id: number; name: string }) =>
      apiFetch<StudentGroup>("/academic/groups", { method: "POST", body: JSON.stringify(data) }),
    updateStudentGroup: (id: number, data: Partial<StudentGroup>) =>
      apiFetch<StudentGroup>(`/academic/groups/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteStudentGroup: (id: number) =>
      apiFetch<StudentGroup>(`/academic/groups/${id}`, { method: "DELETE" }),

    getEnrollments: (params?: {
      student_id?: number;
      section_id?: number;
      student_group_id?: number;
      branch_id?: number;
      batch_id?: number;
      course_id?: number;
      semester?: number;
      academic_year?: string;
      is_current?: boolean;
    }) => {
      const q = new URLSearchParams();
      if (params?.student_id) q.set("student_id", String(params.student_id));
      if (params?.section_id) q.set("section_id", String(params.section_id));
      if (params?.student_group_id) q.set("student_group_id", String(params.student_group_id));
      if (params?.branch_id) q.set("branch_id", String(params.branch_id));
      if (params?.batch_id) q.set("batch_id", String(params.batch_id));
      if (params?.course_id) q.set("course_id", String(params.course_id));
      if (params?.semester) q.set("semester", String(params.semester));
      if (params?.academic_year) q.set("academic_year", params.academic_year);
      if (params?.is_current !== undefined) q.set("is_current", String(params.is_current));
      return apiFetch<AcademicEnrollment[]>(`/academic/enrollments${q.toString() ? `?${q.toString()}` : ""}`);
    },
    createEnrollment: (data: {
      student_id: number;
      course_id: number;
      branch_id: number;
      batch_id: number;
      section_id: number;
      student_group_id?: number | null;
      semester: number;
      academic_year: string;
      status?: string;
      is_current?: boolean;
    }) => apiFetch<AcademicEnrollment>("/academic/enrollments", { method: "POST", body: JSON.stringify(data) }),
    getCurrentEnrollment: (studentId: number) =>
      apiFetch<AcademicEnrollment>(`/academic/students/${studentId}/current-enrollment`),
    updateEnrollment: (id: number, data: Partial<AcademicEnrollment>) =>
      apiFetch<AcademicEnrollment>(`/academic/enrollments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteEnrollment: (id: number) =>
      apiFetch<AcademicEnrollment>(`/academic/enrollments/${id}`, { method: "DELETE" }),
  },

  // ── Subjects, Offerings & Faculty Assignments ──
  subjects: {
    getMasterSubjects: (params?: { department_id?: number; is_active?: boolean; query?: string }) => {
      const q = new URLSearchParams();
      if (params?.department_id) q.set("department_id", String(params.department_id));
      if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
      if (params?.query) q.set("query", params.query);
      return apiFetch<SubjectMaster[]>(`/subjects${q.toString() ? `?${q.toString()}` : ""}`);
    },
    createMasterSubject: (data: { college_id?: number; name: string; code: string; description?: string; credits: number; department_id?: number }) =>
      apiFetch<SubjectMaster>("/subjects", { method: "POST", body: JSON.stringify(data) }),
    updateMasterSubject: (id: number, data: Partial<SubjectMaster>) =>
      apiFetch<SubjectMaster>(`/subjects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteMasterSubject: (id: number) =>
      apiFetch<SubjectMaster>(`/subjects/${id}`, { method: "DELETE" }),

    getOfferings: (params?: {
      subject_id?: number;
      course_id?: number;
      branch_id?: number;
      batch_id?: number;
      section_id?: number;
      semester?: number;
      class_type?: string;
      is_active?: boolean;
      query?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.subject_id) q.set("subject_id", String(params.subject_id));
      if (params?.course_id) q.set("course_id", String(params.course_id));
      if (params?.branch_id) q.set("branch_id", String(params.branch_id));
      if (params?.batch_id) q.set("batch_id", String(params.batch_id));
      if (params?.section_id) q.set("section_id", String(params.section_id));
      if (params?.semester) q.set("semester", String(params.semester));
      if (params?.class_type) q.set("class_type", params.class_type);
      if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
      if (params?.query) q.set("query", params.query);
      return apiFetch<SubjectOffering[]>(`/subject-offerings${q.toString() ? `?${q.toString()}` : ""}`);
    },
    createOffering: (data: {
      subject_id: number;
      course_id: number;
      branch_id: number;
      batch_id?: number;
      semester: number;
      section_id: number;
      student_group_id?: number | null;
      class_type: ClassType;
      academic_year?: string;
    }) => apiFetch<SubjectOffering>("/subject-offerings", { method: "POST", body: JSON.stringify(data) }),
    updateOffering: (id: number, data: Partial<SubjectOffering>) =>
      apiFetch<SubjectOffering>(`/subject-offerings/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteOffering: (id: number) =>
      apiFetch<SubjectOffering>(`/subject-offerings/${id}`, { method: "DELETE" }),

    getAssignments: (params?: { offering_id?: number; faculty_id?: number; is_active?: boolean; query?: string }) => {
      const q = new URLSearchParams();
      if (params?.offering_id) q.set("subject_offering_id", String(params.offering_id));
      if (params?.faculty_id) q.set("faculty_id", String(params.faculty_id));
      if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
      if (params?.query) q.set("query", params.query);
      return apiFetch<FacultyAssignment[]>(`/faculty-assignments${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getMyAssignments: () =>
      apiFetch<FacultyAssignment[]>("/faculty-assignments/my"),
    createAssignment: (data: { subject_offering_id: number; faculty_id: number; is_primary?: boolean }) =>
      apiFetch<FacultyAssignment>("/faculty-assignments", { method: "POST", body: JSON.stringify(data) }),
    updateAssignment: (id: number, data: Partial<FacultyAssignment>) =>
      apiFetch<FacultyAssignment>(`/faculty-assignments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteAssignment: (id: number) =>
      apiFetch<FacultyAssignment>(`/faculty-assignments/${id}`, { method: "DELETE" }),
  },

  // ── Timetable Engine ──
  timetable: {
    getEntries: (params?: {
      section_id?: number;
      student_group_id?: number;
      faculty_id?: number;
      day_of_week?: DayOfWeek;
      room_number?: string;
      class_type?: ClassType;
      conflict_status?: string;
      query?: string;
      is_active?: boolean;
    }) => {
      const q = new URLSearchParams();
      if (params?.section_id) q.set("section_id", String(params.section_id));
      if (params?.student_group_id) q.set("student_group_id", String(params.student_group_id));
      if (params?.faculty_id) q.set("faculty_id", String(params.faculty_id));
      if (params?.day_of_week) q.set("day_of_week", params.day_of_week);
      if (params?.room_number) q.set("room_number", params.room_number);
      if (params?.class_type) q.set("class_type", params.class_type);
      if (params?.conflict_status) q.set("conflict_status", params.conflict_status);
      if (params?.query) q.set("query", params.query);
      if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
      return apiFetch<TimetableEntry[]>(`/timetable${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getConflictSummary: () =>
      apiFetch<TimetableConflictSummary>("/timetable/conflict-summary"),
    validateConflicts: (data: {
      day_of_week: DayOfWeek;
      start_time: string;
      end_time: string;
      room_number: string;
      subject_offering_id: number;
      faculty_assignment_id: number;
      section_id?: number | null;
      student_group_id?: number | null;
      exclude_entry_id?: number | null;
    }) =>
      apiFetch<ConflictValidationResponse>("/timetable/validate-conflicts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getEntry: (id: number) =>
      apiFetch<TimetableEntry>(`/timetable/${id}`),
    createEntry: (data: {
      subject_offering_id: number;
      faculty_assignment_id: number;
      day_of_week: DayOfWeek;
      start_time: string;
      end_time: string;
      room_number: string;
      section_id?: number;
      student_group_id?: number | null;
      class_type?: ClassType;
      allow_override?: boolean;
      override_reason?: string | null;
      is_active?: boolean;
    }) => apiFetch<TimetableEntry>("/timetable", { method: "POST", body: JSON.stringify(data) }),
    updateEntry: (id: number, data: Partial<TimetableEntry> & { allow_override?: boolean; override_reason?: string | null }) =>
      apiFetch<TimetableEntry>(`/timetable/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteEntry: (id: number) =>
      apiFetch<TimetableEntry>(`/timetable/${id}`, { method: "DELETE" }),
    getFacultyToday: () =>
      apiFetch<TimetableEntry[]>("/timetable/today/faculty"),
    getStudentToday: () =>
      apiFetch<TimetableEntry[]>("/timetable/today/student"),
    uploadCSV: (csvContent: string) =>
      apiFetch<{ message?: string; created_count: number; rows_processed?: number; errors?: string[] }>("/timetable/upload", {
        method: "POST",
        body: JSON.stringify({ csv_data: csvContent }),
      }),
  },

  // ── Attendance Engine ──
  attendance: {
    startSession: (data: { timetable_entry_id: number; session_date?: string }) =>
      apiFetch<AttendanceSession>("/attendance/sessions/start", { method: "POST", body: JSON.stringify(data) }),
    closeSession: (sessionId: number) =>
      apiFetch<AttendanceSession>(`/attendance/sessions/${sessionId}/close`, { method: "POST" }),
    getSessionRecords: (sessionId: number) =>
      apiFetch<AttendanceRecord[]>(`/attendance/sessions/${sessionId}/records`),
    getFacultySessions: (limit = 50) =>
      apiFetch<AttendanceSession[]>(`/attendance/faculty/sessions?limit=${limit}`),
    getStudentActiveSessions: () =>
      apiFetch<AttendanceSession[]>("/attendance/student/active-sessions"),
    checkIn: (data: {
      session_id: number;
      qr_token?: string;
      latitude?: number;
      longitude?: number;
      accuracy_meters?: number;
      device_id?: string;
      device_model?: string;
    }) => apiFetch<AttendanceRecord>("/attendance/check-in", { method: "POST", body: JSON.stringify(data) }),
    getStudentSummary: () =>
      apiFetch<StudentSummaryItem[]>("/attendance/student/summary"),
    getStudentHistory: (limit = 100) =>
      apiFetch<AttendanceRecord[]>(`/attendance/student/history?limit=${limit}`),
    getAdminSessions: (params?: { department_id?: number; status?: SessionStatus; session_date?: string; query?: string; faculty_id?: number; section_id?: number }) => {
      const q = new URLSearchParams();
      if (params?.department_id) q.set("department_id", String(params.department_id));
      if (params?.status) q.set("status", params.status);
      if (params?.session_date) q.set("session_date", params.session_date);
      if (params?.query) q.set("query", params.query);
      if (params?.faculty_id) q.set("faculty_id", String(params.faculty_id));
      if (params?.section_id) q.set("section_id", String(params.section_id));
      return apiFetch<AttendanceSession[]>(`/attendance/admin/sessions${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getAdminSessionRecords: (sessionId: number) =>
      apiFetch<AttendanceRecord[]>(`/attendance/admin/sessions/${sessionId}/records`),
  },

  // ── Suspicious Activity & Anomaly Detection ──
  anomaly: {
    getStats: () =>
      apiFetch<SuspiciousActivityStats>("/anomaly/stats"),
    getFacultyAnomalies: (params?: {
      review_status?: ReviewStatus;
      detection_method?: DetectionMethod;
      query?: string;
      severity?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.review_status) q.set("review_status", params.review_status);
      if (params?.detection_method) q.set("detection_method", params.detection_method);
      if (params?.query) q.set("query", params.query);
      if (params?.severity) q.set("severity", params.severity);
      return apiFetch<SuspiciousActivity[]>(`/anomaly/faculty${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getAdminAnomalies: (params?: {
      department_id?: number;
      faculty_id?: number;
      student_id?: number;
      review_status?: ReviewStatus;
      detection_method?: DetectionMethod;
      start_date?: string;
      end_date?: string;
      query?: string;
      severity?: string;
      sort_by?: string;
      sort_order?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.department_id) q.set("department_id", String(params.department_id));
      if (params?.faculty_id) q.set("faculty_id", String(params.faculty_id));
      if (params?.student_id) q.set("student_id", String(params.student_id));
      if (params?.review_status) q.set("review_status", params.review_status);
      if (params?.detection_method) q.set("detection_method", params.detection_method);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      if (params?.query) q.set("query", params.query);
      if (params?.severity) q.set("severity", params.severity);
      if (params?.sort_by) q.set("sort_by", params.sort_by);
      if (params?.sort_order) q.set("sort_order", params.sort_order);
      return apiFetch<SuspiciousActivity[]>(`/anomaly/admin${q.toString() ? `?${q.toString()}` : ""}`);
    },
    reviewAnomaly: (id: number, data: { review_status: ReviewStatus; reviewer_notes?: string; decision_reason?: string }) =>
      apiFetch<SuspiciousActivity>(`/anomaly/${id}/review`, { method: "POST", body: JSON.stringify(data) }),
    reviewFacultyAnomaly: (id: number, data: { status: "pending" | "reviewed" | "dismissed" | "confirmed"; reviewer_notes?: string; decision_reason?: string }) =>
      apiFetch<SuspiciousActivity>(`/anomaly/${id}/review`, { method: "POST", body: JSON.stringify({ review_status: data.status, reviewer_notes: data.reviewer_notes, decision_reason: data.decision_reason }) }),
    reviewAdminAnomaly: (id: number, data: { status: "pending" | "reviewed" | "dismissed" | "confirmed"; reviewer_notes?: string; decision_reason?: string }) =>
      apiFetch<SuspiciousActivity>(`/anomaly/${id}/review`, { method: "POST", body: JSON.stringify({ review_status: data.status, reviewer_notes: data.reviewer_notes, decision_reason: data.decision_reason }) }),
    getAnomalyDetail: (id: number) =>
      apiFetch<SuspiciousActivity>(`/anomaly/${id}`),
    getAnomalyHistory: (id: number) =>
      apiFetch<SuspiciousActivityHistoryItem[]>(`/anomaly/${id}/history`),
  },

  // ── Attendance Applications & Debarment ──
  applications: {
    getStats: () =>
      apiFetch<ApplicationStats>("/applications/stats"),
    submitApplication: (data: {
      subject_offering_id: number;
      reason: string;
      description: string;
      supporting_document_url?: string;
    }) => apiFetch<AttendanceApplication>("/applications", { method: "POST", body: JSON.stringify(data) }),
    getMyApplications: (params?: {
      status?: ApplicationStatus;
      application_type?: string;
      query?: string;
      start_date?: string;
      end_date?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.application_type) q.set("application_type", params.application_type);
      if (params?.query) q.set("query", params.query);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      return apiFetch<AttendanceApplication[]>(`/applications/my${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getFacultyApplications: (params?: {
      status?: ApplicationStatus;
      application_type?: string;
      query?: string;
      start_date?: string;
      end_date?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.application_type) q.set("application_type", params.application_type);
      if (params?.query) q.set("query", params.query);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      return apiFetch<AttendanceApplication[]>(`/applications/faculty${q.toString() ? `?${q.toString()}` : ""}`);
    },
    reviewFacultyApplication: (id: number, data: { decision: ReviewDecision; remarks?: string }) =>
      apiFetch<AttendanceApplication>(`/applications/${id}/faculty-review`, { method: "PATCH", body: JSON.stringify(data) }),
    getCoordinatorApplications: (params?: {
      status?: ApplicationStatus;
      application_type?: string;
      query?: string;
      start_date?: string;
      end_date?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.application_type) q.set("application_type", params.application_type);
      if (params?.query) q.set("query", params.query);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      return apiFetch<AttendanceApplication[]>(`/applications/coordinator${q.toString() ? `?${q.toString()}` : ""}`);
    },
    reviewCoordinatorApplication: (id: number, data: { decision: ReviewDecision; remarks?: string }) =>
      apiFetch<AttendanceApplication>(`/applications/${id}/coordinator-review`, { method: "PATCH", body: JSON.stringify(data) }),
    getHODApplications: (params?: {
      status?: ApplicationStatus;
      application_type?: string;
      query?: string;
      start_date?: string;
      end_date?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.application_type) q.set("application_type", params.application_type);
      if (params?.query) q.set("query", params.query);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      return apiFetch<AttendanceApplication[]>(`/applications/hod${q.toString() ? `?${q.toString()}` : ""}`);
    },
    reviewHODApplication: (id: number, data: { decision: ReviewDecision; remarks?: string }) =>
      apiFetch<AttendanceApplication>(`/applications/${id}/hod-decision`, { method: "PATCH", body: JSON.stringify(data) }),
    getAdminApplications: (params?: {
      department_id?: number;
      status?: ApplicationStatus;
      application_type?: string;
      query?: string;
      start_date?: string;
      end_date?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.department_id) q.set("department_id", String(params.department_id));
      if (params?.status) q.set("status", params.status);
      if (params?.application_type) q.set("application_type", params.application_type);
      if (params?.query) q.set("query", params.query);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      return apiFetch<AttendanceApplication[]>(`/applications/admin${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getApplicationDetail: (id: number) =>
      apiFetch<AttendanceApplication>(`/applications/${id}`),
    getApplicationHistory: (id: number) =>
      apiFetch<ApplicationHistoryItem[]>(`/applications/${id}/history`),
  },

  // ── Notice Board ──
  notices: {
    getMyNotices: (params?: { category?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.category) q.set("category", params.category);
      if (params?.search) q.set("search", params.search);
      return apiFetch<Notice[]>(`/notices/my${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getNotices: (params?: { is_active?: boolean; audience_type?: AudienceType; category?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
      if (params?.audience_type) q.set("audience_type", params.audience_type);
      if (params?.category) q.set("category", params.category);
      if (params?.search) q.set("search", params.search);
      return apiFetch<Notice[]>(`/notices${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getNotice: (id: number) =>
      apiFetch<Notice>(`/notices/${id}`),
    createNotice: (data: {
      title: string;
      content: string;
      audience_type: AudienceType;
      department_id?: number | null;
      branch_id?: number | null;
      student_group_id?: number | null;
      category?: string | null;
      expires_at?: string | null;
      is_active?: boolean;
    }) => apiFetch<Notice>("/notices", { method: "POST", body: JSON.stringify(data) }),
    updateNotice: (
      id: number,
      data: {
        title?: string;
        content?: string;
        audience_type?: AudienceType;
        department_id?: number | null;
        branch_id?: number | null;
        student_group_id?: number | null;
        category?: string | null;
        expires_at?: string | null;
        is_active?: boolean;
      }
    ) => apiFetch<Notice>(`/notices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteNotice: (id: number) =>
      apiFetch<Notice>(`/notices/${id}`, { method: "DELETE" }),
  },

  // ── Notifications ──
  notifications: {
    getMyNotifications: (params?: {
      is_read?: boolean;
      notification_type?: string;
      search?: string;
      start_date?: string;
      end_date?: string;
      limit?: number;
      offset?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.is_read !== undefined) q.set("is_read", String(params.is_read));
      if (params?.notification_type) q.set("notification_type", params.notification_type);
      if (params?.search) q.set("search", params.search);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      return apiFetch<Notification[]>(`/notifications/my${qs ? `?${qs}` : ""}`);
    },
    getCounts: () => apiFetch<NotificationCounts>("/notifications/counts"),
    markAsRead: (id: number) =>
      apiFetch<Notification>(`/notifications/${id}/read`, { method: "PATCH" }),
    markAllAsRead: () =>
      apiFetch<{ marked_count: number; message: string }>("/notifications/read-all", { method: "PATCH" }),
    deleteNotification: (id: number) =>
      apiFetch<{ success: boolean; message: string }>(`/notifications/${id}`, { method: "DELETE" }),
  },

  // ── Faculty Profiles & Responsibilities ──
  faculty: {
    getProfiles: (departmentId?: number, query?: string) => {
      const q = new URLSearchParams();
      if (departmentId) q.set("department_id", String(departmentId));
      if (query) q.set("query", query);
      return apiFetch<FacultyDetail[]>(`/faculty/profiles${q.toString() ? `?${q.toString()}` : ""}`);
    },
    createProfile: (data: {
      email: string;
      password?: string;
      full_name: string;
      employee_id: string;
      phone?: string;
      department_id?: number;
      department?: string;
      designation?: string;
      subjects?: string[];
      sections_assigned?: string[];
      college_id?: number;
    }) =>
      apiFetch<FacultyDetail>("/faculty/profiles", { method: "POST", body: JSON.stringify(data) }),
    updateProfile: (
      id: number,
      data: Partial<{
        full_name: string;
        phone: string;
        employee_id: string;
        department_id: number;
        department: string;
        designation: string;
        is_active: boolean;
        subjects: string[];
        sections_assigned: string[];
      }>
    ) =>
      apiFetch<FacultyDetail>(`/faculty/profiles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteProfile: (id: number, force: boolean = false) =>
      apiFetch<{ message: string }>(`/faculty/profiles/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
    getProfile: (id: number) =>
      apiFetch<FacultyDetail>(`/faculty/profiles/${id}`),
    getMyProfile: () =>
      apiFetch<FacultyProfile>("/faculty/me/profile"),
    getMyClasses: () =>
      apiFetch<FacultyClassRead[]>("/faculty/my-classes"),
    assignResponsibility: (data: {
      faculty_id: number;
      responsibility_type: ResponsibilityType;
      scope_type: ScopeType;
      college_id?: number | null;
      department_id?: number | null;
      section_id?: number | null;
    }) => apiFetch<FacultyResponsibility>("/faculty/responsibilities", { method: "POST", body: JSON.stringify(data) }),
    deactivateResponsibility: (id: number) =>
      apiFetch<FacultyResponsibility>(`/faculty/responsibilities/${id}/deactivate`, { method: "PATCH" }),
    coordinator: {
      getDesk: (sectionId?: number) =>
        apiFetch<CoordinatorDeskSummary>(`/faculty/coordinator/desk${sectionId ? `?section_id=${sectionId}` : ""}`),
      getStudents: (sectionId?: number) =>
        apiFetch<StudentDetail[]>(`/faculty/coordinator/students${sectionId ? `?section_id=${sectionId}` : ""}`),
      getMatrix: (sectionId?: number) =>
        apiFetch<CoordinatorMatrixResponse>(`/faculty/coordinator/matrix${sectionId ? `?section_id=${sectionId}` : ""}`),
    },
  },

  // ── Students & Device Management ──
  students: {
    getStudents: (params?: { query?: string; section_id?: number; is_active?: boolean; has_device?: boolean }) => {
      const q = new URLSearchParams();
      if (params?.query) q.set("query", params.query);
      if (params?.section_id) q.set("section_id", String(params.section_id));
      if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
      if (params?.has_device !== undefined) q.set("has_device", String(params.has_device));
      return apiFetch<StudentDetail[]>(`/students${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getStudent: (id: number) =>
      apiFetch<StudentDetail>(`/students/${id}`),
    createStudent: (data: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      roll_number: string;
      enrollment_number?: string;
      course_id?: number;
      branch_id?: number;
      batch_id?: number;
      section_id?: number;
      current_group_id?: number;
      college_id?: number;
      device_id?: string;
    }) => apiFetch<StudentDetail>("/students", { method: "POST", body: JSON.stringify(data) }),
    updateStudent: (id: number, data: Partial<StudentDetail>) =>
      apiFetch<StudentDetail>(`/students/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    bindDevice: (id: number, data: { device_id: string; platform?: string; model?: string }) =>
      apiFetch<StudentDetail>(`/students/${id}/bind-device`, { method: "POST", body: JSON.stringify(data) }),
    resetDevice: (id: number, reason: string) =>
      apiFetch<{ message: string }>(`/students/${id}/reset-device`, { method: "POST", body: JSON.stringify({ reason }) }),
    resetPassword: (id: number, new_password: string) =>
      apiFetch<{ message: string }>(`/students/${id}/reset-password`, { method: "POST", body: JSON.stringify({ new_password }) }),
    toggleStatus: (id: number) =>
      apiFetch<{ message: string }>(`/students/${id}/toggle-status`, { method: "PATCH" }),
    deleteStudent: (id: number, force: boolean = false) =>
      apiFetch<{ message: string }>(`/students/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
  },

  // ── Audit Logs ──
  audit: {
    getLogs: async (params?: {
      action?: string;
      entity_type?: string;
      entity_id?: number;
      user_id?: number;
      query?: string;
      role?: string;
      actor_name?: string;
      start_date?: string;
      end_date?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ items: AuditLogEntry[]; total: number }> => {
      const q = new URLSearchParams();
      if (params?.action) q.set("action", params.action);
      if (params?.entity_type) q.set("entity_type", params.entity_type);
      if (params?.entity_id !== undefined && params?.entity_id !== null) q.set("entity_id", String(params.entity_id));
      if (params?.user_id !== undefined && params?.user_id !== null) q.set("user_id", String(params.user_id));
      if (params?.query) q.set("query", params.query);
      if (params?.role) q.set("role", params.role);
      if (params?.actor_name) q.set("actor_name", params.actor_name);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      if (params?.limit !== undefined) q.set("limit", String(params.limit));
      if (params?.offset !== undefined) q.set("offset", String(params.offset));

      const token = getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/audit/logs${q.toString() ? `?${q.toString()}` : ""}`, { headers });
      if (!res.ok) {
        throw new Error(`Failed to load audit logs (${res.status}): ${res.statusText}`);
      }
      const totalHeader = res.headers.get("X-Total-Count");
      const items: AuditLogEntry[] = await res.json();
      const total = totalHeader ? parseInt(totalHeader, 10) : items.length;
      return { items, total };
    },
  },

  // ── System Configuration ──
  systemConfig: {
    getSettings: () =>
      apiFetch<SystemSettingItem[]>("/system/config"),
    updateSettings: (settings: Record<string, string>, reason?: string) =>
      apiFetch<SystemSettingItem[]>("/system/config", { method: "PUT", body: JSON.stringify({ settings, reason }) }),
    updateSingle: (key: string, value: string) =>
      apiFetch<SystemSettingItem>(`/system/config/${key}`, { method: "PUT", body: JSON.stringify({ key, value }) }),
  },

  // ── Rooms & Geofences ──
  rooms: {
    getRooms: (campusId?: number) =>
      apiFetch<RoomItem[]>(`/rooms${campusId ? `?campus_id=${campusId}` : ""}`),
    createRoom: (data: Partial<RoomItem> & { campus_id: number; name: string }) =>
      apiFetch<RoomItem>("/rooms", { method: "POST", body: JSON.stringify(data) }),
    updateRoom: (id: number, data: Partial<RoomItem>) =>
      apiFetch<RoomItem>(`/rooms/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteRoom: (id: number) =>
      apiFetch<{ message: string }>(`/rooms/${id}`, { method: "DELETE" }),
  },

  // ── Attendance Overrides & Master Records ──
  attendanceAdmin: {
    getStats: () =>
      apiFetch<AdminAttendanceStats>("/attendance/admin/monitor-stats"),
    getSessions: (params?: {
      department_id?: number;
      status?: SessionStatus;
      session_date?: string;
      query?: string;
      faculty_id?: number;
      section_id?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.department_id) q.set("department_id", String(params.department_id));
      if (params?.status) q.set("status", params.status);
      if (params?.session_date) q.set("session_date", params.session_date);
      if (params?.query) q.set("query", params.query);
      if (params?.faculty_id) q.set("faculty_id", String(params.faculty_id));
      if (params?.section_id) q.set("section_id", String(params.section_id));
      return apiFetch<AttendanceSession[]>(`/attendance/admin/sessions${q.toString() ? `?${q.toString()}` : ""}`);
    },
    getRecords: (params?: {
      student_id?: number;
      session_id?: number;
      section_id?: number;
      department_id?: number;
      status?: string;
      is_suspicious?: boolean;
      date_from?: string;
      date_to?: string;
      query?: string;
      limit?: number;
      offset?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.student_id) q.set("student_id", String(params.student_id));
      if (params?.session_id) q.set("session_id", String(params.session_id));
      if (params?.section_id) q.set("section_id", String(params.section_id));
      if (params?.department_id) q.set("department_id", String(params.department_id));
      if (params?.status) q.set("status", params.status);
      if (params?.is_suspicious !== undefined) q.set("is_suspicious", String(params.is_suspicious));
      if (params?.date_from) q.set("date_from", params.date_from);
      if (params?.date_to) q.set("date_to", params.date_to);
      if (params?.query) q.set("query", params.query);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      return apiFetch<AdminAttendanceRecordItem[]>(`/attendance/admin/records${q.toString() ? `?${q.toString()}` : ""}`);
    },
    overrideRecord: (recordId: number, status: string, reason: string) =>
      apiFetch<AttendanceRecord>(`/attendance/records/${recordId}/override`, { method: "POST", body: JSON.stringify({ status, reason }) }),
    getRecordHistory: (recordId: number) =>
      apiFetch<RecordAuditLogItem[]>(`/attendance/records/${recordId}/history`),
    getAnalytics: () =>
      apiFetch<AdminAnalyticsData>("/attendance/admin/analytics"),
    exportCsvBlob: async (): Promise<Blob> => {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/attendance/admin/export-csv`, { headers });
      if (!res.ok) {
        throw new Error(`Export failed (${res.status}): ${res.statusText}`);
      }
      return await res.blob();
    },
  },
};
