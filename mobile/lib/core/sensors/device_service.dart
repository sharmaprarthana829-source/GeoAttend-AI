import 'package:flutter/foundation.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DeviceInfoResult {
  final String deviceId;
  final String model;
  final String manufacturer;
  final String osVersion;
  final String platform;
  final bool isPhysicalDevice;

  DeviceInfoResult({
    required this.deviceId,
    required this.model,
    required this.manufacturer,
    required this.osVersion,
    required this.platform,
    required this.isPhysicalDevice,
  });

  Map<String, dynamic> toJson() => {
        'device_id': deviceId,
        'device_model': '$manufacturer $model ($platform $osVersion)',
        'manufacturer': manufacturer,
        'model': model,
        'os_version': osVersion,
        'platform': platform,
        'is_physical_device': isPhysicalDevice,
      };
}

class DeviceService {
  static final DeviceInfoPlugin _deviceInfoPlugin = DeviceInfoPlugin();
  static const String _prefAppInstallationId = 'geoattend_app_installation_id';

  /// Obtains a persistent, non-invasive installation ID stored in SharedPreferences.
  static Future<String> getAppInstallationId() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_prefAppInstallationId);
    if (id == null) {
      id = 'dev_${DateTime.now().millisecondsSinceEpoch}_${(1000 + (DateTime.now().microsecond % 9000))}';
      await prefs.setString(_prefAppInstallationId, id);
    }
    return id;
  }

  /// Collects real native device information safely across Web, Desktop and Mobile.
  static Future<DeviceInfoResult> getDeviceInfo() async {
    final installationId = await getAppInstallationId();

    try {
      if (kIsWeb) {
        final webBrowserInfo = await _deviceInfoPlugin.webBrowserInfo;
        return DeviceInfoResult(
          deviceId: installationId,
          model: webBrowserInfo.browserName.name,
          manufacturer: webBrowserInfo.vendor ?? 'Web Browser',
          osVersion: webBrowserInfo.userAgent ?? 'Web',
          platform: 'Web',
          isPhysicalDevice: true,
        );
      } else if (defaultTargetPlatform == TargetPlatform.android) {
        final androidInfo = await _deviceInfoPlugin.androidInfo;
        return DeviceInfoResult(
          deviceId: androidInfo.id.isNotEmpty ? androidInfo.id : installationId,
          model: androidInfo.model,
          manufacturer: androidInfo.manufacturer,
          osVersion: 'Android ${androidInfo.version.release} (SDK ${androidInfo.version.sdkInt})',
          platform: 'Android',
          isPhysicalDevice: androidInfo.isPhysicalDevice,
        );
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final iosInfo = await _deviceInfoPlugin.iosInfo;
        return DeviceInfoResult(
          deviceId: iosInfo.identifierForVendor ?? installationId,
          model: iosInfo.utsname.machine,
          manufacturer: 'Apple',
          osVersion: 'iOS ${iosInfo.systemVersion}',
          platform: 'iOS',
          isPhysicalDevice: iosInfo.isPhysicalDevice,
        );
      } else if (defaultTargetPlatform == TargetPlatform.macOS) {
        final macInfo = await _deviceInfoPlugin.macOsInfo;
        return DeviceInfoResult(
          deviceId: macInfo.systemGUID ?? installationId,
          model: macInfo.model,
          manufacturer: 'Apple',
          osVersion: 'macOS ${macInfo.osRelease}',
          platform: 'macOS',
          isPhysicalDevice: true,
        );
      } else {
        return DeviceInfoResult(
          deviceId: installationId,
          model: 'Desktop / Other',
          manufacturer: 'Generic',
          osVersion: defaultTargetPlatform.name,
          platform: defaultTargetPlatform.name,
          isPhysicalDevice: true,
        );
      }
    } catch (_) {
      return DeviceInfoResult(
        deviceId: installationId,
        model: 'Generic Device',
        manufacturer: 'Generic',
        osVersion: kIsWeb ? 'Web' : defaultTargetPlatform.name,
        platform: kIsWeb ? 'Web' : defaultTargetPlatform.name,
        isPhysicalDevice: true,
      );
    }
  }
}
