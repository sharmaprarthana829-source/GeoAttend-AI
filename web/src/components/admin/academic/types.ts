import {
  Course,
  Department,
  Branch,
  Batch,
  Section,
  StudentGroup,
  AcademicEnrollment,
} from "@/lib/api";

export type AcademicLevel =
  | "courses"
  | "departments"
  | "branches"
  | "batches"
  | "sections"
  | "groups"
  | "enrollments";

export interface AcademicHierarchyState {
  level: AcademicLevel;
  selectedCourse: Course | null;
  selectedDepartment: Department | null;
  selectedBranch: Branch | null;
  selectedBatch: Batch | null;
  selectedSection: Section | null;
  selectedGroup: StudentGroup | null;
}

export interface BreadcrumbNode {
  label: string;
  sublabel?: string;
  level: AcademicLevel;
  onClick: () => void;
  active: boolean;
}
