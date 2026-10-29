import { api, Department } from "./api";

export type { Department };

export interface ListResponse<T> {
  data: T[];
  total: number;
}

export async function listDepartments(params: { page?: number; per_page?: number; q?: string } = {}): Promise<ListResponse<Department>> {
  const depts = await api.academic.getDepartments();
  let filtered = depts;
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = depts.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q));
  }
  const page = params.page || 1;
  const perPage = params.per_page || 25;
  const start = (page - 1) * perPage;
  return {
    data: filtered.slice(start, start + perPage),
    total: filtered.length,
  };
}

export async function createDepartment(payload: { college_id?: number; name: string; code: string }): Promise<Department> {
  return api.academic.createDepartment({
    college_id: payload.college_id || 1,
    name: payload.name,
    code: payload.code,
  });
}

export async function updateDepartment(id: number, payload: Partial<Department>): Promise<Department> {
  return api.academic.updateDepartment(id, payload);
}

export async function deleteDepartment(id: number): Promise<void> {
  await api.academic.deleteDepartment(id);
}
