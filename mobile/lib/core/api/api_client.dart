import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../errors/app_exception.dart';
import '../storage/token_storage.dart';
import 'endpoints.dart';

class ApiClient {
  final http.Client _httpClient;

  ApiClient({http.Client? httpClient}) : _httpClient = httpClient ?? http.Client();

  Future<Map<String, String>> _headers({bool requiresAuth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (requiresAuth) {
      final token = await TokenStorage.getAccessToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  Future<dynamic> get(String url, {bool requiresAuth = true}) async {
    return _sendWithRetry(() async {
      final headers = await _headers(requiresAuth: requiresAuth);
      final response = await _httpClient.get(Uri.parse(url), headers: headers);
      return _processResponse(response);
    }, requiresAuth: requiresAuth);
  }

  Future<dynamic> post(String url, {dynamic body, bool requiresAuth = true}) async {
    return _sendWithRetry(() async {
      final headers = await _headers(requiresAuth: requiresAuth);
      final response = await _httpClient.post(
        Uri.parse(url),
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _processResponse(response);
    }, requiresAuth: requiresAuth);
  }

  Future<dynamic> patch(String url, {dynamic body, bool requiresAuth = true}) async {
    return _sendWithRetry(() async {
      final headers = await _headers(requiresAuth: requiresAuth);
      final response = await _httpClient.patch(
        Uri.parse(url),
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _processResponse(response);
    }, requiresAuth: requiresAuth);
  }

  Future<dynamic> delete(String url, {bool requiresAuth = true}) async {
    return _sendWithRetry(() async {
      final headers = await _headers(requiresAuth: requiresAuth);
      final response = await _httpClient.delete(Uri.parse(url), headers: headers);
      return _processResponse(response);
    }, requiresAuth: requiresAuth);
  }

  Future<dynamic> _sendWithRetry(
    Future<dynamic> Function() requestFn, {
    bool requiresAuth = true,
  }) async {
    try {
      return await requestFn();
    } on http.ClientException catch (_) {
      throw NetworkException();
    } on SocketException catch (_) {
      throw NetworkException();
    } on AuthException {
      if (!requiresAuth) rethrow;

      // Attempt token refresh
      final refreshed = await _refreshToken();
      if (refreshed) {
        try {
          return await requestFn();
        } catch (e) {
          rethrow;
        }
      } else {
        await TokenStorage.clear();
        throw AuthException('Session expired. Please log in again.');
      }
    }
  }

  Future<bool> _refreshToken() async {
    final refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      final response = await _httpClient.post(
        Uri.parse(Endpoints.refresh),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh_token': refreshToken}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        await TokenStorage.saveTokens(
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'] ?? refreshToken,
        );
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  dynamic _processResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      try {
        return jsonDecode(response.body);
      } catch (_) {
        return response.body;
      }
    }

    String errorMessage = 'Request failed with status: ${response.statusCode}';
    dynamic errorDetails;

    try {
      final body = jsonDecode(response.body);
      if (body is Map<String, dynamic>) {
        errorMessage = body['detail']?.toString() ?? body['message']?.toString() ?? errorMessage;
        errorDetails = body;
      }
    } catch (_) {
      errorMessage = response.body.isNotEmpty ? response.body : errorMessage;
    }

    switch (response.statusCode) {
      case 401:
        throw AuthException(errorMessage);
      case 403:
        throw ForbiddenException(errorMessage);
      default:
        throw ApiException(errorMessage, statusCode: response.statusCode, details: errorDetails);
    }
  }
}
