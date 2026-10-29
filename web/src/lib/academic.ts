import { api, Course, Department, Branch, Batch, Section, StudentGroup, AcademicEnrollment } from "./api";

export type { Course, Department, Branch, Batch, Section, StudentGroup, AcademicEnrollment };

export const listCourses = (collegeId?: number) => api.academic.getCourses(collegeId);
export const createCourse = (data: { college_id: number; name: string; code: string; total_semesters: number }) => api.academic.createCourse(data);
export const updateCourse = (id: number, data: Partial<Course>) => api.academic.updateCourse(id, data);
export const deleteCourse = (id: number) => api.academic.deleteCourse(id);

export const listDepartments = (courseId?: number) => api.academic.getDepartments(courseId);
export const createDepartment = (data: { college_id: number; course_id?: number; name: string; code: string }) => api.academic.createDepartment(data);
export const updateDepartment = (id: number, data: Partial<Department>) => api.academic.updateDepartment(id, data);
export const deleteDepartment = (id: number) => api.academic.deleteDepartment(id);

export const listBranches = (departmentId?: number) => api.academic.getBranches(departmentId);
export const createBranch = (data: { department_id: number; course_id: number; name: string; code: string }) => api.academic.createBranch(data);
export const updateBranch = (id: number, data: Partial<Branch>) => api.academic.updateBranch(id, data);
export const deleteBranch = (id: number) => api.academic.deleteBranch(id);

export const listBatches = (branchId?: number) => api.academic.getBatches(branchId);
export const createBatch = (data: { branch_id: number; start_year: number; end_year: number }) => api.academic.createBatch(data);
export const updateBatch = (id: number, data: Partial<Batch>) => api.academic.updateBatch(id, data);
export const deleteBatch = (id: number) => api.academic.deleteBatch(id);

export const listSections = (batchId?: number) => api.academic.getSections(batchId);
export const createSection = (data: { batch_id: number; name: string }) => api.academic.createSection(data);
export const updateSection = (id: number, data: Partial<Section>) => api.academic.updateSection(id, data);
export const deleteSection = (id: number) => api.academic.deleteSection(id);

export const listStudentGroups = (sectionId?: number) => api.academic.getStudentGroups(sectionId);
export const createStudentGroup = (data: { section_id: number; name: string }) => api.academic.createStudentGroup(data);
export const updateStudentGroup = (id: number, data: Partial<StudentGroup>) => api.academic.updateStudentGroup(id, data);
export const deleteStudentGroup = (id: number) => api.academic.deleteStudentGroup(id);

export const listEnrollments = (params?: { section_id?: number; semester?: number; is_current?: boolean }) => api.academic.getEnrollments(params);
export const createEnrollment = (data: any) => api.academic.createEnrollment(data);
export const getCurrentEnrollment = (studentId: number) => api.academic.getCurrentEnrollment(studentId);
export const updateEnrollment = (id: number, data: Partial<AcademicEnrollment>) => api.academic.updateEnrollment(id, data);
