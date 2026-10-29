import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geoattend_mobile/core/api/api_client.dart';
import 'package:geoattend_mobile/services/push_notification_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('PushMessage Model Parsing Tests', () {
    test('Parses urgent notice payload properly', () {
      final payload = {
        'title': 'Urgent: Exam Schedule Changed',
        'body': 'Check the updated timetable immediately.',
        'data': {
          'type': 'urgent_notice',
          'route': '/dashboard/notices',
          'reference_id': '42',
        },
      };

      final msg = PushMessage.fromMap(payload);
      expect(msg.title, equals('Urgent: Exam Schedule Changed'));
      expect(msg.body, equals('Check the updated timetable immediately.'));
      expect(msg.type, equals(PushNotificationType.urgentNotice));
      expect(msg.route, equals('/dashboard/notices'));
      expect(msg.referenceId, equals('42'));
    });

    test('Parses application review status update payload properly', () {
      final payload = {
        'title': 'Application Approved',
        'body': 'Your medical leave has been approved by HOD.',
        'data': {
          'type': 'application_status',
          'route': '/dashboard/applications',
          'reference_id': '15',
        },
      };

      final msg = PushMessage.fromMap(payload);
      expect(msg.type, equals(PushNotificationType.applicationStatus));
      expect(msg.route, equals('/dashboard/applications'));
      expect(msg.referenceId, equals('15'));
    });

    test('Parses attendance shortfall warning payload properly', () {
      final payload = {
        'title': 'Low Attendance Warning',
        'body': 'Attendance in CS301 is below 75%.',
        'data': {
          'type': 'attendance_shortfall',
          'route': '/dashboard/attendance',
        },
      };

      final msg = PushMessage.fromMap(payload);
      expect(msg.type, equals(PushNotificationType.attendanceShortfall));
      expect(msg.route, equals('/dashboard/attendance'));
    });
  });

  group('PushNotificationService Client Tests', () {
    test('registerDeviceToken stores token locally and sends to backend', () async {
      String? recordedPath;
      String? recordedBody;

      final mockClient = MockClient((request) async {
        recordedPath = request.url.path;
        recordedBody = request.body;
        return http.Response(
          jsonEncode({
            'id': 1,
            'token': 'mock_fcm_token_xyz',
            'platform': 'android',
            'device_model': 'Pixel 7',
            'is_active': true,
          }),
          201,
        );
      });

      final apiClient = ApiClient(httpClient: mockClient);
      final service = PushNotificationService(apiClient: apiClient);

      final success = await service.registerDeviceToken(
        token: 'mock_fcm_token_xyz',
        platform: 'android',
        deviceModel: 'Pixel 7',
      );

      expect(success, isTrue);
      expect(service.currentToken, equals('mock_fcm_token_xyz'));
      expect(service.isRegistered, isTrue);
      expect(recordedPath, contains('/notifications/push-token'));
      expect(recordedBody, contains('mock_fcm_token_xyz'));

      // Check SharedPreferences persistence
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('cached_device_push_token'), equals('mock_fcm_token_xyz'));
    });

    test('unregisterCurrentToken removes token from backend and local cache', () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_device_push_token', 'token_to_remove');

      String? recordedMethod;
      final mockClient = MockClient((request) async {
        recordedMethod = request.method;
        return http.Response(jsonEncode({'detail': 'Token unregistered successfully'}), 200);
      });

      final apiClient = ApiClient(httpClient: mockClient);
      final service = PushNotificationService(apiClient: apiClient);
      await service.initialize();

      expect(service.currentToken, equals('token_to_remove'));

      final success = await service.unregisterCurrentToken();
      expect(success, isTrue);
      expect(service.currentToken, isNull);
      expect(service.isRegistered, isFalse);
      expect(recordedMethod, equals('DELETE'));
      expect(prefs.getString('cached_device_push_token'), isNull);
    });

    test('handleIncomingMessage updates latestMessage and notifies listeners', () {
      final service = PushNotificationService();
      int notifyCount = 0;
      service.addListener(() => notifyCount++);

      service.handleIncomingMessage({
        'title': 'Test Push',
        'body': 'This is a test notification',
        'data': {'type': 'urgent_notice'},
      });

      expect(notifyCount, equals(1));
      expect(service.latestMessage, isNotNull);
      expect(service.latestMessage!.title, equals('Test Push'));
      expect(service.latestMessage!.type, equals(PushNotificationType.urgentNotice));
    });
  });
}
