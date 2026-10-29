import 'package:flutter/material.dart';
import '../features/admin/admin_dashboard_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/splash_screen.dart';
import '../features/faculty/faculty_dashboard_screen.dart';
import '../features/faculty/hod_desk_screen.dart';
import '../features/notices/notifications_screen.dart';
import '../features/student/student_dashboard_screen.dart';

class AppRoutes {
  static const String splash = '/';
  static const String login = '/login';
  static const String studentDashboard = '/student/dashboard';
  static const String facultyDashboard = '/faculty/dashboard';
  static const String hodDesk = '/faculty/hod-desk';
  static const String adminDashboard = '/admin/dashboard';
  static const String notifications = '/notifications';

  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case splash:
        return MaterialPageRoute(builder: (_) => const SplashScreen());
      case login:
        return MaterialPageRoute(builder: (_) => const LoginScreen());
      case studentDashboard:
        return MaterialPageRoute(builder: (_) => const StudentDashboardScreen());
      case facultyDashboard:
        return MaterialPageRoute(builder: (_) => const FacultyDashboardScreen());
      case hodDesk:
        return MaterialPageRoute(builder: (_) => const HodDeskScreen());
      case adminDashboard:
        return MaterialPageRoute(builder: (_) => const AdminDashboardScreen());
      case notifications:
        return MaterialPageRoute(builder: (_) => const NotificationsScreen());
      default:
        return MaterialPageRoute(builder: (_) => const SplashScreen());
    }
  }
}
