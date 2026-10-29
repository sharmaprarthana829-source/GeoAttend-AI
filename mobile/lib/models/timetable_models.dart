enum DayOfWeek {
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday;

  static DayOfWeek fromString(String value) {
    switch (value.toLowerCase()) {
      case 'monday':
        return DayOfWeek.monday;
      case 'tuesday':
        return DayOfWeek.tuesday;
      case 'wednesday':
        return DayOfWeek.wednesday;
      case 'thursday':
        return DayOfWeek.thursday;
      case 'friday':
        return DayOfWeek.friday;
      case 'saturday':
        return DayOfWeek.saturday;
      case 'sunday':
        return DayOfWeek.sunday;
      default:
        return DayOfWeek.monday;
    }
  }

  String toJson() => name;
}

enum ClassType {
  theory,
  lab;

  static ClassType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'theory':
        return ClassType.theory;
      case 'lab':
        return ClassType.lab;
      default:
        return ClassType.theory;
    }
  }

  String toJson() => name;
}

class TimetableEntry {
  final int id;
  final int subjectOfferingId;
  final int facultyAssignmentId;
  final int sectionId;
  final int? studentGroupId;
  final ClassType classType;
  final DayOfWeek dayOfWeek;
  final String startTime;
  final String endTime;
  final String roomNumber;
  final String? subjectName;
  final String? subjectCode;
  final String? facultyName;
  final String? facultyEmployeeId;
  final String? sectionName;
  final String? studentGroupName;
  final bool isActive;

  TimetableEntry({
    required this.id,
    required this.subjectOfferingId,
    required this.facultyAssignmentId,
    required this.sectionId,
    this.studentGroupId,
    required this.classType,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    required this.roomNumber,
    this.subjectName,
    this.subjectCode,
    this.facultyName,
    this.facultyEmployeeId,
    this.sectionName,
    this.studentGroupName,
    required this.isActive,
  });

  factory TimetableEntry.fromJson(Map<String, dynamic> json) {
    return TimetableEntry(
      id: (json['id'] as num).toInt(),
      subjectOfferingId: (json['subject_offering_id'] as num?)?.toInt() ?? 0,
      facultyAssignmentId: (json['faculty_assignment_id'] as num?)?.toInt() ?? 0,
      sectionId: (json['section_id'] as num?)?.toInt() ?? 0,
      studentGroupId: (json['student_group_id'] as num?)?.toInt(),
      classType: ClassType.fromString(json['class_type'] as String? ?? 'theory'),
      dayOfWeek: DayOfWeek.fromString(json['day_of_week'] as String? ?? 'monday'),
      startTime: json['start_time'] as String? ?? '',
      endTime: json['end_time'] as String? ?? '',
      roomNumber: json['room_number'] as String? ?? '',
      subjectName: json['subject_name'] as String?,
      subjectCode: json['subject_code'] as String?,
      facultyName: json['faculty_name'] as String?,
      facultyEmployeeId: json['faculty_employee_id'] as String?,
      sectionName: json['section_name'] as String?,
      studentGroupName: json['student_group_name'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}
