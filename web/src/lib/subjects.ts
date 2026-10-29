import {
  api,
  SubjectMaster,
  SubjectOffering,
  FacultyAssignment,
  ClassType,
} from "./api";

export type { SubjectMaster, SubjectOffering, FacultyAssignment };
export type Subject = SubjectMaster;

export interface ListResponse<T> {
  data: T[];
  total: number;
}

// ─────────────────────────────────────────────────────────────
// Master Subjects
// ─────────────────────────────────────────────────────────────
export async function listSubjects(
  params: { page?: number; per_page?: number; q?: string; department_id?: number; is_active?: boolean } = {}
): Promise<ListResponse<SubjectMaster>> {
  const subjects = await api.subjects.getMasterSubjects({
    department_id: params.department_id,
    is_active: params.is_active,
    query: params.q,
  });

  const page = params.page || 1;
  const perPage = params.per_page || 25;
  const start = (page - 1) * perPage;

  return {
    data: subjects.slice(start, start + perPage),
    total: subjects.length,
  };
}

export async function createSubject(payload: {
  college_id?: number;
  name: string;
  code: string;
  credits: number;
  description?: string;
  department_id?: number;
}): Promise<SubjectMaster> {
  return api.subjects.createMasterSubject({
    college_id: payload.college_id || 1,
    name: payload.name.trim(),
    code: payload.code.trim().toUpperCase(),
    credits: Number(payload.credits),
    description: payload.description?.trim() || undefined,
    department_id: payload.department_id,
  });
}

export async function updateSubject(
  id: number,
  payload: Partial<SubjectMaster>
): Promise<SubjectMaster> {
  return api.subjects.updateMasterSubject(id, payload);
}

export async function deleteSubject(id: number): Promise<void> {
  await api.subjects.deleteMasterSubject(id);
}

// ─────────────────────────────────────────────────────────────
// Subject Offerings
// ─────────────────────────────────────────────────────────────
export async function listOfferings(
  params: {
    page?: number;
    per_page?: number;
    q?: string;
    course_id?: number;
    branch_id?: number;
    batch_id?: number;
    section_id?: number;
    semester?: number;
    class_type?: string;
    is_active?: boolean;
  } = {}
): Promise<ListResponse<SubjectOffering>> {
  const offerings = await api.subjects.getOfferings({
    course_id: params.course_id,
    branch_id: params.branch_id,
    batch_id: params.batch_id,
    section_id: params.section_id,
    semester: params.semester,
    class_type: params.class_type,
    is_active: params.is_active,
    query: params.q,
  });

  const page = params.page || 1;
  const perPage = params.per_page || 25;
  const start = (page - 1) * perPage;

  return {
    data: offerings.slice(start, start + perPage),
    total: offerings.length,
  };
}

export async function createOffering(data: {
  subject_id: number;
  course_id: number;
  branch_id: number;
  batch_id?: number;
  semester: number;
  section_id: number;
  student_group_id?: number | null;
  class_type: ClassType;
  academic_year?: string;
}): Promise<SubjectOffering> {
  return api.subjects.createOffering(data);
}

export async function updateOffering(
  id: number,
  data: Partial<SubjectOffering>
): Promise<SubjectOffering> {
  return api.subjects.updateOffering(id, data);
}

export async function deleteOffering(id: number): Promise<void> {
  await api.subjects.deleteOffering(id);
}

// ─────────────────────────────────────────────────────────────
// Faculty Assignments
// ─────────────────────────────────────────────────────────────
export async function listAssignments(
  params: {
    page?: number;
    per_page?: number;
    q?: string;
    faculty_id?: number;
    offering_id?: number;
    is_active?: boolean;
  } = {}
): Promise<ListResponse<FacultyAssignment>> {
  const assignments = await api.subjects.getAssignments({
    faculty_id: params.faculty_id,
    offering_id: params.offering_id,
    is_active: params.is_active,
    query: params.q,
  });

  const page = params.page || 1;
  const perPage = params.per_page || 25;
  const start = (page - 1) * perPage;

  return {
    data: assignments.slice(start, start + perPage),
    total: assignments.length,
  };
}

export async function createAssignment(data: {
  subject_offering_id: number;
  faculty_id: number;
  is_primary?: boolean;
}): Promise<FacultyAssignment> {
  return api.subjects.createAssignment(data);
}

export async function updateAssignment(
  id: number,
  data: Partial<FacultyAssignment>
): Promise<FacultyAssignment> {
  return api.subjects.updateAssignment(id, data);
}

export async function deleteAssignment(id: number): Promise<void> {
  await api.subjects.deleteAssignment(id);
}
