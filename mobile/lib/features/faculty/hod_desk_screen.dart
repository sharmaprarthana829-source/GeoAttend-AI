import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/application_models.dart';
import '../../services/application_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';

class HodDeskScreen extends StatefulWidget {
  const HodDeskScreen({super.key});

  @override
  State<HodDeskScreen> createState() => _HodDeskScreenState();
}

class _HodDeskScreenState extends State<HodDeskScreen> {
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
      final list = await service.getHodApplications();
      if (mounted) setState(() => _applications = list);
    } catch (_) {
      // Ignore
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _reviewHodDecision(AttendanceApplication app, ReviewDecision decision) async {
    final remarksController = TextEditingController();
    final isApprove = decision == ReviewDecision.approved;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: Text(
          isApprove ? 'Grant HOD Condonation' : 'Reject Application',
          style: const TextStyle(color: AppTheme.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isApprove
                  ? 'Grant final departmental attendance condonation for ${app.studentName ?? "this student"}?'
                  : 'Reject this application at the HOD stage?',
              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: remarksController,
              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'HOD Order / Remarks (Optional)',
                hintText: 'e.g., Condonation granted as per university medical guidelines',
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
            child: Text(isApprove ? 'Grant Condonation' : 'Reject'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        final service = Provider.of<ApplicationService>(context, listen: false);
        await service.reviewHodApplication(
          app.id,
          decision: decision,
          remarks: remarksController.text.trim().isNotEmpty ? remarksController.text.trim() : null,
        );
        await _loadApplications();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('HOD decision recorded successfully.')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Decision failed: $e'), backgroundColor: AppTheme.danger),
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
        title: const Row(
          children: [
            Icon(Icons.verified_user, size: 20, color: AppTheme.emeraldPrimary),
            SizedBox(width: 8),
            Text('HOD Executive Desk'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadApplications,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading departmental condonation queue...')
          : _applications.isEmpty
              ? const EmptyStateView(
                  icon: Icons.check_circle_outline,
                  title: 'No Pending Departmental Applications',
                  description: 'All submitted student condonation requests have been reviewed.',
                )
              : RefreshIndicator(
                  onRefresh: _loadApplications,
                  color: AppTheme.emeraldPrimary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _applications.length,
                    itemBuilder: (context, index) {
                      final app = _applications[index];
                      final isPending = app.status == ApplicationStatus.pendingHod ||
                          app.status == ApplicationStatus.facultyApproved;

                      return CustomCard(
                        borderColor: isPending ? AppTheme.emeraldPrimary.withOpacity(0.4) : const Color(0xFF334155),
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
                            if (app.facultyRemarks != null && app.facultyRemarks!.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0F172A),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'Faculty Recommendation: "${app.facultyRemarks}"',
                                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 11, fontStyle: FontStyle.italic),
                                ),
                              ),
                            ],
                            if (isPending) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: CustomButton(
                                      text: 'Reject',
                                      color: AppTheme.danger,
                                      onPressed: () => _reviewHodDecision(app, ReviewDecision.rejected),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: CustomButton(
                                      text: 'Grant Condonation',
                                      color: AppTheme.emeraldPrimary,
                                      onPressed: () => _reviewHodDecision(app, ReviewDecision.approved),
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
