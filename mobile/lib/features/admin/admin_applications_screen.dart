import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/application_models.dart';
import '../../services/application_service.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';

class AdminApplicationsScreen extends StatefulWidget {
  const AdminApplicationsScreen({super.key});

  @override
  State<AdminApplicationsScreen> createState() => _AdminApplicationsScreenState();
}

class _AdminApplicationsScreenState extends State<AdminApplicationsScreen> {
  bool _isLoading = true;
  List<AttendanceApplication> _applications = [];

  @override
  void initState() {
    super.initState();
    _loadApplications();
  }

  Future<void> _loadApplications() async {
    setState(() => _isLoading = true);
    try {
      final service = Provider.of<ApplicationService>(context, listen: false);
      final list = await service.getAdminApplications();
      if (mounted) setState(() => _applications = list);
    } catch (_) {
      // Ignore
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Campus Applications Monitor'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadApplications,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading applications...')
          : _applications.isEmpty
              ? const EmptyStateView(
                  icon: Icons.assignment_outlined,
                  title: 'No Applications Found',
                  description: 'No students have submitted attendance applications.',
                )
              : RefreshIndicator(
                  onRefresh: _loadApplications,
                  color: AppTheme.emeraldPrimary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _applications.length,
                    itemBuilder: (context, index) {
                      final app = _applications[index];
                      return CustomCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  app.studentName ?? 'Student #${app.studentId}',
                                  style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                                StatusBadge.custom(
                                  text: app.status.displayName,
                                  color: app.status == ApplicationStatus.hodApproved
                                      ? AppTheme.success
                                      : app.status == ApplicationStatus.facultyRejected ||
                                              app.status == ApplicationStatus.hodRejected
                                          ? AppTheme.danger
                                          : AppTheme.warning,
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Roll: ${app.studentRollNumber ?? "N/A"} · ${app.subjectName ?? "Subject"}',
                              style: const TextStyle(color: AppTheme.emeraldLight, fontSize: 11),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              app.reason,
                              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              app.description,
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
