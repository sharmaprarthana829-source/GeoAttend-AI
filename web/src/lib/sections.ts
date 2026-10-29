import { api, Section } from "./api";

export type { Section };

export interface ListResponse<T> {
  data: T[];
  total: number;
}

export async function listSections(params: { page?: number; per_page?: number; q?: string; batch_id?: number } = {}): Promise<ListResponse<Section>> {
  const sections = await api.academic.getSections(params.batch_id);
  let filtered = sections;
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = sections.filter((s) => s.name.toLowerCase().includes(q));
  }
  const page = params.page || 1;
  const perPage = params.per_page || 25;
  const start = (page - 1) * perPage;
  return {
    data: filtered.slice(start, start + perPage),
    total: filtered.length,
  };
}

export async function createSection(payload: { batch_id: number; name: string }): Promise<Section> {
  return api.academic.createSection(payload);
}

export async function updateSection(id: number, payload: Partial<Section>): Promise<Section> {
  return api.academic.updateSection(id, payload);
}

export async function deleteSection(id: number): Promise<void> {
  await api.academic.deleteSection(id);
}
