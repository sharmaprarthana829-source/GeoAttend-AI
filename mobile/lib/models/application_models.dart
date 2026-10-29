enum ApplicationStatus {
  pendingFaculty,
  facultyApproved,
  facultyRejected,
  pendingHod,
  hodApproved,
  hodRejected;

  static ApplicationStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'pending_faculty':
        return ApplicationStatus.pendingFaculty;
      case 'faculty_approved':
        return ApplicationStatus.facultyApproved;
      case 'faculty_rejected':
        return ApplicationStatus.facultyRejected;
      case 'pending_hod':
        return ApplicationStatus.pendingHod;
      case 'hod_approved':
        return ApplicationStatus.hodApproved;
      case 'hod_rejected':
        return ApplicationStatus.hodRejected;
      default:
        return ApplicationStatus.pendingFaculty;
    }
  }

  String toJson() {
    switch (this) {
      case ApplicationStatus.pendingFaculty:
        return 'pending_faculty';
      case ApplicationStatus.facultyApproved:
        return 'faculty_approved';
      case ApplicationStatus.facultyRejected:
        return 'faculty_rejected';
      case ApplicationStatus.pendingHod:
        return 'pending_hod';
      case ApplicationStatus.hodApproved:
        return 'hod_approved';
      case ApplicationStatus.hodRejected:
        return 'hod_rejected';
    }
  }

  String get displayName {
    switch (this) {
      case ApplicationStatus.pendingFaculty:
        return 'Pending Faculty Review';
      case ApplicationStatus.facultyApproved:
      case ApplicationStatus.pendingHod:
        return 'Pending HOD Decision';
      case ApplicationStatus.facultyRejected:
        return 'Rejected by Faculty';
      case ApplicationStatus.hodApproved:
        return 'Approved / Condoned';
      case ApplicationStatus.hodRejected:
        return 'Rejected by HOD';
    }
  }
}

enum ReviewDecision {
  approved,
  rejected;

  static ReviewDecision fromString(String value) {
    switch (value.toLowerCase()) {
      case 'approved':
        return ReviewDecision.approved;
      case 'rejected':
        return ReviewDecision.rejected;
      default:
        return ReviewDecision.approved;
    }
  }

  String toJson() => name;
}

class AttendanceApplication {
  final int id;
  final int studentId;
  final int subjectOfferingId;
  final String reason;
  final String description;
  final String? supportingDocumentUrl;
  final ApplicationStatus status;
  final String submittedAt;
  final ReviewDecision? facultyDecision;
  final String? facultyRemarks;
  final ReviewDecision? hodDecision;
  final String? hodRemarks;
  final String? studentName;
  final String? studentRollNumber;
  final String? subjectName;
  final String? subjectCode;

  AttendanceApplication({
    required this.id,
    required this.studentId,
    required this.subjectOfferingId,
    required this.reason,
    required this.description,
    this.supportingDocumentUrl,
    required this.status,
    required this.submittedAt,
    this.facultyDecision,
    this.facultyRemarks,
    this.hodDecision,
    this.hodRemarks,
    this.studentName,
    this.studentRollNumber,
    this.subjectName,
    this.subjectCode,
  });

  factory AttendanceApplication.fromJson(Map<String, dynamic> json) {
    return AttendanceApplication(
      id: json['id'] as int,
      studentId: json['student_id'] as int,
      subjectOfferingId: json['subject_offering_id'] as int,
      reason: json['reason'] as String? ?? '',
      description: json['description'] as String? ?? '',
      supportingDocumentUrl: json['supporting_document_url'] as String?,
      status: ApplicationStatus.fromString(json['status'] as String? ?? 'pending_faculty'),
      submittedAt: json['submitted_at'] as String? ?? '',
      facultyDecision: json['faculty_decision'] != null
          ? ReviewDecision.fromString(json['faculty_decision'] as String)
          : null,
      facultyRemarks: json['faculty_remarks'] as String?,
      hodDecision: json['hod_decision'] != null
          ? ReviewDecision.fromString(json['hod_decision'] as String)
          : null,
      hodRemarks: json['hod_remarks'] as String?,
      studentName: json['student_name'] as String?,
      studentRollNumber: json['student_roll_number'] as String?,
      subjectName: json['subject_name'] as String?,
      subjectCode: json['subject_code'] as String?,
    );
  }
}
