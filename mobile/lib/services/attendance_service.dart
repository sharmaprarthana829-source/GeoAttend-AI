import 'package:flutter/foundation.dart';
import '../core/api/api_client.dart';
import '../core/api/endpoints.dart';
import '../core/sensors/device_service.dart';
import '../core/sensors/location_service.dart';
import '../core/sensors/network_service.dart';
import '../models/attendance_models.dart';

class AttendanceService extends ChangeNotifier {
  final ApiClient _apiClient;

  AttendanceService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Student: Fetches active sessions ready for check-in.
  Future<List<AttendanceSession>> getStudentActiveSessions() async {
    final data = await _apiClient.get(Endpoints.studentActiveSessions);
    if (data is List) {
      return data.map((json) => AttendanceSession.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Student: Checks into an attendance session with real native sensor signals.
  Future<CheckInResponse> checkIn({
    required int sessionId,
    String? qrToken,
  }) async {
    // 1. Collect real location
    final location = await LocationService.getCurrentLocation();

    // 2. Collect real device info
    final device = await DeviceService.getDeviceInfo();

    // 3. Collect real Wi-Fi info where permitted
    final network = await NetworkService.getWifiInfo();

    final request = CheckInRequest(
      sessionId: sessionId,
      qrToken: qrToken,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyMeters: location.accuracy,
      deviceId: device.deviceId,
      deviceModel: device.model,
      wifiBssid: network.wifiBSSID,
      wifiSsid: network.wifiSSID,
    );

    final data = await _apiClient.post(
      Endpoints.checkIn,
      body: request.toJson(),
    );

    notifyListeners();
    return CheckInResponse.fromJson(data as Map<String, dynamic>);
  }

  /// Student: Fetches personal check-in history.
  Future<List<AttendanceRecord>> getStudentHistory({int limit = 100}) async {
    final data = await _apiClient.get('${Endpoints.studentHistory}?limit=$limit');
    if (data is List) {
      return data.map((json) => AttendanceRecord.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Student: Fetches personal subject-wise attendance summary.
  Future<List<StudentSummaryItem>> getStudentSummary() async {
    final data = await _apiClient.get(Endpoints.studentSummary);
    if (data is List) {
      return data.map((json) => StudentSummaryItem.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Faculty: Starts a scheduled attendance session from a timetable entry.
  Future<AttendanceSession> startSession({required int timetableEntryId, String? sessionDate}) async {
    final body = {
      'timetable_entry_id': timetableEntryId,
      if (sessionDate != null) 'session_date': sessionDate,
    };
    final data = await _apiClient.post(Endpoints.startSession, body: body);
    notifyListeners();
    return AttendanceSession.fromJson(data as Map<String, dynamic>);
  }

  /// Faculty: Closes an active attendance session.
  Future<AttendanceSession> closeSession(int sessionId) async {
    final data = await _apiClient.post(Endpoints.closeSession(sessionId));
    notifyListeners();
    return AttendanceSession.fromJson(data as Map<String, dynamic>);
  }

  /// Faculty / Admin: Fetches live attendance records for a session.
  Future<List<AttendanceRecord>> getSessionRecords(int sessionId) async {
    final data = await _apiClient.get(Endpoints.sessionRecords(sessionId));
    if (data is List) {
      return data.map((json) => AttendanceRecord.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Faculty: Fetches dynamic QR code token.
  Future<Map<String, dynamic>> getSessionQr(int sessionId) async {
    final data = await _apiClient.post(Endpoints.sessionQr(sessionId));
    return data as Map<String, dynamic>;
  }

  /// Faculty: Fetches past and active sessions.
  Future<List<AttendanceSession>> getFacultySessions() async {
    final data = await _apiClient.get(Endpoints.facultySessions);
    if (data is List) {
      return data.map((json) => AttendanceSession.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Admin: Fetches campus sessions with filters.
  Future<List<AttendanceSession>> getAdminSessions({
    int? departmentId,
    String? status,
    String? date,
  }) async {
    var url = Endpoints.adminSessions;
    final params = <String>[];
    if (departmentId != null) params.add('department_id=$departmentId');
    if (status != null) params.add('status=$status');
    if (date != null) params.add('date=$date');
    if (params.isNotEmpty) url += '?${params.join('&')}';

    final data = await _apiClient.get(url);
    if (data is List) {
      return data.map((json) => AttendanceSession.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Admin: Fetches dashboard statistics.
  Future<DashboardStats> getDashboardStats() async {
    final data = await _apiClient.get(Endpoints.dashboardStats);
    return DashboardStats.fromJson(data as Map<String, dynamic>);
  }
}
