import 'timetable_models.dart';

class SubjectMaster {
  final int id;
  final int collegeId;
  final String name;
  final String code;
  final int credits;
  final String? description;
  final bool isActive;

  SubjectMaster({
    required this.id,
    required this.collegeId,
    required this.name,
    required this.code,
    required this.credits,
    this.description,
    required this.isActive,
  });

  factory SubjectMaster.fromJson(Map<String, dynamic> json) {
    return SubjectMaster(
      id: json['id'] as int,
      collegeId: json['college_id'] as int? ?? 1,
      name: json['name'] as String,
      code: json['code'] as String,
      credits: json['credits'] as int? ?? 4,
      description: json['description'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class SubjectOffering {
  final int id;
  final int subjectId;
  final int courseId;
  final int branchId;
  final int batchId;
  final int semester;
  final String academicYear;
  final ClassType classType;
  final int? sectionId;
  final int? studentGroupId;
  final String? subjectName;
  final String? subjectCode;
  final String? branchName;
  final String? sectionName;
  final String? studentGroupName;
  final bool isActive;

  SubjectOffering({
    required this.id,
    required this.subjectId,
    required this.courseId,
    required this.branchId,
    required this.batchId,
    required this.semester,
    required this.academicYear,
    required this.classType,
    this.sectionId,
    this.studentGroupId,
    this.subjectName,
    this.subjectCode,
    this.branchName,
    this.sectionName,
    this.studentGroupName,
    required this.isActive,
  });

  factory SubjectOffering.fromJson(Map<String, dynamic> json) {
    return SubjectOffering(
      id: json['id'] as int,
      subjectId: json['subject_id'] as int,
      courseId: json['course_id'] as int,
      branchId: json['branch_id'] as int,
      batchId: json['batch_id'] as int,
      semester: json['semester'] as int,
      academicYear: json['academic_year'] as String,
      classType: ClassType.fromString(json['class_type'] as String? ?? 'theory'),
      sectionId: json['section_id'] as int?,
      studentGroupId: json['student_group_id'] as int?,
      subjectName: json['subject_name'] as String?,
      subjectCode: json['subject_code'] as String?,
      branchName: json['branch_name'] as String?,
      sectionName: json['section_name'] as String?,
      studentGroupName: json['student_group_name'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class FacultyAssignment {
  final int id;
  final int subjectOfferingId;
  final int facultyId;
  final bool isPrimary;
  final String? facultyName;
  final String? facultyEmployeeId;
  final SubjectOffering? subjectOffering;
  final bool isActive;

  FacultyAssignment({
    required this.id,
    required this.subjectOfferingId,
    required this.facultyId,
    required this.isPrimary,
    this.facultyName,
    this.facultyEmployeeId,
    this.subjectOffering,
    required this.isActive,
  });

  factory FacultyAssignment.fromJson(Map<String, dynamic> json) {
    return FacultyAssignment(
      id: json['id'] as int,
      subjectOfferingId: json['subject_offering_id'] as int,
      facultyId: json['faculty_id'] as int,
      isPrimary: json['is_primary'] as bool? ?? true,
      facultyName: json['faculty_name'] as String?,
      facultyEmployeeId: json['faculty_employee_id'] as String?,
      subjectOffering: json['subject_offering'] != null
          ? SubjectOffering.fromJson(json['subject_offering'] as Map<String, dynamic>)
          : null,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}
