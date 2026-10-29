import 'package:flutter/foundation.dart';
import '../core/api/api_client.dart';
import '../core/api/endpoints.dart';
import '../models/application_models.dart';

class ApplicationService extends ChangeNotifier {
  final ApiClient _apiClient;

  ApplicationService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Student: Submits an attendance debarment / condonation application.
  Future<AttendanceApplication> submitApplication({
    required int subjectOfferingId,
    required String reason,
    required String description,
    String? supportingDocumentUrl,
  }) async {
    final body = {
      'subject_offering_id': subjectOfferingId,
      'reason': reason,
      'description': description,
      if (supportingDocumentUrl != null && supportingDocumentUrl.isNotEmpty)
        'supporting_document_url': supportingDocumentUrl,
    };
    final data = await _apiClient.post(Endpoints.submitApplication, body: body);
    notifyListeners();
    return AttendanceApplication.fromJson(data as Map<String, dynamic>);
  }

  /// Student: Fetches personal applications.
  Future<List<AttendanceApplication>> getMyApplications() async {
    final data = await _apiClient.get(Endpoints.myApplications);
    if (data is List) {
      return data.map((json) => AttendanceApplication.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Faculty: Fetches applications submitted for assigned offerings.
  Future<List<AttendanceApplication>> getFacultyApplications() async {
    final data = await _apiClient.get(Endpoints.facultyApplications);
    if (data is List) {
      return data.map((json) => AttendanceApplication.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Faculty with HOD Responsibility: Fetches pending departmental applications.
  Future<List<AttendanceApplication>> getHodApplications() async {
    final data = await _apiClient.get(Endpoints.hodApplications);
    if (data is List) {
      return data.map((json) => AttendanceApplication.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Admin: Fetches all submitted applications campus-wide.
  Future<List<AttendanceApplication>> getAdminApplications() async {
    final data = await _apiClient.get(Endpoints.adminApplications);
    if (data is List) {
      return data.map((json) => AttendanceApplication.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Faculty: Reviews a student's application (approved/rejected).
  Future<AttendanceApplication> reviewFacultyApplication(
    int applicationId, {
    required ReviewDecision decision,
    String? remarks,
  }) async {
    final body = {
      'decision': decision.toJson(),
      if (remarks != null && remarks.isNotEmpty) 'remarks': remarks,
    };
    final data = await _apiClient.patch(Endpoints.reviewFacultyApplication(applicationId), body: body);
    notifyListeners();
    return AttendanceApplication.fromJson(data as Map<String, dynamic>);
  }

  /// HOD: Issues final condonation decision (approved/rejected).
  Future<AttendanceApplication> reviewHodApplication(
    int applicationId, {
    required ReviewDecision decision,
    String? remarks,
  }) async {
    final body = {
      'decision': decision.toJson(),
      if (remarks != null && remarks.isNotEmpty) 'remarks': remarks,
    };
    final data = await _apiClient.patch(Endpoints.reviewHodApplication(applicationId), body: body);
    notifyListeners();
    return AttendanceApplication.fromJson(data as Map<String, dynamic>);
  }
}
