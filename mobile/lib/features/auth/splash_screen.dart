import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/auth_models.dart';
import '../../services/auth_service.dart';
import '../admin/admin_dashboard_screen.dart';
import '../faculty/faculty_dashboard_screen.dart';
import '../student/student_dashboard_screen.dart';
import 'login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAuth();
    });
  }

  Future<void> _checkAuth() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    await authService.initialize();

    if (!mounted) return;

    if (authService.isAuthenticated && authService.currentUser != null) {
      _navigateByRole(authService.currentUser!);
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  void _navigateByRole(User user) {
    Widget destination;
    switch (user.role) {
      case UserRole.student:
        destination = const StudentDashboardScreen();
        break;
      case UserRole.faculty:
        destination = const FacultyDashboardScreen();
        break;
      case UserRole.admin:
        destination = const AdminDashboardScreen();
        break;
    }

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => destination),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.emeraldPrimary.withOpacity(0.1),
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.emeraldPrimary.withOpacity(0.3), width: 2),
              ),
              child: const Icon(
                Icons.location_on,
                size: 56,
                color: AppTheme.emeraldPrimary,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'GeoAttend AI',
              style: TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 26,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Precision Geofenced Campus Attendance',
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 32),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(AppTheme.emeraldPrimary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
