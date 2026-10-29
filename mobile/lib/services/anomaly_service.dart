import 'package:flutter/foundation.dart';
import '../core/api/api_client.dart';
import '../core/api/endpoints.dart';
import '../models/anomaly_models.dart';

class AnomalyService extends ChangeNotifier {
  final ApiClient _apiClient;

  AnomalyService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Faculty: Fetches suspicious activity records from assigned sessions.
  Future<List<SuspiciousActivity>> getFacultyAnomalies({String? reviewStatus}) async {
    var url = Endpoints.facultyAnomalies;
    if (reviewStatus != null && reviewStatus.isNotEmpty) {
      url += '?review_status=$reviewStatus';
    }
    final data = await _apiClient.get(url);
    if (data is List) {
      return data.map((json) => SuspiciousActivity.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Admin: Fetches campus-wide suspicious activities with optional filters.
  Future<List<SuspiciousActivity>> getAdminAnomalies({
    String? reviewStatus,
    String? detectionMethod,
    int? studentId,
  }) async {
    var url = Endpoints.adminAnomalies;
    final params = <String>[];
    if (reviewStatus != null && reviewStatus.isNotEmpty) params.add('review_status=$reviewStatus');
    if (detectionMethod != null && detectionMethod.isNotEmpty) params.add('detection_method=$detectionMethod');
    if (studentId != null) params.add('student_id=$studentId');
    if (params.isNotEmpty) url += '?${params.join('&')}';

    final data = await _apiClient.get(url);
    if (data is List) {
      return data.map((json) => SuspiciousActivity.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Faculty: Reviews a suspicious check-in flag (confirmed/dismissed).
  Future<SuspiciousActivity> reviewFacultyAnomaly(
    int anomalyId, {
    required ReviewStatus status,
    String? reviewerNotes,
  }) async {
    final body = {
      'status': status.toJson(),
      if (reviewerNotes != null && reviewerNotes.isNotEmpty) 'reviewer_notes': reviewerNotes,
    };
    final data = await _apiClient.patch(Endpoints.reviewFacultyAnomaly(anomalyId), body: body);
    notifyListeners();
    return SuspiciousActivity.fromJson(data as Map<String, dynamic>);
  }

  /// Admin: Reviews a suspicious check-in flag.
  Future<SuspiciousActivity> reviewAdminAnomaly(
    int anomalyId, {
    required ReviewStatus status,
    String? reviewerNotes,
  }) async {
    final body = {
      'status': status.toJson(),
      if (reviewerNotes != null && reviewerNotes.isNotEmpty) 'reviewer_notes': reviewerNotes,
    };
    final data = await _apiClient.patch(Endpoints.reviewAdminAnomaly(anomalyId), body: body);
    notifyListeners();
    return SuspiciousActivity.fromJson(data as Map<String, dynamic>);
  }
}
