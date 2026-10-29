import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/attendance_models.dart';
import '../../models/timetable_models.dart';
import '../../services/attendance_service.dart';
import '../../services/auth_service.dart';
import '../../services/timetable_service.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';
import '../auth/login_screen.dart';
import '../notices/notices_screen.dart';
import 'student_applications_screen.dart';
import 'student_attendance_screen.dart';
import 'student_checkin_sheet.dart';

class StudentDashboardScreen extends StatefulWidget {
  const StudentDashboardScreen({super.key});

  @override
  State<StudentDashboardScreen> createState() => _StudentDashboardScreenState();
}

class _StudentDashboardScreenState extends State<StudentDashboardScreen> {
  int _currentTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      const _StudentDashboardHome(),
      const StudentAttendanceScreen(),
      const StudentApplicationsScreen(),
      const NoticesScreen(),
    ];

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: screens[_currentTabIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTabIndex,
        onTap: (index) => setState(() => _currentTabIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.assessment_outlined),
            activeIcon: Icon(Icons.assessment),
            label: 'Attendance',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.assignment_outlined),
            activeIcon: Icon(Icons.assignment),
            label: 'Applications',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.notifications_outlined),
            activeIcon: Icon(Icons.notifications),
            label: 'Notices',
          ),
        ],
      ),
    );
  }
}

class _StudentDashboardHome extends StatefulWidget {
  const _StudentDashboardHome();

  @override
  State<_StudentDashboardHome> createState() => _StudentDashboardHomeState();
}

