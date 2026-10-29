import 'timetable_models.dart';

enum AttendanceStatus {
  present,
  absent,
  late,
  suspicious;

  static AttendanceStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'present':
        return AttendanceStatus.present;
      case 'absent':
        return AttendanceStatus.absent;
      case 'late':
        return AttendanceStatus.late;
      case 'suspicious':
        return AttendanceStatus.suspicious;
      default:
        return AttendanceStatus.present;
    }
  }

  String toJson() => name;
}

enum SessionStatus {
  scheduled,
  active,
  completed,
  closed,
  cancelled;

  static SessionStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'scheduled':
        return SessionStatus.scheduled;
      case 'active':
        return SessionStatus.active;
      case 'completed':
        return SessionStatus.completed;
      case 'closed':
        return SessionStatus.closed;
      case 'cancelled':
        return SessionStatus.cancelled;
      default:
        return SessionStatus.scheduled;
    }
  }

  String toJson() => name;
}

class AttendanceSession {
  final int id;
  final int timetableEntryId;
  final int subjectOfferingId;
  final int facultyAssignmentId;
  final int sectionId;
  final int? studentGroupId;
  final String sessionDate;
  final String startTime;
  final String? endTime;
  final SessionStatus status;
  final String? qrToken;
  final String? qrExpiresAt;
  final String? subjectName;
  final String? subjectCode;
  final String? facultyName;
  final String? sectionName;
  final String? studentGroupName;
  final String? roomNumber;
  final ClassType? classType;
  final int totalEnrolled;
  final int totalPresent;

  AttendanceSession({
    required this.id,
    required this.timetableEntryId,
    required this.subjectOfferingId,
    required this.facultyAssignmentId,
    required this.sectionId,
    this.studentGroupId,
    required this.sessionDate,
    required this.startTime,
    this.endTime,
    required this.status,
    this.qrToken,
    this.qrExpiresAt,
    this.subjectName,
    this.subjectCode,
    this.facultyName,
    this.sectionName,
    this.studentGroupName,
    this.roomNumber,
    this.classType,
    this.totalEnrolled = 0,
    this.totalPresent = 0,
  });

  bool get isActive => status == SessionStatus.active;

  factory AttendanceSession.fromJson(Map<String, dynamic> json) {
    return AttendanceSession(
      id: (json['id'] as num).toInt(),
      timetableEntryId: (json['timetable_entry_id'] as num?)?.toInt() ?? 0,
      subjectOfferingId: (json['subject_offering_id'] as num?)?.toInt() ?? 0,
      facultyAssignmentId: (json['faculty_assignment_id'] as num?)?.toInt() ?? 0,
      sectionId: (json['section_id'] as num?)?.toInt() ?? 0,
      studentGroupId: (json['student_group_id'] as num?)?.toInt(),
      sessionDate: json['session_date'] as String? ?? (json['started_at'] != null ? (json['started_at'] as String).split('T')[0] : ''),
      startTime: json['start_time'] as String? ?? (json['started_at'] as String? ?? ''),
      endTime: json['end_time'] as String? ?? (json['ended_at'] as String?),
      status: SessionStatus.fromString(json['status'] as String? ?? 'scheduled'),
      qrToken: json['qr_token'] as String?,
      qrExpiresAt: json['qr_expires_at'] as String?,
      subjectName: json['subject_name'] as String?,
      subjectCode: json['subject_code'] as String?,
      facultyName: json['faculty_name'] as String?,
      sectionName: json['section_name'] as String?,
      studentGroupName: json['student_group_name'] as String?,
      roomNumber: json['room_number'] as String?,
      classType: json['class_type'] != null ? ClassType.fromString(json['class_type'] as String) : null,
      totalEnrolled: (json['total_enrolled'] as num?)?.toInt() ?? 0,
      totalPresent: (json['total_present'] as num?)?.toInt() ?? 0,
    );
  }
}

class AttendanceRecord {
  final int id;
  final int sessionId;
  final int studentId;
  final AttendanceStatus status;
  final String checkInTime;
  final double? latitude;
  final double? longitude;
  final double? distanceMeters;
  final String? deviceId;
  final bool isSuspicious;
  final String? suspicionReason;
  final String? studentName;
  final String? studentRollNumber;

