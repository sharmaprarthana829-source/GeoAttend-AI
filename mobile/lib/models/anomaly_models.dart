enum DetectionMethod {
  gps,
  device,
  timing,
  multiSignal;

  static DetectionMethod fromString(String value) {
    switch (value.toLowerCase()) {
      case 'gps':
        return DetectionMethod.gps;
      case 'device':
        return DetectionMethod.device;
      case 'timing':
        return DetectionMethod.timing;
      case 'multi_signal':
        return DetectionMethod.multiSignal;
      default:
        return DetectionMethod.gps;
    }
  }

  String toJson() {
    switch (this) {
      case DetectionMethod.gps:
        return 'gps';
      case DetectionMethod.device:
        return 'device';
      case DetectionMethod.timing:
        return 'timing';
      case DetectionMethod.multiSignal:
        return 'multi_signal';
    }
  }
}

enum ReviewStatus {
  pending,
  confirmed,
  dismissed,
  reviewed;

  static ReviewStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'pending':
        return ReviewStatus.pending;
      case 'confirmed':
        return ReviewStatus.confirmed;
      case 'dismissed':
        return ReviewStatus.dismissed;
      case 'reviewed':
        return ReviewStatus.reviewed;
      default:
        return ReviewStatus.pending;
    }
  }

  String toJson() => name;
}

class SuspiciousActivity {
  final int id;
  final int attendanceRecordId;
  final int studentId;
  final int sessionId;
  final double riskScore;
  final DetectionMethod detectionMethod;
  final String reason;
  final Map<String, dynamic>? rawSignals;
  final ReviewStatus reviewStatus;
  final int? reviewedBy;
  final String? reviewedAt;
  final String? reviewerNotes;
  final String? studentName;
  final String? studentRollNumber;

  SuspiciousActivity({
    required this.id,
    required this.attendanceRecordId,
    required this.studentId,
    required this.sessionId,
    required this.riskScore,
    required this.detectionMethod,
    required this.reason,
    this.rawSignals,
    required this.reviewStatus,
    this.reviewedBy,
    this.reviewedAt,
    this.reviewerNotes,
    this.studentName,
    this.studentRollNumber,
  });

  bool get isPending => reviewStatus == ReviewStatus.pending;

  factory SuspiciousActivity.fromJson(Map<String, dynamic> json) {
    return SuspiciousActivity(
      id: json['id'] as int,
      attendanceRecordId: json['attendance_record_id'] as int,
      studentId: json['student_id'] as int,
      sessionId: json['session_id'] as int,
      riskScore: (json['risk_score'] as num?)?.toDouble() ?? 0.0,
      detectionMethod: DetectionMethod.fromString(json['detection_method'] as String? ?? 'gps'),
      reason: json['reason'] as String? ?? '',
      rawSignals: json['raw_signals'] as Map<String, dynamic>?,
      reviewStatus: ReviewStatus.fromString(json['review_status'] as String? ?? 'pending'),
      reviewedBy: json['reviewed_by'] as int?,
      reviewedAt: json['reviewed_at'] as String?,
      reviewerNotes: json['reviewer_notes'] as String?,
      studentName: json['student_name'] as String?,
      studentRollNumber: json['student_roll_number'] as String?,
    );
  }
}
