import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/attendance_models.dart';
import '../../services/attendance_service.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';

class StudentAttendanceScreen extends StatefulWidget {
  const StudentAttendanceScreen({super.key});

  @override
  State<StudentAttendanceScreen> createState() => _StudentAttendanceScreenState();
}

class _StudentAttendanceScreenState extends State<StudentAttendanceScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  List<StudentSummaryItem> _summary = [];
  List<AttendanceRecord> _history = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final service = Provider.of<AttendanceService>(context, listen: false);
      final results = await Future.wait([
        service.getStudentSummary().catchError((_) => <StudentSummaryItem>[]),
        service.getStudentHistory().catchError((_) => <AttendanceRecord>[]),
      ]);

      if (mounted) {
        setState(() {
          _summary = results[0] as List<StudentSummaryItem>;
          _history = results[1] as List<AttendanceRecord>;
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('My Attendance'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.emeraldPrimary,
          labelColor: AppTheme.emeraldPrimary,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: const [
            Tab(text: 'Subject Summary'),
            Tab(text: 'Check-In History'),
          ],
        ),
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading attendance records...')
          : TabBarView(
              controller: _tabController,
              children: [
                _buildSummaryTab(),
                _buildHistoryTab(),
              ],
            ),
    );
  }

  Widget _buildSummaryTab() {
    if (_summary.isEmpty) {
      return const EmptyStateView(
        icon: Icons.assessment_outlined,
        title: 'No Subject Attendance Records',
        description: 'Attendance records will appear here as your classes take place.',
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppTheme.emeraldPrimary,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _summary.length,
        itemBuilder: (context, index) {
          final item = _summary[index];
          final isShort = item.percentage < 75.0;

          return CustomCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.subjectName,
                            style: const TextStyle(
                              color: AppTheme.textPrimary,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${item.subjectCode} · ${item.classType.toUpperCase()}',
                            style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    StatusBadge.custom(
                      text: isShort ? 'SHORT' : 'ELIGIBLE',
                      color: isShort ? AppTheme.danger : AppTheme.success,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Attended ${item.attendedClasses} of ${item.totalClasses} classes',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                    ),
                    Text(
                      '${item.percentage.toStringAsFixed(1)}%',
                      style: TextStyle(
                        color: isShort ? AppTheme.danger : AppTheme.success,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: item.totalClasses > 0 ? (item.attendedClasses / item.totalClasses).clamp(0.0, 1.0) : 1.0,
                    minHeight: 6,
                    backgroundColor: const Color(0xFF0F172A),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      isShort ? AppTheme.danger : AppTheme.success,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHistoryTab() {
    if (_history.isEmpty) {
      return const EmptyStateView(
        icon: Icons.history,
        title: 'No Check-In History',
        description: 'You have not checked in to any attendance sessions yet.',
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppTheme.emeraldPrimary,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _history.length,
        itemBuilder: (context, index) {
          final rec = _history[index];

          return CustomCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: rec.isSuspicious
                        ? AppTheme.danger.withOpacity(0.15)
                        : AppTheme.emeraldPrimary.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    rec.isSuspicious ? Icons.warning_amber_rounded : Icons.check_circle_outline,
                    size: 18,
                    color: rec.isSuspicious ? AppTheme.danger : AppTheme.emeraldPrimary,
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
                            'Session #${rec.sessionId}',
                            style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          const SizedBox(width: 6),
                          StatusBadge.custom(
                            text: rec.status.name.toUpperCase(),
                            color: rec.status == AttendanceStatus.present
                                ? AppTheme.success
                                : rec.status == AttendanceStatus.late
                                    ? AppTheme.warning
                                    : AppTheme.danger,
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        rec.checkInTime.isNotEmpty ? rec.checkInTime : 'Recent Check-in',
                        style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                if (rec.distanceMeters != null)
                  Text(
                    '${rec.distanceMeters!.toStringAsFixed(1)}m',
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11, fontFamily: 'monospace'),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