  AttendanceRecord({
    required this.id,
    required this.sessionId,
    required this.studentId,
    required this.status,
    required this.checkInTime,
    this.latitude,
    this.longitude,
    this.distanceMeters,
    this.deviceId,
    this.isSuspicious = false,
    this.suspicionReason,
    this.studentName,
    this.studentRollNumber,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id'] as int,
      sessionId: json['session_id'] as int,
      studentId: json['student_id'] as int,
      status: AttendanceStatus.fromString(json['status'] as String? ?? 'present'),
      checkInTime: json['check_in_time'] as String? ?? json['marked_at'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      distanceMeters: (json['distance_meters'] as num?)?.toDouble(),
      deviceId: json['device_id'] as String?,
      isSuspicious: json['is_suspicious'] as bool? ?? false,
      suspicionReason: json['suspicion_reason'] as String?,
      studentName: json['student_name'] as String?,
      studentRollNumber: json['student_roll_number'] as String? ?? json['roll_number'] as String?,
    );
  }
}

class CheckInRequest {
  final int sessionId;
  final String? qrToken;
  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final String? deviceId;
  final String? deviceModel;
  final String? wifiBssid;
  final String? wifiSsid;
  final String? blePayload;
  final String? networkType;
  final bool? isVpn;

  CheckInRequest({
    required this.sessionId,
    this.qrToken,
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.deviceId,
    this.deviceModel,
    this.wifiBssid,
    this.wifiSsid,
    this.blePayload,
    this.networkType,
    this.isVpn,
  });

  Map<String, dynamic> toJson() => {
        'session_id': sessionId,
        if (qrToken != null && qrToken!.isNotEmpty) 'qr_token': qrToken,
        'latitude': latitude,
        'longitude': longitude,
        if (accuracyMeters != null) 'accuracy_meters': accuracyMeters,
        if (deviceId != null) 'device_id': deviceId,
        if (deviceModel != null) 'device_model': deviceModel,
        if (wifiBssid != null) 'wifi_bssid': wifiBssid,
        if (wifiSsid != null) 'wifi_ssid': wifiSsid,
        if (blePayload != null) 'ble_payload': blePayload,
        if (networkType != null) 'network_type': networkType,
        if (isVpn != null) 'is_vpn': isVpn,
      };
}

class CheckInResponse {
  final AttendanceRecord record;
  final String message;
  final bool isSuspicious;
  final String? flagReason;

  CheckInResponse({
    required this.record,
    required this.message,
    this.isSuspicious = false,
    this.flagReason,
  });

  factory CheckInResponse.fromJson(Map<String, dynamic> json) {
    return CheckInResponse(
      record: AttendanceRecord.fromJson(json['record'] as Map<String, dynamic>? ?? json),
      message: json['message'] as String? ?? 'Check-in recorded successfully.',
      isSuspicious: json['is_suspicious'] as bool? ?? (json['record']?['is_suspicious'] as bool? ?? false),
      flagReason: json['flag_reason'] as String? ?? json['suspicion_reason'] as String?,
    );
  }
}

class StudentSummaryItem {
  final int subjectId;
  final String subjectName;
  final String subjectCode;
  final String classType;
  final int totalClasses;
  final int attendedClasses;
  final double percentage;
  final bool isEligible;

  StudentSummaryItem({
    required this.subjectId,
    required this.subjectName,
    required this.subjectCode,
    required this.classType,
    required this.totalClasses,
    required this.attendedClasses,
    required this.percentage,
    required this.isEligible,
  });

  factory StudentSummaryItem.fromJson(Map<String, dynamic> json) {
    final total = json['total_sessions'] as int? ?? json['total_classes'] as int? ?? 0;
    final attended = json['attended'] as int? ?? json['attended_classes'] as int? ?? 0;
    final pct = (json['percentage'] as num?)?.toDouble() ?? (total > 0 ? (attended / total) * 100 : 100.0);
    return StudentSummaryItem(
      subjectId: json['subject_id'] as int? ?? 0,
      subjectName: json['subject_name'] as String? ?? 'Subject',
      subjectCode: json['subject_code'] as String? ?? 'CS000',
      classType: json['class_type'] as String? ?? 'theory',
      totalClasses: total,
      attendedClasses: attended,
      percentage: pct,
      isEligible: pct >= 75.0,
    );
  }
}

class DashboardStats {
  final int totalColleges;
  final int totalStudents;
  final int totalFaculty;
  final int activeSessions;
  final int todayAttendanceCount;

  DashboardStats({
    required this.totalColleges,
    required this.totalStudents,
    required this.totalFaculty,
    required this.activeSessions,
    required this.todayAttendanceCount,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      totalColleges: json['total_colleges'] as int? ?? 0,
      totalStudents: json['total_students'] as int? ?? 0,
      totalFaculty: json['total_faculty'] as int? ?? 0,
      activeSessions: json['active_sessions'] as int? ?? 0,
      todayAttendanceCount: json['today_attendance_count'] as int? ?? 0,
    );
  }
}
