import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/constants/theme.dart';
import 'features/auth/splash_screen.dart';
import 'routing/app_router.dart';
import 'services/anomaly_service.dart';
import 'services/application_service.dart';
import 'services/attendance_service.dart';
import 'services/auth_service.dart';
import 'services/notice_service.dart';
import 'services/push_notification_service.dart';
import 'services/timetable_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const GeoAttendApp());
}

class GeoAttendApp extends StatelessWidget {
  const GeoAttendApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProvider(create: (_) => AttendanceService()),
        ChangeNotifierProvider(create: (_) => TimetableService()),
        ChangeNotifierProvider(create: (_) => ApplicationService()),
        ChangeNotifierProvider(create: (_) => AnomalyService()),
        ChangeNotifierProvider(create: (_) => NoticeService()),
        ChangeNotifierProvider(create: (_) => PushNotificationService()),
      ],
      child: MaterialApp(
        title: 'GeoAttend AI',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: const SplashScreen(),
        onGenerateRoute: AppRoutes.onGenerateRoute,
      ),
    );
  }
}
