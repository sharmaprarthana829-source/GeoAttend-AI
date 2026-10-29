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
import 'faculty_anomaly_screen.dart';
import 'faculty_applications_screen.dart';
import 'faculty_sessions_screen.dart';
import 'hod_desk_screen.dart';

class FacultyDashboardScreen extends StatefulWidget {
  const FacultyDashboardScreen({super.key});

  @override
  State<FacultyDashboardScreen> createState() => _FacultyDashboardScreenState();
}

class _FacultyDashboardScreenState extends State<FacultyDashboardScreen> {
  int _currentTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);
    final user = authService.currentUser;
    final isHod = user?.isHod ?? false;

    final screens = <Widget>[
      const _FacultyDashboardHome(),
      const FacultySessionsScreen(),
      const FacultyAnomalyScreen(),
      const FacultyApplicationsScreen(),
      if (isHod) const HodDeskScreen(),
    ];

    final navItems = <BottomNavigationBarItem>[
      const BottomNavigationBarItem(
        icon: Icon(Icons.dashboard_outlined),
        activeIcon: Icon(Icons.dashboard),
        label: 'Dashboard',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.meeting_room_outlined),
        activeIcon: Icon(Icons.meeting_room),
        label: 'Sessions',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.security_outlined),
        activeIcon: Icon(Icons.security),
        label: 'Anomalies',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.assignment_outlined),
        activeIcon: Icon(Icons.assignment),
        label: 'Applications',
      ),
      if (isHod)
        const BottomNavigationBarItem(
          icon: Icon(Icons.verified_user_outlined),
          activeIcon: Icon(Icons.verified_user),
          label: 'HOD Desk',
        ),
    ];

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: screens[_currentTabIndex.clamp(0, screens.length - 1)],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTabIndex.clamp(0, navItems.length - 1),
        onTap: (index) => setState(() => _currentTabIndex = index),
        items: navItems,
      ),
    );
  }
}

class _FacultyDashboardHome extends StatefulWidget {
  const _FacultyDashboardHome();

  @override
  State<_FacultyDashboardHome> createState() => _FacultyDashboardHomeState();
}

class _FacultyDashboardHomeState extends State<_FacultyDashboardHome> {
  bool _isLoading = true;
  List<TimetableEntry> _todayTimetable = [];
  List<AttendanceSession> _sessions = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final timetableService = Provider.of<TimetableService>(context, listen: false);
      final attendanceService = Provider.of<AttendanceService>(context, listen: false);

      final results = await Future.wait([
        timetableService.getFacultyToday().catchError((_) => <TimetableEntry>[]),
        attendanceService.getFacultySessions().catchError((_) => <AttendanceSession>[]),
      ]);

      if (mounted) {
        setState(() {
          _todayTimetable = results[0] as List<TimetableEntry>;
          _sessions = results[1] as List<AttendanceSession>;
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _startSession(TimetableEntry entry) async {
    try {
      final attendanceService = Provider.of<AttendanceService>(context, listen: false);
      final session = await attendanceService.startSession(timetableEntryId: entry.id);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Attendance session #${session.id} is now ACTIVE!')),
        );
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => FacultySessionsScreen(initialSessionId: session.id)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to start session: $e'), backgroundColor: AppTheme.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);
    final user = authService.currentUser;
    final activeSessions = _sessions.where((s) => s.isActive).toList();

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Faculty Portal'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
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
          ? const LoadingIndicator(message: 'Loading today\'s teaching schedule...')
          : RefreshIndicator(
              onRefresh: _loadData,
              color: AppTheme.emeraldPrimary,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Profile Card with Responsibilities
                    CustomCard(
                      backgroundColor: const Color(0xFF0F172A),
                      borderColor: AppTheme.emeraldPrimary.withOpacity(0.3),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppTheme.emeraldPrimary.withOpacity(0.15),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.badge, color: AppTheme.emeraldPrimary, size: 24),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      user?.fullName ?? 'Faculty Member',
                                      style: const TextStyle(
                                        color: AppTheme.textPrimary,
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'ID: ${user?.facultyProfile?.employeeId ?? "FAC001"} · ${user?.facultyProfile?.designation ?? "Faculty"}',
                                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          if (user?.facultyProfile?.responsibilities.isNotEmpty ?? false) ...[
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: user!.facultyProfile!.responsibilities
                                  .where((r) => r.isActive)
                                  .map((r) => StatusBadge.custom(
                                        text: r.responsibilityType.name.toUpperCase(),
                                        color: AppTheme.emeraldLight,
                                      ))
                                  .toList(),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Active Sessions Banner
                    if (activeSessions.isNotEmpty) ...[
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
                                  'Active Attendance Session (${activeSessions.length})',
                                  style: const TextStyle(
                                    color: AppTheme.emeraldLight,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            ...activeSessions.map((s) => Container(
                                  margin: const EdgeInsets.only(bottom: 6),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Session #${s.id} · ${s.subjectName ?? "Class"}',
                                        style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                                      ),
                                      TextButton(
                                        onPressed: () => Navigator.of(context).push(
                                          MaterialPageRoute(builder: (_) => FacultySessionsScreen(initialSessionId: s.id)),
                                        ),
                                        child: const Text('View Live Stream', style: TextStyle(color: AppTheme.emeraldLight, fontSize: 12)),
                                      ),
                                    ],
                                  ),
                                )),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Today's Scheduled Classes
                    const Text(
                      'Today\'s Teaching Schedule',
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
                            'No scheduled classes for today.',
                            style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                          ),
                        ),
                      )
                    else
                      ...(_todayTimetable.map((t) {
                        return CustomCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      t.subjectName ?? 'Subject',
                                      style: const TextStyle(
                                        color: AppTheme.textPrimary,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  StatusBadge.custom(
                                    text: t.classType.name.toUpperCase(),
                                    color: AppTheme.emeraldLight,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${t.roomNumber} · Section ${t.sectionName ?? "A"} ${t.studentGroupName != null ? "(Group ${t.studentGroupName})" : ""}',
                                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${t.startTime.length >= 5 ? t.startTime.substring(0, 5) : t.startTime} - ${t.endTime.length >= 5 ? t.endTime.substring(0, 5) : t.endTime}',
                                style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                              ),
                              const SizedBox(height: 12),
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.emeraldPrimary,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                ),
                                icon: const Icon(Icons.play_arrow, size: 18),
                                label: const Text('Start Attendance Session', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                onPressed: () => _startSession(t),
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
