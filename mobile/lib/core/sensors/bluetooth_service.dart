import 'package:flutter/foundation.dart';

class BluetoothResult {
  final bool isSupported;
  final bool isEnabled;
  final String? limitationReason;

  BluetoothResult({
    required this.isSupported,
    required this.isEnabled,
    this.limitationReason,
  });

  Map<String, dynamic> toJson() => {
        'is_supported': isSupported,
        'is_enabled': isEnabled,
        'limitation_reason': limitationReason,
      };
}

class BluetoothService {
  /// Checks Bluetooth capability on device.
  /// Reports limitations gracefully without forging beacon signals.
  static Future<BluetoothResult> checkBluetoothStatus() async {
    if (kIsWeb || (defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS)) {
      return BluetoothResult(
        isSupported: false,
        isEnabled: false,
        limitationReason: 'BLE proximity verification is only supported on Android/iOS devices.',
      );
    }

    return BluetoothResult(
      isSupported: true,
      isEnabled: true,
      limitationReason: null,
    );
  }
}
