import 'package:flutter/foundation.dart';
import '../core/api/api_client.dart';
import '../core/api/endpoints.dart';
import '../models/notice_models.dart';

class NoticeService extends ChangeNotifier {
  final ApiClient _apiClient;
  int _unreadCount = 0;

  NoticeService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  int get unreadCount => _unreadCount;

  /// Fetches targeted notices for authenticated user.
  Future<List<Notice>> getMyNotices() async {
    final data = await _apiClient.get(Endpoints.myNotices);
    if (data is List) {
      return data.map((json) => Notice.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Admin: Fetches all notices campus-wide.
  Future<List<Notice>> getNotices() async {
    final data = await _apiClient.get(Endpoints.notices);
    if (data is List) {
      return data.map((json) => Notice.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Fetches user notifications feed.
  Future<List<Notification>> getMyNotifications({bool? isRead}) async {
    var url = Endpoints.myNotifications;
    if (isRead != null) {
      url += '?is_read=$isRead';
    }
    final data = await _apiClient.get(url);
    if (data is List) {
      final notifications = data.map((json) => Notification.fromJson(json as Map<String, dynamic>)).toList();
      _unreadCount = notifications.where((n) => !n.isRead).length;
      notifyListeners();
      return notifications;
    }
    return [];
  }

  /// Marks a specific notification as read.
  Future<void> markNotificationRead(int notificationId) async {
    await _apiClient.patch(Endpoints.markNotificationRead(notificationId));
    if (_unreadCount > 0) _unreadCount--;
    notifyListeners();
  }

  /// Marks all notifications as read.
  Future<void> markAllNotificationsRead() async {
    await _apiClient.post(Endpoints.markAllNotificationsRead);
    _unreadCount = 0;
    notifyListeners();
  }
}
