import 'package:flutter/foundation.dart';
import '../core/api/api_client.dart';
import '../core/api/endpoints.dart';
import '../models/timetable_models.dart';

class TimetableService extends ChangeNotifier {
  final ApiClient _apiClient;

  TimetableService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Student: Fetches today's timetable classes.
  Future<List<TimetableEntry>> getStudentToday() async {
    final data = await _apiClient.get(Endpoints.studentTimetableToday);
    if (data is List) {
      return data.map((json) => TimetableEntry.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Faculty: Fetches today's scheduled classes to start attendance.
  Future<List<TimetableEntry>> getFacultyToday() async {
    final data = await _apiClient.get(Endpoints.facultyTimetableToday);
    if (data is List) {
      return data.map((json) => TimetableEntry.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Admin: Fetches campus timetable entries with optional day filter.
  Future<List<TimetableEntry>> getEntries({String? dayOfWeek}) async {
    var url = Endpoints.timetableEntries;
    if (dayOfWeek != null && dayOfWeek.isNotEmpty) {
      url += '?day_of_week=$dayOfWeek';
    }
    final data = await _apiClient.get(url);
    if (data is List) {
      return data.map((json) => TimetableEntry.fromJson(json as Map<String, dynamic>)).toList();
    }
    return [];
  }
}
