"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  api,
  Course,
  Department,
  Branch,
  Batch,
  Section,
  StudentGroup,
  AcademicEnrollment,
  User,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import {
  AcademicLevel,
  AcademicHierarchyState,
  BreadcrumbNode,
  AcademicBreadcrumbs,
  EntityDeleteModal,
  CourseModal,
  DepartmentModal,
  BranchModal,
  BatchModal,
  SectionModal,
  StudentGroupModal,
  EnrollmentModal,
  CoursesView,
  DepartmentsView,
  BranchesView,
  BatchesView,
  SectionsView,
  StudentGroupsView,
  EnrollmentsView,
} from "@/components/admin/academic";
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  GraduationCap,
  Sparkles,
} from "lucide-react";

export default function AcademicStructurePage() {
  // ── 1. Role & Auth State ──
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isAdmin = currentUser ? currentUser.role === "admin" : true; // Default admin while loading or fallback

  // ── 2. Hierarchy Navigation State ──
  const [hierarchyState, setHierarchyState] = useState<AcademicHierarchyState>({
    level: "courses",
    selectedCourse: null,
    selectedDepartment: null,
    selectedBranch: null,
    selectedBatch: null,
    selectedSection: null,
    selectedGroup: null,
  });

  const {
    level,
    selectedCourse,
    selectedDepartment,
    selectedBranch,
    selectedBatch,
    selectedSection,
    selectedGroup,
  } = hierarchyState;

  // ── 3. Entity Data States ──
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [enrollments, setEnrollments] = useState<AcademicEnrollment[]>([]);

  // ── 4. Loading & Error States ──
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── 5. Modal States ──
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);

  // Editing Items
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null);
  const [editingEnrollment, setEditingEnrollment] = useState<AcademicEnrollment | null>(null);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: string;
    name: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Fetch Current User ──
  useEffect(() => {
    api.auth
      .me()
      .then((u) => setCurrentUser(u))
      .catch(() => {
        // Fallback or unauthenticated
      });
  }, []);

  // ── Data Fetching Logic for Current Active Level ──
  const loadDataForCurrentLevel = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      if (level === "courses") {
        const data = await api.academic.getCourses();
        setCourses(data);
      } else if (level === "departments") {
        if (!selectedCourse) return;
        const data = await api.academic.getDepartments(selectedCourse.id);
        setDepartments(data);
      } else if (level === "branches") {
        if (!selectedDepartment) return;
        const data = await api.academic.getBranches(selectedDepartment.id);
        setBranches(data);
      } else if (level === "batches") {
        if (!selectedBranch) return;
        const data = await api.academic.getBatches(selectedBranch.id);
        setBatches(data);
      } else if (level === "sections") {
        if (!selectedBatch) return;
        const data = await api.academic.getSections(selectedBatch.id);
        setSections(data);
      } else if (level === "groups") {
        if (!selectedSection) return;
        const data = await api.academic.getStudentGroups(selectedSection.id);
        setGroups(data);
      } else if (level === "enrollments") {
        if (!selectedSection) return;
        const params: any = { section_id: selectedSection.id };
        if (selectedGroup) {
          params.student_group_id = selectedGroup.id;
        }
        const data = await api.academic.getEnrollments(params);
        setEnrollments(data);
      }
    } catch (err: any) {
      console.error("Error loading academic data:", err);
      setFetchError(
        err.message || "Failed to load records from backend. Please check network connection."
      );
    } finally {
      setLoading(false);
    }
  }, [
    level,
    selectedCourse,
    selectedDepartment,
    selectedBranch,
    selectedBatch,
    selectedSection,
    selectedGroup,
  ]);

  useEffect(() => {
    loadDataForCurrentLevel();
  }, [loadDataForCurrentLevel]);

  // ── Breadcrumb Hierarchy Construction ──
  const breadcrumbs = useMemo<BreadcrumbNode[]>(() => {
    const list: BreadcrumbNode[] = [
      {
        label: "Academic Structure",
        sublabel: "Courses",
        level: "courses",
        active: level === "courses",
        onClick: () => {
          setHierarchyState({
            level: "courses",
            selectedCourse: null,
            selectedDepartment: null,
            selectedBranch: null,
            selectedBatch: null,
            selectedSection: null,
            selectedGroup: null,
          });
        },
      },
    ];

    if (selectedCourse) {
      list.push({
        label: selectedCourse.name,
        sublabel: selectedCourse.code,
        level: "departments",
        active: level === "departments",
        onClick: () => {
          setHierarchyState((prev) => ({
            ...prev,
            level: "departments",
            selectedDepartment: null,
            selectedBranch: null,
            selectedBatch: null,
            selectedSection: null,
            selectedGroup: null,
          }));
        },
      });
    }

    if (selectedDepartment && !["courses"].includes(level)) {
      list.push({
        label: selectedDepartment.name,
        sublabel: selectedDepartment.code,
        level: "branches",
        active: level === "branches",
        onClick: () => {
          setHierarchyState((prev) => ({
            ...prev,
            level: "branches",
            selectedBranch: null,
            selectedBatch: null,
            selectedSection: null,
            selectedGroup: null,
          }));
        },
      });
    }

    if (selectedBranch && !["courses", "departments"].includes(level)) {
      list.push({
        label: selectedBranch.name,
        sublabel: selectedBranch.code,
        level: "batches",
        active: level === "batches",
        onClick: () => {
          setHierarchyState((prev) => ({
            ...prev,
            level: "batches",
            selectedBatch: null,
            selectedSection: null,
            selectedGroup: null,
          }));
        },
      });
    }

    if (selectedBatch && !["courses", "departments", "branches"].includes(level)) {
      list.push({
        label: selectedBatch.name,
        sublabel: `${selectedBatch.start_year}–${selectedBatch.end_year}`,
        level: "sections",
        active: level === "sections",
        onClick: () => {
          setHierarchyState((prev) => ({
            ...prev,
            level: "sections",
            selectedSection: null,
            selectedGroup: null,
          }));
        },
      });
    }

    if (selectedSection && ["groups", "enrollments"].includes(level)) {
      list.push({
        label: selectedSection.name,
        level: "groups",
        active: level === "groups" && !selectedGroup,
        onClick: () => {
          setHierarchyState((prev) => ({
            ...prev,
            level: "groups",
            selectedGroup: null,
          }));
        },
      });
    }

    if (selectedGroup && level === "enrollments") {
      list.push({
        label: `Group ${selectedGroup.name}`,
        level: "enrollments",
        active: true,
        onClick: () => {},
      });
    }

    return list;
  }, [
    level,
    selectedCourse,
    selectedDepartment,
    selectedBranch,
    selectedBatch,
    selectedSection,
    selectedGroup,
  ]);

  // ── Back Button Handler ──
  const handleBack = useCallback(() => {
    if (level === "enrollments") {
      if (selectedGroup) {
        setHierarchyState((prev) => ({
          ...prev,
          level: "groups",
          selectedGroup: null,
        }));
      } else {
        setHierarchyState((prev) => ({
          ...prev,
          level: "sections",
          selectedSection: null,
        }));
      }
    } else if (level === "groups") {
      setHierarchyState((prev) => ({
        ...prev,
        level: "sections",
        selectedSection: null,
      }));
    } else if (level === "sections") {
      setHierarchyState((prev) => ({
        ...prev,
        level: "batches",
        selectedBatch: null,
      }));
    } else if (level === "batches") {
      setHierarchyState((prev) => ({
        ...prev,
        level: "branches",
        selectedBranch: null,
      }));
    } else if (level === "branches") {
      setHierarchyState((prev) => ({
        ...prev,
        level: "departments",
        selectedDepartment: null,
      }));
    } else if (level === "departments") {
      setHierarchyState({
        level: "courses",
        selectedCourse: null,
        selectedDepartment: null,
        selectedBranch: null,
        selectedBatch: null,
        selectedSection: null,
        selectedGroup: null,
      });
    }
  }, [level, selectedGroup]);

  // Back Label
  const backLabel = useMemo(() => {
    switch (level) {
      case "departments":
        return "Back to Courses";
      case "branches":
        return `Back to ${selectedCourse?.code || "Departments"}`;
      case "batches":
        return `Back to ${selectedDepartment?.name || "Branches"}`;
      case "sections":
        return `Back to ${selectedBranch?.code || "Batches"}`;
      case "groups":
        return `Back to ${selectedBatch?.name || "Sections"}`;
      case "enrollments":
        return selectedGroup ? `Back to Groups` : `Back to Sections`;
      default:
        return undefined;
    }
  }, [level, selectedCourse, selectedDepartment, selectedBranch, selectedBatch, selectedGroup]);

  // ── Delete Trigger Helper ──
  const triggerDelete = (
    type: string,
    name: string,
    action: () => Promise<any>
  ) => {
    setDeleteTarget({
      type,
      name,
      onConfirm: async () => {
        await action();
      },
    });
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteTarget.onConfirm();
      setDeleteModalOpen(false);
      await loadDataForCurrentLevel();
    } catch (err: any) {
      setDeleteError(
        err.message || "Failed to delete entity. Active dependencies may exist."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-emerald-400 font-medium">Academic Structure</span>
          </nav>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Academic Hierarchy Management
            <span className="text-xs font-normal text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Realtime Database
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Navigate through Course → Department → Branch → Batch → Section → Student Groups & Enrollments.
            Drill down into any entity to inspect and manage its child records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => loadDataForCurrentLevel()}
            variant="outline"
            size="sm"
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-300 border-slate-800 hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Breadcrumb Navigation Bar */}
      <AcademicBreadcrumbs
        breadcrumbs={breadcrumbs}
        onBack={level !== "courses" ? handleBack : undefined}
        backLabel={backLabel}
      />

      {/* Error State Banner */}
      {fetchError && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 text-xs text-red-300 flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-red-200">Unable to reach Academic Backend API</p>
              <p className="text-red-300/80">{fetchError}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadDataForCurrentLevel()}
            className="text-xs h-7 px-3 border-red-500/30 hover:bg-red-950/60 text-red-200 shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* ── Active Level Views ── */}
      {loading && !courses.length && !departments.length && !branches.length && !batches.length && !sections.length && !groups.length && !enrollments.length ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 bg-surface-900/40 rounded-xl border border-slate-800">
          <Loader2 className="h-7 w-7 text-emerald-500 animate-spin" />
          <p className="text-sm font-medium text-slate-300">Loading academic records from database...</p>
          <p className="text-xs text-slate-500">Querying MySQL through FastAPI services</p>
        </div>
      ) : (
        <>
          {/* Level 1: Courses */}
          {level === "courses" && (
            <CoursesView
              courses={courses}
              loading={loading}
              onOpenDepartments={(course) => {
                setHierarchyState({
                  level: "departments",
                  selectedCourse: course,
                  selectedDepartment: null,
                  selectedBranch: null,
                  selectedBatch: null,
                  selectedSection: null,
                  selectedGroup: null,
                });
              }}
              onAddCourse={() => {
                setEditingCourse(null);
                setCourseModalOpen(true);
              }}
              onEditCourse={(course) => {
                setEditingCourse(course);
                setCourseModalOpen(true);
              }}
              onDeleteCourse={(course) => {
                triggerDelete("Course", course.name, () =>
                  api.academic.deleteCourse(course.id)
                );
              }}
            />
          )}

          {/* Level 2: Departments */}
          {level === "departments" && selectedCourse && (
            <DepartmentsView
              departments={departments}
              parentCourse={selectedCourse}
              loading={loading}
              onOpenBranches={(dept) => {
                setHierarchyState((prev) => ({
                  ...prev,
                  level: "branches",
                  selectedDepartment: dept,
                  selectedBranch: null,
                  selectedBatch: null,
                  selectedSection: null,
                  selectedGroup: null,
                }));
              }}
              onAddDepartment={() => {
                setEditingDept(null);
                setDeptModalOpen(true);
              }}
              onEditDepartment={(dept) => {
                setEditingDept(dept);
                setDeptModalOpen(true);
              }}
              onDeleteDepartment={(dept) => {
                triggerDelete("Department", dept.name, () =>
                  api.academic.deleteDepartment(dept.id)
                );
              }}
            />
          )}

          {/* Level 3: Branches */}
          {level === "branches" && selectedDepartment && selectedCourse && (
            <BranchesView
              branches={branches}
              parentDepartment={selectedDepartment}
              parentCourse={selectedCourse}
              loading={loading}
              onOpenBatches={(branch) => {
                setHierarchyState((prev) => ({
                  ...prev,
                  level: "batches",
                  selectedBranch: branch,
                  selectedBatch: null,
                  selectedSection: null,
                  selectedGroup: null,
                }));
              }}
              onAddBranch={() => {
                setEditingBranch(null);
                setBranchModalOpen(true);
              }}
              onEditBranch={(branch) => {
                setEditingBranch(branch);
                setBranchModalOpen(true);
              }}
              onDeleteBranch={(branch) => {
                triggerDelete("Branch", branch.name, () =>
                  api.academic.deleteBranch(branch.id)
                );
              }}
            />
          )}

          {/* Level 4: Batches */}
          {level === "batches" && selectedBranch && selectedDepartment && (
            <BatchesView
              batches={batches}
              parentBranch={selectedBranch}
              parentDepartment={selectedDepartment}
              loading={loading}
              onOpenSections={(batch) => {
                setHierarchyState((prev) => ({
                  ...prev,
                  level: "sections",
                  selectedBatch: batch,
                  selectedSection: null,
                  selectedGroup: null,
                }));
              }}
              onAddBatch={() => {
                setEditingBatch(null);
                setBatchModalOpen(true);
              }}
              onEditBatch={(batch) => {
                setEditingBatch(batch);
                setBatchModalOpen(true);
              }}
              onDeleteBatch={(batch) => {
                triggerDelete("Batch", batch.name, () =>
                  api.academic.deleteBatch(batch.id)
                );
              }}
            />
          )}

          {/* Level 5: Sections */}
          {level === "sections" && selectedBatch && selectedBranch && selectedDepartment && (
            <SectionsView
              sections={sections}
              parentBatch={selectedBatch}
              parentBranch={selectedBranch}
              parentDepartment={selectedDepartment}
              loading={loading}
              onOpenGroups={(sec) => {
                setHierarchyState((prev) => ({
                  ...prev,
                  level: "groups",
                  selectedSection: sec,
                  selectedGroup: null,
                }));
              }}
              onOpenEnrollments={(sec) => {
                setHierarchyState((prev) => ({
                  ...prev,
                  level: "enrollments",
                  selectedSection: sec,
                  selectedGroup: null,
                }));
              }}
              onAddSection={() => {
                setEditingSection(null);
                setSectionModalOpen(true);
              }}
              onEditSection={(sec) => {
                setEditingSection(sec);
                setSectionModalOpen(true);
              }}
              onDeleteSection={(sec) => {
                triggerDelete("Section", sec.name, () =>
                  api.academic.deleteSection(sec.id)
                );
              }}
            />
          )}

          {/* Level 6: Student Groups (B1, B2) */}
          {level === "groups" && selectedSection && selectedBatch && selectedBranch && (
            <StudentGroupsView
              groups={groups}
              parentSection={selectedSection}
              parentBatch={selectedBatch}
              parentBranch={selectedBranch}
              loading={loading}
              onOpenEnrollments={(grp) => {
                setHierarchyState((prev) => ({
                  ...prev,
                  level: "enrollments",
                  selectedGroup: grp,
                }));
              }}
              onAddGroup={() => {
                setEditingGroup(null);
                setGroupModalOpen(true);
              }}
              onEditGroup={(grp) => {
                setEditingGroup(grp);
                setGroupModalOpen(true);
              }}
              onDeleteGroup={(grp) => {
                triggerDelete("Student Group", grp.name, () =>
                  api.academic.deleteStudentGroup(grp.id)
                );
              }}
            />
          )}

          {/* Level 7: Student Enrollments */}
          {level === "enrollments" && selectedSection && selectedBatch && selectedBranch && selectedCourse && (
            <EnrollmentsView
              enrollments={enrollments}
              parentSection={selectedSection}
              parentGroup={selectedGroup}
              parentBatch={selectedBatch}
              parentBranch={selectedBranch}
              parentCourse={selectedCourse}
              loading={loading}
              onAddEnrollment={() => {
                setEditingEnrollment(null);
                setEnrollmentModalOpen(true);
              }}
              onEditEnrollment={(enr) => {
                setEditingEnrollment(enr);
                setEnrollmentModalOpen(true);
              }}
              onDeleteEnrollment={(enr) => {
                triggerDelete(
                  "Enrollment",
                  `${enr.student_name || "Student"} in ${enr.section_name || selectedSection.name}`,
                  () => api.academic.deleteEnrollment(enr.id)
                );
              }}
            />
          )}
        </>
      )}

      {/* ── Modals for CRUD ── */}
      {/* 1. Course Modal */}
      <CourseModal
        isOpen={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        onSuccess={loadDataForCurrentLevel}
        course={editingCourse}
        collegeId={currentUser?.college_id || 1}
      />

      {/* 2. Department Modal */}
      {selectedCourse && (
        <DepartmentModal
          isOpen={deptModalOpen}
          onClose={() => setDeptModalOpen(false)}
          onSuccess={loadDataForCurrentLevel}
          department={editingDept}
          parentCourse={selectedCourse}
          collegeId={currentUser?.college_id || 1}
        />
      )}

      {/* 3. Branch Modal */}
      {selectedDepartment && selectedCourse && (
        <BranchModal
          isOpen={branchModalOpen}
          onClose={() => setBranchModalOpen(false)}
          onSuccess={loadDataForCurrentLevel}
          branch={editingBranch}
          parentDepartment={selectedDepartment}
          parentCourse={selectedCourse}
        />
      )}

      {/* 4. Batch Modal */}
      {selectedBranch && (
        <BatchModal
          isOpen={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          onSuccess={loadDataForCurrentLevel}
          batch={editingBatch}
          parentBranch={selectedBranch}
        />
      )}

      {/* 5. Section Modal */}
      {selectedBatch && (
        <SectionModal
          isOpen={sectionModalOpen}
          onClose={() => setSectionModalOpen(false)}
          onSuccess={loadDataForCurrentLevel}
          section={editingSection}
          parentBatch={selectedBatch}
        />
      )}

      {/* 6. Student Group Modal */}
      {selectedSection && (
        <StudentGroupModal
          isOpen={groupModalOpen}
          onClose={() => setGroupModalOpen(false)}
          onSuccess={loadDataForCurrentLevel}
          group={editingGroup}
          parentSection={selectedSection}
        />
      )}

      {/* 7. Enrollment Modal */}
      {selectedCourse && selectedBranch && selectedBatch && selectedSection && (
        <EnrollmentModal
          isOpen={enrollmentModalOpen}
          onClose={() => setEnrollmentModalOpen(false)}
          onSuccess={loadDataForCurrentLevel}
          enrollment={editingEnrollment}
          parentCourse={selectedCourse}
          parentBranch={selectedBranch}
          parentBatch={selectedBatch}
          parentSection={selectedSection}
          parentGroup={selectedGroup}
          availableGroups={groups}
        />
      )}

      {/* Delete Confirmation Modal */}
      <EntityDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        entityType={deleteTarget?.type || "Entity"}
        entityName={deleteTarget?.name || ""}
        loading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