class _StudentDashboardHomeState extends State<_StudentDashboardHome> {
  bool _isLoading = true;
  List<AttendanceSession> _activeSessions = [];
  List<TimetableEntry> _todayTimetable = [];
  List<StudentSummaryItem> _summary = [];
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) => _pollActiveSessions());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _pollActiveSessions() async {
    if (!mounted) return;
    try {
      final attendanceService = Provider.of<AttendanceService>(context, listen: false);
      final sessions = await attendanceService.getStudentActiveSessions();
      if (mounted) {
        setState(() {
          _activeSessions = sessions;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadDashboardData() async {
    setState(() => _isLoading = true);
    try {
      final attendanceService = Provider.of<AttendanceService>(context, listen: false);
      final timetableService = Provider.of<TimetableService>(context, listen: false);

      final results = await Future.wait([
        attendanceService.getStudentActiveSessions().catchError((_) => <AttendanceSession>[]),
        timetableService.getStudentToday().catchError((_) => <TimetableEntry>[]),
        attendanceService.getStudentSummary().catchError((_) => <StudentSummaryItem>[]),
      ]);

      if (mounted) {
        setState(() {
          _activeSessions = results[0] as List<AttendanceSession>;
          _todayTimetable = results[1] as List<TimetableEntry>;
          _summary = results[2] as List<StudentSummaryItem>;
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);
    final user = authService.currentUser;

    final totalClasses = _summary.fold<int>(0, (sum, s) => sum + s.totalClasses);
    final attendedClasses = _summary.fold<int>(0, (sum, s) => sum + s.attendedClasses);
    final overallPct = totalClasses > 0 ? ((attendedClasses / totalClasses) * 100) : 100.0;
    final isAttendanceShort = overallPct < 75.0 && totalClasses > 0;

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Student Portal'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDashboardData,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await authService.logout();
              if (context.mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading your attendance dashboard...')
          : RefreshIndicator(
              onRefresh: _loadDashboardData,
              color: AppTheme.emeraldPrimary,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Profile Welcome Card
                    CustomCard(
                      backgroundColor: const Color(0xFF0F172A),
                      borderColor: AppTheme.emeraldPrimary.withOpacity(0.3),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppTheme.emeraldPrimary.withOpacity(0.15),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.school, color: AppTheme.emeraldPrimary, size: 24),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  user?.fullName ?? 'Student',
                                  style: const TextStyle(
                                    color: AppTheme.textPrimary,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Roll: ${user?.studentProfile?.rollNumber ?? "CS24A001"}',
                                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Overall Attendance KPI Card
                    CustomCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Overall Attendance',
                                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                              ),
                              StatusBadge.custom(
                                text: isAttendanceShort ? 'SHORT' : 'ELIGIBLE',
                                color: isAttendanceShort ? AppTheme.danger : AppTheme.success,
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                '${overallPct.toStringAsFixed(1)}%',
                                style: TextStyle(
                                  color: isAttendanceShort ? AppTheme.danger : AppTheme.success,
                                  fontSize: 32,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                '$attendedClasses / $totalClasses classes attended',
                                style: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: LinearProgressIndicator(
                              value: totalClasses > 0 ? (attendedClasses / totalClasses).clamp(0.0, 1.0) : 1.0,
                              minHeight: 8,
                              backgroundColor: const Color(0xFF334155),
                              valueColor: AlwaysStoppedAnimation<Color>(
                                isAttendanceShort ? AppTheme.danger : AppTheme.success,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Short Attendance Warning Alert
                    if (isAttendanceShort) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppTheme.danger.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppTheme.danger.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.warning_amber_rounded, color: AppTheme.danger, size: 22),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Attendance Shortage Warning',
                                    style: TextStyle(color: AppTheme.danger, fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Your overall attendance is below the mandatory 75% threshold. Please submit a condonation application if you have valid reasons.',
                                    style: TextStyle(color: AppTheme.danger.withOpacity(0.9), fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Live Active Attendance Sessions Card
                    if (_activeSessions.isNotEmpty) ...[
                      CustomCard(
                        borderColor: AppTheme.emeraldPrimary.withOpacity(0.5),
                        backgroundColor: AppTheme.emeraldPrimary.withOpacity(0.08),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: AppTheme.emeraldPrimary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Live Sessions Ready for Check-In (${_activeSessions.length})',
                                  style: const TextStyle(
                                    color: AppTheme.emeraldLight,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            ...(_activeSessions.map((session) => Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AppTheme.surfaceDark,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: AppTheme.emeraldPrimary.withOpacity(0.2)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              session.subjectName ?? 'Class Session',
                                              style: const TextStyle(
                                                color: AppTheme.textPrimary,
                                                fontWeight: FontWeight.w600,
                                                fontSize: 14,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              '${session.facultyName ?? "Faculty"} · ${session.roomNumber ?? "Room"} · ${session.classType?.name.toUpperCase() ?? "THEORY"}',
                                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                            ),
                                          ],
                                        ),
                                      ),
                                      ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppTheme.emeraldPrimary,
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                        ),
                                        onPressed: () => StudentCheckinSheet.show(
                                          context,
                                          session: session,
                                          onCheckInSuccess: _loadDashboardData,
                                        ),
                                        child: const Text('Check In', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  ),
                                ))),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Today's Timetable Section
                    const Text(
                      'Today\'s Schedule',
                      style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (_todayTimetable.isEmpty)
                      const CustomCard(
                        child: Center(
                          child: Text(
                            'No classes scheduled for today.',
                            style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                          ),
                        ),
                      )
                    else
                      ...(_todayTimetable.map((t) => CustomCard(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF0F172A),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.access_time, size: 16, color: AppTheme.emeraldPrimary),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            t.subjectName ?? 'Subject',
                                            style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                                          ),
                                          const SizedBox(width: 6),
                                          StatusBadge.custom(
                                            text: t.classType.name.toUpperCase(),
                                            color: AppTheme.textSecondary,
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${t.facultyName ?? "Faculty"} · ${t.roomNumber} ${t.studentGroupName != null ? "(Group ${t.studentGroupName})" : ""}',
                                        style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  '${t.startTime.length >= 5 ? t.startTime.substring(0, 5) : t.startTime} - ${t.endTime.length >= 5 ? t.endTime.substring(0, 5) : t.endTime}',
                                  style: const TextStyle(color: AppTheme.emeraldLight, fontSize: 12, fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),
                          ))),
                    const SizedBox(height: 16),

                    // Subject-wise Breakdown Section
                    const Text(
                      'Subject-wise Breakdown',
                      style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (_summary.isEmpty)
                      const CustomCard(
                        child: Center(
                          child: Text(
                            'No subject attendance recorded yet.',
                            style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                          ),
                        ),
                      )
                    else
                      ...(_summary.map((s) {
                        final short = s.percentage < 75.0;
                        return CustomCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      '${s.subjectName} (${s.classType.toUpperCase()})',
                                      style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                                    ),
                                  ),
                                  Text(
                                    '${s.percentage.toStringAsFixed(1)}%',
                                    style: TextStyle(
                                      color: short ? AppTheme.danger : AppTheme.success,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '${s.attendedClasses} / ${s.totalClasses} classes attended',
                                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                                  ),
                                  Text(
                                    short ? 'Short Attendance' : 'Eligible',
                                    style: TextStyle(
                                      color: short ? AppTheme.danger : AppTheme.success,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: s.totalClasses > 0 ? (s.attendedClasses / s.totalClasses).clamp(0.0, 1.0) : 1.0,
                                  minHeight: 6,
                                  backgroundColor: const Color(0xFF0F172A),
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    short ? AppTheme.danger : AppTheme.success,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      })),
                  ],
                ),
              ),
            ),
    );
  }
}
