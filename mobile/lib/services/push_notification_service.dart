import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/api/api_client.dart';
import '../core/api/endpoints.dart';

enum PushNotificationType {
  urgentNotice,
  applicationStatus,
  attendanceShortfall,
  general,
}

class PushMessage {
  final String title;
  final String body;
  final PushNotificationType type;
  final String? route;
  final String? referenceId;
  final Map<String, dynamic> data;

  const PushMessage({
    required this.title,
    required this.body,
    required this.type,
    this.route,
    this.referenceId,
    this.data = const {},
  });

  factory PushMessage.fromMap(Map<String, dynamic> map) {
    final dataMap = map['data'] is Map<String, dynamic>
        ? map['data'] as Map<String, dynamic>
        : <String, dynamic>{};

    final rawType = (dataMap['type'] ?? map['type'] ?? 'general').toString().toLowerCase();
    PushNotificationType parsedType;
    if (rawType.contains('urgent') || rawType.contains('notice')) {
      parsedType = PushNotificationType.urgentNotice;
    } else if (rawType.contains('application')) {
      parsedType = PushNotificationType.applicationStatus;
    } else if (rawType.contains('shortfall') || rawType.contains('attendance')) {
      parsedType = PushNotificationType.attendanceShortfall;
    } else {
      parsedType = PushNotificationType.general;
    }

    return PushMessage(
      title: (map['title'] ?? dataMap['title'] ?? 'Notification').toString(),
      body: (map['body'] ?? dataMap['body'] ?? '').toString(),
      type: parsedType,
      route: (dataMap['route'] ?? map['route'])?.toString(),
      referenceId: (dataMap['reference_id'] ?? map['reference_id'])?.toString(),
      data: dataMap,
    );
  }
}

class PushNotificationService extends ChangeNotifier {
  static const String _prefKeyDeviceToken = 'cached_device_push_token';
  final ApiClient _apiClient;

  String? _currentToken;
  bool _isRegistered = false;
  PushMessage? _latestMessage;

  PushNotificationService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  String? get currentToken => _currentToken;
  bool get isRegistered => _isRegistered;
  PushMessage? get latestMessage => _latestMessage;

  /// Returns the current runtime platform string ('android', 'ios', or 'web').
  static String get currentPlatform {
    if (kIsWeb) return 'web';
    try {
      if (Platform.isAndroid) return 'android';
      if (Platform.isIOS) return 'ios';
    } catch (_) {
      // Platform can throw on web if accessed incorrectly
    }
    return 'unknown';
  }

  /// Initializes cached token state.
  Future<void> initialize() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _currentToken = prefs.getString(_prefKeyDeviceToken);
    } catch (_) {
      // Ignore in mock/test environments
    }
  }

  /// Registers a push notification device token with the backend.
  Future<bool> registerDeviceToken({
    required String token,
    String? platform,
    String? deviceModel,
  }) async {
    final effectivePlatform = platform ?? currentPlatform;

    try {
      final response = await _apiClient.post(
        Endpoints.pushToken,
        body: {
          'token': token.trim(),
          'platform': effectivePlatform,
          if (deviceModel != null) 'device_model': deviceModel,
        },
      );

      if (response != null) {
        _currentToken = token.trim();
        _isRegistered = true;

        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_prefKeyDeviceToken, _currentToken!);
        } catch (_) {}

        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('[PushNotificationService] Failed to register token: $e');
    }
    return false;
  }

  /// Unregisters the current device token from the backend (used on logout).
  Future<bool> unregisterCurrentToken() async {
    if (_currentToken == null || _currentToken!.isEmpty) {
      return true;
    }

    try {
      await _apiClient.delete(
        '${Endpoints.pushToken}?token=${Uri.encodeComponent(_currentToken!)}',
      );

      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_prefKeyDeviceToken);
      } catch (_) {}

      _currentToken = null;
      _isRegistered = false;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[PushNotificationService] Failed to unregister token: $e');
      return false;
    }
  }

  /// Handles incoming push notification message payload (foreground or background tap).
  void handleIncomingMessage(Map<String, dynamic> payload) {
    try {
      final message = PushMessage.fromMap(payload);
      _latestMessage = message;
      notifyListeners();
    } catch (e) {
      debugPrint('[PushNotificationService] Error parsing incoming message: $e');
    }
  }

  /// Triggers a test push notification via backend test endpoint.
  Future<Map<String, dynamic>?> sendTestPush({
    required String title,
    required String body,
    Map<String, dynamic>? data,
  }) async {
    try {
      final result = await _apiClient.post(
        Endpoints.testPush,
        body: {
          'title': title,
          'body': body,
          'data': data ?? {},
        },
      );
      return result as Map<String, dynamic>?;
    } catch (e) {
      debugPrint('[PushNotificationService] Failed to trigger test push: $e');
      return null;
    }
  }
}
