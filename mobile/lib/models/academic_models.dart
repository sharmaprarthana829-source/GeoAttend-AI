class Course {
  final int id;
  final int collegeId;
  final String name;
  final String code;
  final int totalSemesters;
  final bool isActive;

  Course({
    required this.id,
    required this.collegeId,
    required this.name,
    required this.code,
    required this.totalSemesters,
    required this.isActive,
  });

  factory Course.fromJson(Map<String, dynamic> json) {
    return Course(
      id: json['id'] as int,
      collegeId: json['college_id'] as int? ?? 1,
      name: json['name'] as String,
      code: json['code'] as String,
      totalSemesters: json['total_semesters'] as int? ?? 8,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class Department {
  final int id;
  final int collegeId;
  final int? courseId;
  final String name;
  final String code;
  final bool isActive;

  Department({
    required this.id,
    required this.collegeId,
    this.courseId,
    required this.name,
    required this.code,
    required this.isActive,
  });

  factory Department.fromJson(Map<String, dynamic> json) {
    return Department(
      id: json['id'] as int,
      collegeId: json['college_id'] as int? ?? 1,
      courseId: json['course_id'] as int?,
      name: json['name'] as String,
      code: json['code'] as String,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class Branch {
  final int id;
  final int departmentId;
  final int courseId;
  final String name;
  final String code;
  final bool isActive;

  Branch({
    required this.id,
    required this.departmentId,
    required this.courseId,
    required this.name,
    required this.code,
    required this.isActive,
  });

  factory Branch.fromJson(Map<String, dynamic> json) {
    return Branch(
      id: json['id'] as int,
      departmentId: json['department_id'] as int,
      courseId: json['course_id'] as int,
      name: json['name'] as String,
      code: json['code'] as String,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class Batch {
  final int id;
  final int branchId;
  final String name;
  final int startYear;
  final int endYear;
  final bool isActive;

  Batch({
    required this.id,
    required this.branchId,
    required this.name,
    required this.startYear,
    required this.endYear,
    required this.isActive,
  });

  factory Batch.fromJson(Map<String, dynamic> json) {
    return Batch(
      id: json['id'] as int,
      branchId: json['branch_id'] as int,
      name: json['name'] as String? ?? '${json['start_year']}-${json['end_year']}',
      startYear: json['start_year'] as int,
      endYear: json['end_year'] as int,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class Section {
  final int id;
  final int batchId;
  final String name;
  final bool isActive;

  Section({
    required this.id,
    required this.batchId,
    required this.name,
    required this.isActive,
  });

  factory Section.fromJson(Map<String, dynamic> json) {
    return Section(
      id: json['id'] as int,
      batchId: json['batch_id'] as int,
      name: json['name'] as String,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class StudentGroup {
  final int id;
  final int sectionId;
  final String name;
  final bool isActive;

  StudentGroup({
    required this.id,
    required this.sectionId,
    required this.name,
    required this.isActive,
  });

  factory StudentGroup.fromJson(Map<String, dynamic> json) {
    return StudentGroup(
      id: json['id'] as int,
      sectionId: json['section_id'] as int,
      name: json['name'] as String,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class AcademicEnrollment {
  final int id;
  final int studentId;
  final int courseId;
  final int branchId;
  final int batchId;
  final int sectionId;
  final int? studentGroupId;
  final int semester;
  final String academicYear;
  final String? studentName;
  final String? studentRollNumber;
  final String? courseName;
  final String? branchName;
  final String? sectionName;
  final String? studentGroupName;
  final String status;
  final bool isCurrent;

  AcademicEnrollment({
    required this.id,
    required this.studentId,
    required this.courseId,
    required this.branchId,
    required this.batchId,
    required this.sectionId,
    this.studentGroupId,
    required this.semester,
    required this.academicYear,
    this.studentName,
    this.studentRollNumber,
    this.courseName,
    this.branchName,
    this.sectionName,
    this.studentGroupName,
    required this.status,
    required this.isCurrent,
  });

  factory AcademicEnrollment.fromJson(Map<String, dynamic> json) {
    return AcademicEnrollment(
      id: json['id'] as int,
      studentId: json['student_id'] as int,
      courseId: json['course_id'] as int,
      branchId: json['branch_id'] as int,
      batchId: json['batch_id'] as int,
      sectionId: json['section_id'] as int,
      studentGroupId: json['student_group_id'] as int?,
      semester: json['semester'] as int,
      academicYear: json['academic_year'] as String,
      studentName: json['student_name'] as String?,
      studentRollNumber: json['student_roll_number'] as String?,
      courseName: json['course_name'] as String?,
      branchName: json['branch_name'] as String?,
      sectionName: json['section_name'] as String?,
      studentGroupName: json['student_group_name'] as String?,
      status: json['status'] as String? ?? 'active',
      isCurrent: json['is_current'] as bool? ?? true,
    );
  }
}
