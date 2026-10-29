import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:geoattend_mobile/core/api/api_client.dart';
import 'package:geoattend_mobile/core/errors/app_exception.dart';
import 'package:geoattend_mobile/services/anomaly_service.dart';
import 'package:geoattend_mobile/services/application_service.dart';
import 'package:geoattend_mobile/services/attendance_service.dart';
import 'package:geoattend_mobile/services/notice_service.dart';
import 'package:geoattend_mobile/models/application_models.dart';
import 'package:geoattend_mobile/models/anomaly_models.dart';

import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({
      'geoattend_access_token': 'mock_access_token',
      'geoattend_refresh_token': 'mock_refresh_token',
    });
  });

  group('ApiClient and Error Handling Tests', () {
    test('Successful GET returns decoded JSON', () async {
      final mockClient = MockClient((request) async {
        return http.Response(jsonEncode({'status': 'ok', 'count': 42}), 200);
      });

      final client = ApiClient(httpClient: mockClient);
      final res = await client.get('http://test.com/api');
      expect(res['status'], equals('ok'));
      expect(res['count'], equals(42));
    });

    test('401 throws AuthException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(jsonEncode({'detail': 'Invalid credentials'}), 401);
      });

      final client = ApiClient(httpClient: mockClient);
      expect(
        () => client.get('http://test.com/protected', requiresAuth: false),
        throwsA(isA<AuthException>()),
      );
    });

    test('403 throws ForbiddenException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(jsonEncode({'detail': 'Access forbidden'}), 403);
      });

      final client = ApiClient(httpClient: mockClient);
      expect(
        () => client.get('http://test.com/admin', requiresAuth: false),
        throwsA(isA<ForbiddenException>()),
      );
    });

    test('400 throws ApiException with details', () async {
      final mockClient = MockClient((request) async {
        return http.Response(jsonEncode({'detail': 'Validation error'}), 400);
      });

      final client = ApiClient(httpClient: mockClient);
      expect(
        () => client.post('http://test.com/item', body: {}, requiresAuth: false),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('Service Layers Tests', () {
    test('AttendanceService getStudentSummary parses items', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode([
            {
              'subject_id': 1,
              'subject_name': 'Data Structures',
              'subject_code': 'CS201',
              'class_type': 'theory',
              'total_classes': 20,
              'attended_classes': 18,
              'percentage': 90.0,
            }
          ]),
          200,
        );
      });

      final service = AttendanceService(apiClient: ApiClient(httpClient: mockClient));
      final summary = await service.getStudentSummary();
      expect(summary.length, equals(1));
      expect(summary.first.subjectName, equals('Data Structures'));
      expect(summary.first.percentage, equals(90.0));
      expect(summary.first.isEligible, isTrue);
    });

    test('ApplicationService submitApplication posts payload', () async {
      final mockClient = MockClient((request) async {
        final body = jsonDecode(request.body);
        expect(body['subject_offering_id'], equals(2));
        expect(body['reason'], equals('Sick Leave'));
        return http.Response(
          jsonEncode({
            'id': 101,
            'student_id': 1,
            'subject_offering_id': 2,
            'reason': 'Sick Leave',
            'description': 'Flu symptoms',
            'status': 'pending_faculty',
            'submitted_at': '2026-09-02T10:00:00Z',
          }),
          201,
        );
      });

      final service = ApplicationService(apiClient: ApiClient(httpClient: mockClient));
      final app = await service.submitApplication(
        subjectOfferingId: 2,
        reason: 'Sick Leave',
        description: 'Flu symptoms',
      );
      expect(app.id, equals(101));
      expect(app.status, equals(ApplicationStatus.pendingFaculty));
    });

    test('AnomalyService reviewFacultyAnomaly submits review status', () async {
      final mockClient = MockClient((request) async {
        final body = jsonDecode(request.body);
        expect(body['status'], equals('confirmed'));
        return http.Response(
          jsonEncode({
            'id': 5,
            'attendance_record_id': 20,
            'student_id': 3,
            'session_id': 10,
            'risk_score': 0.95,
            'detection_method': 'device',
            'reason': 'Cloned device detected',
            'review_status': 'confirmed',
          }),
          200,
        );
      });

      final service = AnomalyService(apiClient: ApiClient(httpClient: mockClient));
      final res = await service.reviewFacultyAnomaly(5, status: ReviewStatus.confirmed);
      expect(res.id, equals(5));
      expect(res.reviewStatus, equals(ReviewStatus.confirmed));
    });

    test('NoticeService getMyNotifications parses notification list', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode([
            {
              'id': 1,
              'user_id': 10,
              'title': 'Exam Schedule Announced',
              'message': 'Mid-semester exams start next week.',
              'notification_type': 'notice',
              'is_read': false,
              'created_at': '2026-09-02 09:00:00',
            }
          ]),
          200,
        );
      });

      final service = NoticeService(apiClient: ApiClient(httpClient: mockClient));
      final notifs = await service.getMyNotifications();
      expect(notifs.length, equals(1));
      expect(notifs.first.title, equals('Exam Schedule Announced'));
      expect(service.unreadCount, equals(1));
    });
  });
}
