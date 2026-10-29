import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/application_models.dart';
import '../../services/application_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';

class FacultyApplicationsScreen extends StatefulWidget {
  const FacultyApplicationsScreen({super.key});

  @override
  State<FacultyApplicationsScreen> createState() => _FacultyApplicationsScreenState();
}

class _FacultyApplicationsScreenState extends State<FacultyApplicationsScreen> {
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
      final apps = await service.getFacultyApplications();
      if (mounted) setState(() => _applications = apps);
    } catch (_) {
      // Ignore
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _reviewApplication(AttendanceApplication app, ReviewDecision decision) async {
    final remarksController = TextEditingController();
    final isApprove = decision == ReviewDecision.approved;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: Text(
          isApprove ? 'Approve & Forward to HOD' : 'Reject Application',
          style: const TextStyle(color: AppTheme.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isApprove
                  ? 'Approve ${app.studentName ?? "student"}\'s attendance condonation request and forward to HOD Desk?'
                  : 'Reject this condonation request?',
              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: remarksController,
              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'Remarks (Optional)',
                hintText: 'e.g., Medical certificate verified',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isApprove ? AppTheme.emeraldPrimary : AppTheme.danger,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: Text(isApprove ? 'Approve' : 'Reject'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        final service = Provider.of<ApplicationService>(context, listen: false);
        await service.reviewFacultyApplication(
          app.id,
          decision: decision,
          remarks: remarksController.text.trim().isNotEmpty ? remarksController.text.trim() : null,
        );
        await _loadApplications();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Application review updated.')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Review failed: $e'), backgroundColor: AppTheme.danger),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Student Applications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadApplications,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading student applications...')
          : _applications.isEmpty
              ? const EmptyStateView(
                  icon: Icons.assignment_turned_in_outlined,
                  title: 'No Pending Applications',
                  description: 'No students have submitted attendance condonation requests for your subjects.',
                )
              : RefreshIndicator(
                  onRefresh: _loadApplications,
                  color: AppTheme.emeraldPrimary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _applications.length,
                    itemBuilder: (context, index) {
                      final app = _applications[index];
                      final isPending = app.status == ApplicationStatus.pendingFaculty;

                      return CustomCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  app.studentName ?? 'Student #${app.studentId}',
                                  style: const TextStyle(
                                    color: AppTheme.textPrimary,
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                StatusBadge.custom(
                                  text: app.status.displayName,
                                  color: isPending ? AppTheme.warning : AppTheme.success,
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Roll: ${app.studentRollNumber ?? "N/A"} · ${app.subjectName ?? "Subject"}',
                              style: const TextStyle(color: AppTheme.emeraldLight, fontSize: 12),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              app.reason,
                              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              app.description,
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                            ),
                            if (isPending) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: CustomButton(
                                      text: 'Reject',
                                      color: AppTheme.danger,
                                      onPressed: () => _reviewApplication(app, ReviewDecision.rejected),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: CustomButton(
                                      text: 'Approve & Forward',
                                      color: AppTheme.emeraldPrimary,
                                      onPressed: () => _reviewApplication(app, ReviewDecision.approved),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
