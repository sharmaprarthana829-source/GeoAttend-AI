import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/anomaly_models.dart';
import '../../services/anomaly_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';

class AdminAnomalyScreen extends StatefulWidget {
  const AdminAnomalyScreen({super.key});

  @override
  State<AdminAnomalyScreen> createState() => _AdminAnomalyScreenState();
}

class _AdminAnomalyScreenState extends State<AdminAnomalyScreen> {
  bool _isLoading = true;
  List<SuspiciousActivity> _anomalies = [];

  @override
  void initState() {
    super.initState();
    _loadAnomalies();
  }

  Future<void> _loadAnomalies() async {
    setState(() => _isLoading = true);
    try {
      final service = Provider.of<AnomalyService>(context, listen: false);
      final list = await service.getAdminAnomalies();
      if (mounted) setState(() => _anomalies = list);
    } catch (_) {
      // Ignore
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _reviewAnomaly(SuspiciousActivity anomaly, ReviewStatus status) async {
    final notesController = TextEditingController();
    final isConfirm = status == ReviewStatus.confirmed;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: Text(
          isConfirm ? 'Confirm Fraudulent Check-in' : 'Dismiss Flag',
          style: const TextStyle(color: AppTheme.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isConfirm
                  ? 'Confirm fraud for ${anomaly.studentName ?? "this student"}?'
                  : 'Dismiss suspicion flag?',
              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notesController,
              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'Admin Reviewer Notes',
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
              backgroundColor: isConfirm ? AppTheme.danger : AppTheme.emeraldPrimary,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: Text(isConfirm ? 'Confirm' : 'Dismiss'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        final service = Provider.of<AnomalyService>(context, listen: false);
        await service.reviewAdminAnomaly(
          anomaly.id,
          status: status,
          reviewerNotes: notesController.text.trim().isNotEmpty ? notesController.text.trim() : null,
        );
        await _loadAnomalies();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Anomaly review updated.')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e'), backgroundColor: AppTheme.danger),
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
        title: const Text('Campus Anomalies & Fraud Review'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadAnomalies,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading campus suspicious activities...')
          : _anomalies.isEmpty
              ? const EmptyStateView(
                  icon: Icons.shield_outlined,
                  title: 'No Anomalies Found',
                  description: 'No suspicious check-in patterns detected across the campus.',
                )
              : RefreshIndicator(
                  onRefresh: _loadAnomalies,
                  color: AppTheme.emeraldPrimary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _anomalies.length,
                    itemBuilder: (context, index) {
                      final item = _anomalies[index];
                      return CustomCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  item.studentName ?? 'Student #${item.studentId}',
                                  style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                                StatusBadge.custom(
                                  text: item.reviewStatus.name.toUpperCase(),
                                  color: item.isPending
                                      ? AppTheme.warning
                                      : item.reviewStatus == ReviewStatus.confirmed
                                          ? AppTheme.danger
                                          : AppTheme.success,
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Roll: ${item.studentRollNumber ?? "N/A"} · Method: ${item.detectionMethod.toJson().toUpperCase()}',
                              style: const TextStyle(color: AppTheme.emeraldLight, fontSize: 11),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              item.reason,
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                            ),
                            if (item.isPending) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: CustomButton(
                                      text: 'Dismiss',
                                      isOutlined: true,
                                      onPressed: () => _reviewAnomaly(item, ReviewStatus.dismissed),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: CustomButton(
                                      text: 'Confirm Fraud',
                                      color: AppTheme.danger,
                                      onPressed: () => _reviewAnomaly(item, ReviewStatus.confirmed),
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
