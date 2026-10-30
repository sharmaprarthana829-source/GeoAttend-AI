import 'package:flutter/foundation.dart';

class AppConfig {
  // Support compile-time --dart-define=API_BASE_URL=http://localhost:8000/api/v1
  static const String _envBaseUrl = String.fromEnvironment('API_BASE_URL');

  static const String defaultCloudBaseUrl = 'https://geoattend-api-0602.onrender.com/api/v1';
  static const String defaultLanBaseUrl = 'http://192.168.31.68:8000/api/v1';
  static const String defaultLocalhostBaseUrl = 'http://localhost:8000/api/v1';
  static const String androidEmulatorBaseUrl = 'http://10.0.2.2:8000/api/v1';

  static String baseUrl = _envBaseUrl.isNotEmpty
      ? _envBaseUrl
      : defaultCloudBaseUrl;

  static void setBaseUrl(String url) {
    baseUrl = url;
  }

  static const String appName = 'GeoAttend AI';
  static const String appVersion = '1.0.0';
}


