import 'package:geolocator/geolocator.dart';
import '../errors/app_exception.dart';

class LocationResult {
  final double latitude;
  final double longitude;
  final double accuracy;
  final double? altitude;
  final bool isMocked;
  final DateTime timestamp;

  LocationResult({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    this.altitude,
    this.isMocked = false,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'accuracy_meters': accuracy,
        'altitude': altitude,
        'is_mocked': isMocked,
        'timestamp': timestamp.toIso8601String(),
      };
}

class LocationService {
  static Future<bool> isLocationServiceEnabled() async {
    return await Geolocator.isLocationServiceEnabled();
  }

  static Future<LocationPermission> checkPermission() async {
    return await Geolocator.checkPermission();
  }

  static Future<LocationPermission> requestPermission() async {
    return await Geolocator.requestPermission();
  }

  /// Obtains the current native GPS position with high accuracy.
  /// Throws SensorException on permission denial or service disabled.
  static Future<LocationResult> getCurrentLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw SensorException(
        'GPS location services are disabled on your device. Please enable Location in device settings.',
        sensorType: 'GPS',
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw SensorException(
          'Location permission was denied. GeoAttend requires GPS permission for attendance verification.',
          sensorType: 'GPS',
          isPermissionDenied: true,
        );
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw SensorException(
        'Location permission is permanently denied. Please grant permission from device App Settings.',
        sensorType: 'GPS',
        isPermissionDenied: true,
      );
    }

    try {
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 8),
        );
      } catch (_) {
        // High accuracy timed out indoors; attempt balanced accuracy (cell/Wi-Fi assisted)
        try {
          position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.medium,
            timeLimit: const Duration(seconds: 5),
          );
        } catch (_) {
          // Fall back to recent cached position if available
          position = await Geolocator.getLastKnownPosition();
        }
      }

      if (position == null) {
        throw SensorException(
          'Indoor GPS attenuation: Unable to lock satellite fix. Please connect to Campus Wi-Fi for network verification.',
          sensorType: 'GPS',
        );
      }

      return LocationResult(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        altitude: position.altitude,
        isMocked: position.isMocked,
        timestamp: position.timestamp,
      );
    } catch (e) {
      if (e is SensorException) rethrow;
      throw SensorException(
        'Failed to acquire GPS fix: ${e.toString()}',
        sensorType: 'GPS',
      );
    }
  }

  /// Calculates geodesic distance between two points in meters using Haversine formula.
  static double distanceBetween(
    double startLatitude,
    double startLongitude,
    double endLatitude,
    double endLongitude,
  ) {
    return Geolocator.distanceBetween(
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
    );
  }
}
