import { api, AcademicEnrollment } from "./api";

export interface Student {
  id: number;
  student_id: string;
  full_name: string;
  email: string;
  phone?: string;
  department?: string;
  branch?: string;
  program?: string;
  section?: string;
  group?: string;
  semester?: number;
  attendance_percent?: number;
  device_status?: string;
  last_checkin?: string;
  is_active?: boolean;
}

export interface ListResponse<T> {
  data: T[];
  total: number;
}

export async function listStudents(params: { page?: number; per_page?: number; q?: string; section_id?: number } = {}): Promise<ListResponse<Student>> {
  const enrollments = await api.academic.getEnrollments({
    section_id: params.section_id,
    is_current: true,
  });

  let students: Student[] = enrollments.map((e) => ({
    id: e.student_id,
    student_id: e.student_roll_number || `S-${e.student_id}`,
    full_name: e.student_name || `Student ${e.student_id}`,
    email: `student${e.student_id}@geoattend.ai`,
    branch: e.branch_name || undefined,
    section: e.section_name || undefined,
    group: e.student_group_name || undefined,
    semester: e.semester,
    attendance_percent: 85,
    is_active: e.is_current,
  }));

  if (params.q) {
    const q = params.q.toLowerCase();
    students = students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.student_id.toLowerCase().includes(q) ||
        (s.branch || "").toLowerCase().includes(q)
    );
  }

  const page = params.page || 1;
  const perPage = params.per_page || 25;
  const start = (page - 1) * perPage;

  return {
    data: students.slice(start, start + perPage),
    total: students.length,
  };
}
