enum AudienceType {
  all,
  students,
  faculty,
  department,
  branch,
  group;

  static AudienceType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'all':
        return AudienceType.all;
      case 'students':
        return AudienceType.students;
      case 'faculty':
        return AudienceType.faculty;
      case 'department':
        return AudienceType.department;
      case 'branch':
        return AudienceType.branch;
      case 'group':
        return AudienceType.group;
      default:
        return AudienceType.all;
    }
  }

  String toJson() => name;
}

class Notice {
  final int id;
  final String title;
  final String content;
  final AudienceType audienceType;
  final int? departmentId;
  final int? branchId;
  final int? studentGroupId;
  final String? departmentName;
  final String? branchName;
  final String? studentGroupName;
  final bool isActive;
  final String publishedAt;

  Notice({
    required this.id,
    required this.title,
    required this.content,
    required this.audienceType,
    this.departmentId,
    this.branchId,
    this.studentGroupId,
    this.departmentName,
    this.branchName,
    this.studentGroupName,
    required this.isActive,
    required this.publishedAt,
  });

  factory Notice.fromJson(Map<String, dynamic> json) {
    return Notice(
      id: json['id'] as int,
      title: json['title'] as String? ?? '',
      content: json['content'] as String? ?? '',
      audienceType: AudienceType.fromString(json['audience_type'] as String? ?? 'all'),
      departmentId: json['department_id'] as int?,
      branchId: json['branch_id'] as int?,
      studentGroupId: json['student_group_id'] as int?,
      departmentName: json['department_name'] as String?,
      branchName: json['branch_name'] as String?,
      studentGroupName: json['student_group_name'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      publishedAt: json['published_at'] as String? ?? '',
    );
  }
}

class Notification {
  final int id;
  final int userId;
  final String title;
  final String message;
  final String notificationType;
  final int? relatedEntityId;
  final bool isRead;
  final String createdAt;

  Notification({
    required this.id,
    required this.userId,
    required this.title,
    required this.message,
    required this.notificationType,
    this.relatedEntityId,
    required this.isRead,
    required this.createdAt,
  });

  factory Notification.fromJson(Map<String, dynamic> json) {
    return Notification(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      notificationType: json['notification_type'] as String? ?? 'general',
      relatedEntityId: json['related_entity_id'] as int?,
      isRead: json['is_read'] as bool? ?? false,
      createdAt: json['created_at'] as String? ?? '',
    );
  }
}
