import 'package:flutter/foundation.dart';
import '../core/api/api_client.dart';
import '../core/api/endpoints.dart';
import '../core/storage/token_storage.dart';
import '../models/auth_models.dart';

class AuthService extends ChangeNotifier {
  final ApiClient _apiClient;
  User? _currentUser;
  bool _isLoading = true;

  AuthService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  User? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;
  UserRole? get role => _currentUser?.role;

  /// Initializes auth state on startup by reading stored tokens & user profile.
  Future<void> initialize() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await TokenStorage.getAccessToken();
      if (token != null) {
        final userJson = await TokenStorage.getUser();
        if (userJson != null) {
          _currentUser = User.fromJson(userJson);
        } else {
          // Fetch fresh profile from backend
          await refreshProfile();
        }
      }
    } catch (_) {
      await TokenStorage.clear();
      _currentUser = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Login with email and password for Student, Faculty, or Admin.
  Future<User> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      final data = await _apiClient.post(
        Endpoints.login,
        body: {'email': email.trim(), 'password': password},
        requiresAuth: false,
      );

      final loginResponse = LoginResponse.fromJson(data as Map<String, dynamic>);

      await TokenStorage.saveTokens(
        accessToken: loginResponse.accessToken,
        refreshToken: loginResponse.refreshToken,
      );

      if (loginResponse.user != null) {
        _currentUser = loginResponse.user;
      } else {
        final profileData = await _apiClient.get(Endpoints.me);
        if (profileData is Map<String, dynamic>) {
          _currentUser = User.fromJson(profileData);
        } else {
          throw Exception('Failed to fetch user profile after login.');
        }
      }

      await TokenStorage.saveUser(_currentUser!.toJson());
      notifyListeners();
      return _currentUser!;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refreshes current user's profile from `/auth/me`.
  Future<User?> refreshProfile() async {
    try {
      final data = await _apiClient.get(Endpoints.me);
      if (data is Map<String, dynamic>) {
        _currentUser = User.fromJson(data);
        await TokenStorage.saveUser(_currentUser!.toJson());
        notifyListeners();
        return _currentUser;
      }
    } catch (_) {
      // Ignore if offline
    }
    return _currentUser;
  }

  /// Logs out the user and clears all stored tokens.
  Future<void> logout() async {
    await TokenStorage.clear();
    _currentUser = null;
    notifyListeners();
  }
}
