class AppException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic details;

  AppException(this.message, {this.statusCode, this.details});

  @override
  String toString() => message;
}

class ApiException extends AppException {
  ApiException(super.message, {super.statusCode, super.details});
}

class NetworkException extends AppException {
  NetworkException([super.message = 'Network connection failed. Please check your internet connection.']);
}

class AuthException extends AppException {
  AuthException([super.message = 'Authentication failed or session expired.'])
      : super(statusCode: 401);
}

class ForbiddenException extends AppException {
  ForbiddenException([super.message = 'You do not have permission to perform this action.'])
      : super(statusCode: 403);
}

class SensorException extends AppException {
  final String sensorType;
  final bool isPermissionDenied;

  SensorException(
    super.message, {
    required this.sensorType,
    this.isPermissionDenied = false,
  });
}
