import 'package:flutter/foundation.dart';
import 'package:network_info_plus/network_info_plus.dart';

class NetworkResult {
  final String? wifiBSSID;
  final String? wifiSSID;
  final String? wifiIP;
  final bool isAvailable;
  final String? limitationReason;

  NetworkResult({
    this.wifiBSSID,
    this.wifiSSID,
    this.wifiIP,
    required this.isAvailable,
    this.limitationReason,
  });

  Map<String, dynamic> toJson() => {
        'wifi_bssid': wifiBSSID,
        'wifi_ssid': wifiSSID,
        'wifi_ip': wifiIP,
        'is_available': isAvailable,
        'limitation_reason': limitationReason,
      };
}

class NetworkService {
  static final NetworkInfo _networkInfo = NetworkInfo();

  /// Obtains current connected Wi-Fi details.
  /// Reports technical/privacy limitations cleanly without generating fake values.
  static Future<NetworkResult> getWifiInfo() async {
    // Wi-Fi SSID/BSSID access on Android 10+ and iOS 13+ requires fine location permission & capabilities.
    if (kIsWeb || (defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS)) {
      return NetworkResult(
        isAvailable: false,
        limitationReason: 'Wi-Fi BSSID inspection is not supported on ${kIsWeb ? "Web" : defaultTargetPlatform.name}.',
      );
    }

    try {
      final wifiBSSID = await _networkInfo.getWifiBSSID();
      final wifiSSID = await _networkInfo.getWifiName();
      final wifiIP = await _networkInfo.getWifiIP();

      final available = wifiBSSID != null || wifiSSID != null;

      return NetworkResult(
        wifiBSSID: wifiBSSID,
        wifiSSID: wifiSSID?.replaceAll('"', ''), // Remove quotes on iOS
        wifiIP: wifiIP,
        isAvailable: available,
        limitationReason: available
            ? null
            : 'Wi-Fi SSID/BSSID is restricted or device is not connected to a Wi-Fi network.',
      );
    } catch (e) {
      return NetworkResult(
        isAvailable: false,
        limitationReason: 'Failed to access Wi-Fi network information: ${e.toString()}',
      );
    }
  }
}
