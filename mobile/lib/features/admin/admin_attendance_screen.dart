import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/attendance_models.dart';
import '../../services/attendance_service.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';

class AdminAttendanceScreen extends StatefulWidget {
  const AdminAttendanceScreen({super.key});

  @override
  State<AdminAttendanceScreen> createState() => _AdminAttendanceScreenState();
}

class _AdminAttendanceScreenState extends State<AdminAttendanceScreen> {
  bool _isLoading = true;
  List<AttendanceSession> _sessions = [];

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    setState(() => _isLoading = true);
    try {
      final service = Provider.of<AttendanceService>(context, listen: false);
      final list = await service.getAdminSessions();
      if (mounted) setState(() => _sessions = list);
    } catch (_) {
      // Ignore
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _inspectSession(AttendanceSession session) async {
    final service = Provider.of<AttendanceService>(context, listen: false);
    final records = await service.getSessionRecords(session.id).catchError((_) => <AttendanceRecord>[]);

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: AppTheme.surfaceDark,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.75,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Session #${session.id} Records',
                  style: const TextStyle(color: AppTheme.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                if (session.isActive) StatusBadge.active() else StatusBadge.completed(),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${session.subjectName ?? "Class"} · ${session.facultyName ?? "Faculty"} · ${session.roomNumber ?? "Room"}',
              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: records.isEmpty
                  ? const Center(child: Text('No student check-ins recorded.', style: TextStyle(color: AppTheme.textMuted)))
                  : ListView.builder(
                      itemCount: records.length,
                      itemBuilder: (context, idx) {
                        final r = records[idx];
                        return CustomCard(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    r.studentName ?? 'Student #${r.studentId}',
                                    style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                  Text(
                                    r.studentRollNumber ?? 'Roll Number',
                                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                                  ),
                                ],
                              ),
                              StatusBadge.custom(
                                text: r.status.name.toUpperCase(),
                                color: r.isSuspicious ? AppTheme.warning : AppTheme.success,
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Campus Attendance Monitor'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadSessions,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading campus attendance sessions...')
          : _sessions.isEmpty
              ? const EmptyStateView(
                  icon: Icons.meeting_room_outlined,
                  title: 'No Sessions Found',
                  description: 'Campus attendance sessions will appear here as faculty conduct classes.',
                )
              : RefreshIndicator(
                  onRefresh: _loadSessions,
                  color: AppTheme.emeraldPrimary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _sessions.length,
                    itemBuilder: (context, index) {
                      final s = _sessions[index];
                      return CustomCard(
                        onTap: () => _inspectSession(s),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: s.isActive
                                    ? AppTheme.emeraldPrimary.withOpacity(0.15)
                                    : const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                Icons.meeting_room,
                                color: s.isActive ? AppTheme.emeraldPrimary : AppTheme.textMuted,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        s.subjectName ?? 'Session #${s.id}',
                                        style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                      const SizedBox(width: 6),
                                      if (s.isActive) StatusBadge.active() else StatusBadge.completed(),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${s.facultyName ?? "Faculty"} · ${s.roomNumber ?? "Room"} · Section ${s.sectionName ?? "A"}',
                                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: AppTheme.textMuted),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
