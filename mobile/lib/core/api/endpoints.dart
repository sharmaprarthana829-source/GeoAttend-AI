import '../config/app_config.dart';

class Endpoints {
  static String get baseUrl => AppConfig.baseUrl;

  // Auth
  static String get login => '$baseUrl/auth/login';
  static String get refresh => '$baseUrl/auth/refresh';
  static String get me => '$baseUrl/auth/me';

  // Attendance
  static String get checkIn => '$baseUrl/attendance/check-in';
  static String get startSession => '$baseUrl/attendance/sessions/start';
  static String sessionDetail(int id) => '$baseUrl/attendance/sessions/$id';
  static String sessionRecords(int id) => '$baseUrl/attendance/sessions/$id/records';
  static String sessionQr(int id) => '$baseUrl/attendance/sessions/$id/qr';
  static String closeSession(int id) => '$baseUrl/attendance/sessions/$id/close';
  static String get studentActiveSessions => '$baseUrl/attendance/student/active-sessions';
  static String get studentHistory => '$baseUrl/attendance/student/history';
  static String get studentSummary => '$baseUrl/attendance/student/summary';
  static String get facultySessions => '$baseUrl/attendance/faculty/sessions';
  static String get adminSessions => '$baseUrl/attendance/admin/sessions';
  static String adminSessionRecords(int id) => '$baseUrl/attendance/admin/sessions/$id/records';
  static String get dashboardStats => '$baseUrl/attendance/dashboard/stats';

  // Timetable
  static String get timetableEntries => '$baseUrl/timetable/entries';
  static String get timetableToday => '$baseUrl/timetable/today';
  static String get studentTimetableToday => '$baseUrl/timetable/today/student';
  static String get facultyTimetableToday => '$baseUrl/timetable/today/faculty';

  // Subjects
  static String get masterSubjects => '$baseUrl/subjects/master';
  static String get offerings => '$baseUrl/subjects/offerings';
  static String get myAssignments => '$baseUrl/subjects/assignments/faculty/my';

  // Applications
  static String get myApplications => '$baseUrl/applications/my';
  static String get facultyApplications => '$baseUrl/applications/faculty';
  static String get hodApplications => '$baseUrl/applications/hod';
  static String get adminApplications => '$baseUrl/applications/admin';
  static String get submitApplication => '$baseUrl/applications';
  static String reviewFacultyApplication(int id) => '$baseUrl/applications/$id/faculty-review';
  static String reviewHodApplication(int id) => '$baseUrl/applications/$id/hod-decision';

  // Anomaly
  static String get facultyAnomalies => '$baseUrl/anomaly/faculty';
  static String get adminAnomalies => '$baseUrl/anomaly/admin';
  static String reviewFacultyAnomaly(int id) => '$baseUrl/anomaly/faculty/$id/review';
  static String reviewAdminAnomaly(int id) => '$baseUrl/anomaly/admin/$id/review';

  // Notices & Notifications
  static String get notices => '$baseUrl/notices';
  static String get myNotices => '$baseUrl/notices/my';
  static String get myNotifications => '$baseUrl/notifications/my';
  static String markNotificationRead(int id) => '$baseUrl/notifications/$id/read';
  static String get markAllNotificationsRead => '$baseUrl/notifications/read-all';
  static String get pushToken => '$baseUrl/notifications/push-token';
  static String get testPush => '$baseUrl/notifications/test-push';
}
