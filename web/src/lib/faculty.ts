import { api, FacultyDetail, FacultyResponsibility } from "./api";

export interface Faculty {
  id: number;
  faculty_id: string;
  full_name: string;
  email: string;
  phone?: string;
  department?: string;
  department_id?: number;
  designation?: string;
  responsibilities?: string[];
  subjects?: string[];
  sections_assigned?: string[];
  todays_sessions?: number;
  total_sessions?: number;
  is_active?: boolean;
}

export interface ListResponse<T> {
  data: T[];
  total: number;
}

export async function listFaculty(
  params: { page?: number; per_page?: number; q?: string; department_id?: number } = {}
): Promise<ListResponse<Faculty>> {
  const profiles = await api.faculty.getProfiles(params.department_id, params.q);

  let faculties: Faculty[] = profiles.map((p) => ({
    id: p.id,
    faculty_id: p.employee_id,
    full_name: p.full_name || `Faculty (${p.employee_id})`,
    email: p.email,
    phone: p.phone || undefined,
    department: p.department_name || (p.department_id ? `Dept ${p.department_id}` : "General"),
    department_id: p.department_id,
    designation: p.designation || "Faculty",
    responsibilities: (p.responsibilities || []).map((r) => r.responsibility_type),
    subjects: p.subjects || [],
    sections_assigned: p.sections_assigned || [],
    todays_sessions: p.todays_sessions || 0,
    total_sessions: p.total_sessions || p.todays_sessions || 0,
    is_active: p.is_active !== false,
  }));

  if (params.q) {
    const q = params.q.toLowerCase();
    faculties = faculties.filter(
      (f) =>
        f.full_name.toLowerCase().includes(q) ||
        f.faculty_id.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.department || "").toLowerCase().includes(q) ||
        (f.designation || "").toLowerCase().includes(q)
    );
  }

  const page = params.page || 1;
  const perPage = params.per_page || 25;
  const start = (page - 1) * perPage;

  return {
    data: faculties.slice(start, start + perPage),
    total: faculties.length,
  };
}

export async function getFaculty(id: number): Promise<FacultyDetail | null> {
  return api.faculty.getProfile(id);
}

export async function createFaculty(data: {
  faculty_id: string;
  full_name: string;
  email: string;
  phone?: string;
  department?: string;
  department_id?: number;
  designation?: string;
  subjects?: string[];
  sections_assigned?: string[];
  password?: string;
  college_id?: number;
}): Promise<Faculty> {
  const res = await api.faculty.createProfile({
    employee_id: data.faculty_id.trim(),
    full_name: data.full_name.trim(),
    email: data.email.trim(),
    phone: data.phone?.trim() || undefined,
    department: data.department?.trim() || undefined,
    department_id: data.department_id,
    designation: data.designation?.trim() || undefined,
    subjects: data.subjects || [],
    sections_assigned: data.sections_assigned || [],
    password: data.password?.trim() || "Faculty@12345",
    college_id: data.college_id,
  });

  return {
    id: res.id,
    faculty_id: res.employee_id,
    full_name: res.full_name,
    email: res.email,
    phone: res.phone || undefined,
    department: res.department_name || undefined,
    department_id: res.department_id,
    designation: res.designation || undefined,
    responsibilities: (res.responsibilities || []).map((r) => r.responsibility_type),
    subjects: res.subjects || [],
    sections_assigned: res.sections_assigned || [],
    todays_sessions: res.todays_sessions || 0,
    is_active: res.is_active,
  };
}

export async function updateFaculty(
  id: number,
  data: Partial<{
    faculty_id: string;
    full_name: string;
    phone: string;
    department?: string;
    department_id?: number;
    designation: string;
    is_active: boolean;
    subjects: string[];
    sections_assigned: string[];
  }>
): Promise<Faculty> {
  const payload: any = {};
  if (data.faculty_id !== undefined) payload.employee_id = data.faculty_id.trim();
  if (data.full_name !== undefined) payload.full_name = data.full_name.trim();
  if (data.phone !== undefined) payload.phone = data.phone.trim();
  if (data.department_id !== undefined) payload.department_id = data.department_id;
  if (data.department !== undefined) payload.department = data.department.trim();
  if (data.designation !== undefined) payload.designation = data.designation.trim();
  if (data.is_active !== undefined) payload.is_active = data.is_active;
  if (data.subjects !== undefined) payload.subjects = data.subjects;
  if (data.sections_assigned !== undefined) payload.sections_assigned = data.sections_assigned;

  const res = await api.faculty.updateProfile(id, payload);

  return {
    id: res.id,
    faculty_id: res.employee_id,
    full_name: res.full_name,
    email: res.email,
    phone: res.phone || undefined,
    department: res.department_name || undefined,
    department_id: res.department_id,
    designation: res.designation || undefined,
    responsibilities: (res.responsibilities || []).map((r) => r.responsibility_type),
    subjects: res.subjects || [],
    sections_assigned: res.sections_assigned || [],
    todays_sessions: res.todays_sessions || 0,
    is_active: res.is_active,
  };
}

export async function deleteFaculty(id: number, force: boolean = false): Promise<{ message: string }> {
  return api.faculty.deleteProfile(id, force);
}
