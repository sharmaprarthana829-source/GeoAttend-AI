import 'package:flutter_test/flutter_test.dart';
import 'package:geoattend_mobile/models/anomaly_models.dart';
import 'package:geoattend_mobile/models/application_models.dart';
import 'package:geoattend_mobile/models/attendance_models.dart';
import 'package:geoattend_mobile/models/auth_models.dart';
import 'package:geoattend_mobile/models/timetable_models.dart';

void main() {
  group('Auth Models Tests', () {
    test('User correctly identifies student and faculty roles', () {
      final studentUser = User(
        id: 1,
        email: 'student@geoattend.ai',
        fullName: 'Arjun Mehta',
        role: UserRole.student,
        isActive: true,
      );
      expect(studentUser.isStudent, isTrue);
      expect(studentUser.isFaculty, isFalse);
      expect(studentUser.isAdmin, isFalse);
      expect(studentUser.isHod, isFalse);

      final facultyUser = User(
        id: 2,
        email: 'priya@geoattend.ai',
        fullName: 'Dr. Priya Sharma',
        role: UserRole.faculty,
        isActive: true,
        facultyProfile: FacultyProfile(
          id: 1,
          userId: 2,
          employeeId: 'EMP001',
          responsibilities: [
            FacultyResponsibility(
              id: 10,
              facultyId: 1,
              responsibilityType: ResponsibilityType.hod,
              scopeType: 'department',
              isActive: true,
            ),
          ],
        ),
      );
      expect(facultyUser.isFaculty, isTrue);
      expect(facultyUser.isHod, isTrue);
      expect(facultyUser.isStudent, isFalse);
    });

    test('LoginResponse JSON parsing with backend TokenResponse format', () {
      final json = {
        'access_token': 'test_jwt_token',
        'refresh_token': 'test_refresh_token',
        'token_type': 'bearer',
        'role': 'student',
        'responsibilities': ['hod'],
      };

      final res = LoginResponse.fromJson(json);
      expect(res.accessToken, equals('test_jwt_token'));
      expect(res.refreshToken, equals('test_refresh_token'));
      expect(res.role, equals(UserRole.student));
      expect(res.responsibilities, contains('hod'));
      expect(res.user, isNull);
    });

    test('LoginResponse JSON parsing with nested user', () {
      final json = {
        'access_token': 'test_jwt_token',
        'refresh_token': 'test_refresh_token',
        'token_type': 'bearer',
        'role': 'admin',
        'user': {
          'id': 1,
          'email': 'admin@geoattend.ai',
          'full_name': 'Super Admin',
          'role': 'admin',
          'is_active': true,
        },
      };

      final res = LoginResponse.fromJson(json);
      expect(res.accessToken, equals('test_jwt_token'));
      expect(res.role, equals(UserRole.admin));
      expect(res.user?.role, equals(UserRole.admin));
      expect(res.user?.isAdmin, isTrue);
    });
  });

  group('Attendance Models Tests', () {
    test('AttendanceSession correctly parses session status and class type', () {
      final json = {
        'id': 42,
        'timetable_entry_id': 10,
        'subject_offering_id': 5,
        'faculty_assignment_id': 2,
        'section_id': 1,
        'session_date': '2026-09-02',
        'start_time': '09:00:00',
        'status': 'active',
        'subject_name': 'Data Structures',
        'class_type': 'theory',
        'total_enrolled': 60,
        'total_present': 45,
      };

      final session = AttendanceSession.fromJson(json);
      expect(session.id, equals(42));
      expect(session.isActive, isTrue);
      expect(session.subjectName, equals('Data Structures'));
      expect(session.classType, equals(ClassType.theory));
      expect(session.totalPresent, equals(45));
    });

    test('CheckInRequest JSON payload builder', () {
      final req = CheckInRequest(
        sessionId: 42,
        latitude: 28.6139,
        longitude: 77.2090,
        accuracyMeters: 5.2,
        deviceId: 'device_123',
        deviceModel: 'iPhone 15 Pro',
        wifiBssid: '00:11:22:33:44:55',
      );

      final map = req.toJson();
      expect(map['session_id'], equals(42));
      expect(map['latitude'], equals(28.6139));
      expect(map['longitude'], equals(77.2090));
      expect(map['accuracy_meters'], equals(5.2));
      expect(map['device_id'], equals('device_123'));
      expect(map['wifi_bssid'], equals('00:11:22:33:44:55'));
    });

    test('StudentSummaryItem calculates percentage and eligibility', () {
      final json = {
        'subject_id': 1,
        'subject_name': 'Operating Systems',
        'subject_code': 'CS301',
        'class_type': 'theory',
        'total_classes': 40,
        'attended_classes': 32,
      };

      final item = StudentSummaryItem.fromJson(json);
      expect(item.percentage, equals(80.0));
      expect(item.isEligible, isTrue);
    });
  });

  group('Anomaly and Application Models Tests', () {
    test('SuspiciousActivity parses risk score and detection method', () {
      final json = {
        'id': 1,
        'attendance_record_id': 100,
        'student_id': 5,
        'session_id': 42,
        'risk_score': 0.85,
        'detection_method': 'gps',
        'reason': 'Check-in was 250m outside room boundary',
        'review_status': 'pending',
      };

      final anomaly = SuspiciousActivity.fromJson(json);
      expect(anomaly.isPending, isTrue);
      expect(anomaly.riskScore, equals(0.85));
      expect(anomaly.detectionMethod, equals(DetectionMethod.gps));
    });

    test('AttendanceApplication parses multi-stage workflow status', () {
      final json = {
        'id': 7,
        'student_id': 5,
        'subject_offering_id': 2,
        'reason': 'Medical Emergency',
        'description': 'Hospitalized with dengue fever',
        'status': 'pending_hod',
        'submitted_at': '2026-09-01T10:00:00Z',
        'faculty_decision': 'approved',
        'faculty_remarks': 'Verified medical cert',
      };

      final app = AttendanceApplication.fromJson(json);
      expect(app.status, equals(ApplicationStatus.pendingHod));
      expect(app.facultyDecision, equals(ReviewDecision.approved));
      expect(app.facultyRemarks, equals('Verified medical cert'));
      expect(app.status.displayName, equals('Pending HOD Decision'));
    });
  });
}
