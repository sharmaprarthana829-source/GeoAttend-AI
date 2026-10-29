import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/application_models.dart';
import '../../services/application_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';

class StudentApplicationsScreen extends StatefulWidget {
  const StudentApplicationsScreen({super.key});

  @override
  State<StudentApplicationsScreen> createState() => _StudentApplicationsScreenState();
}

class _StudentApplicationsScreenState extends State<StudentApplicationsScreen> {
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
      final apps = await service.getMyApplications();
      if (mounted) setState(() => _applications = apps);
    } catch (_) {
      // Ignore
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _openSubmitModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SubmitApplicationSheet(onSubmitted: _loadApplications),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Attendance Applications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadApplications,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading your applications...')
          : _applications.isEmpty
              ? EmptyStateView(
                  icon: Icons.assignment_outlined,
                  title: 'No Applications Submitted',
                  description: 'Submit an application to request condonation for short attendance.',
                  action: CustomButton(
                    text: 'Submit Application',
                    icon: Icons.add,
                    isFullWidth: false,
                    onPressed: _openSubmitModal,
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadApplications,
                  color: AppTheme.emeraldPrimary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _applications.length,
                    itemBuilder: (context, index) {
                      final app = _applications[index];
                      return _buildApplicationCard(app);
                    },
                  ),
                ),
      floatingActionButton: _applications.isNotEmpty
          ? FloatingActionButton.extended(
              backgroundColor: AppTheme.emeraldPrimary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('New Application'),
              onPressed: _openSubmitModal,
            )
          : null,
    );
  }

  Widget _buildApplicationCard(AttendanceApplication app) {
    Color statusColor;
    switch (app.status) {
      case ApplicationStatus.pendingFaculty:
      case ApplicationStatus.pendingHod:
      case ApplicationStatus.facultyApproved:
        statusColor = AppTheme.warning;
        break;
      case ApplicationStatus.hodApproved:
        statusColor = AppTheme.success;
        break;
      case ApplicationStatus.facultyRejected:
      case ApplicationStatus.hodRejected:
        statusColor = AppTheme.danger;
        break;
    }

    return CustomCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Application #${app.id}',
                style: const TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              StatusBadge.custom(
                text: app.status.displayName,
                color: statusColor,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            app.subjectName ?? 'Subject Offering #${app.subjectOfferingId}',
            style: const TextStyle(
              color: AppTheme.emeraldLight,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            app.reason,
            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 4),
          Text(
            app.description,
            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
          ),
          if (app.facultyDecision != null || app.hodDecision != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (app.facultyDecision != null) ...[
                    Text(
                      'Faculty Decision: ${app.facultyDecision!.name.toUpperCase()}',
                      style: TextStyle(
                        color: app.facultyDecision == ReviewDecision.approved ? AppTheme.success : AppTheme.danger,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (app.facultyRemarks != null && app.facultyRemarks!.isNotEmpty)
                      Text(
                        'Remarks: ${app.facultyRemarks}',
                        style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                      ),
                  ],
                  if (app.hodDecision != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'HOD Final Decision: ${app.hodDecision!.name.toUpperCase()}',
                      style: TextStyle(
                        color: app.hodDecision == ReviewDecision.approved ? AppTheme.success : AppTheme.danger,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (app.hodRemarks != null && app.hodRemarks!.isNotEmpty)
                      Text(
                        'HOD Remarks: ${app.hodRemarks}',
                        style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                      ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SubmitApplicationSheet extends StatefulWidget {
  final VoidCallback onSubmitted;

  const _SubmitApplicationSheet({required this.onSubmitted});

  @override
  State<_SubmitApplicationSheet> createState() => _SubmitApplicationSheetState();
}

class _SubmitApplicationSheetState extends State<_SubmitApplicationSheet> {
  final _formKey = GlobalKey<FormState>();
  final _reasonController = TextEditingController();
  final _descController = TextEditingController();
  final _docUrlController = TextEditingController();
  int? _selectedOfferingId;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _reasonController.dispose();
    _descController.dispose();
    _docUrlController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedOfferingId == null) {
      setState(() => _errorMessage = 'Please select a subject offering.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final service = Provider.of<ApplicationService>(context, listen: false);
      await service.submitApplication(
        subjectOfferingId: _selectedOfferingId!,
        reason: _reasonController.text.trim(),
        description: _descController.text.trim(),
        supportingDocumentUrl: _docUrlController.text.trim().isNotEmpty ? _docUrlController.text.trim() : null,
      );

      widget.onSubmitted();
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Submit Condonation Application',
                style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Request attendance condonation for medical or official leave.',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 16),
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.danger.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_errorMessage!, style: const TextStyle(color: AppTheme.danger, fontSize: 12)),
                ),
                const SizedBox(height: 12),
              ],
              TextFormField(
                controller: _reasonController,
                style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                decoration: const InputDecoration(
                  labelText: 'Reason (Summary)',
                  hintText: 'e.g., Medical leave due to illness',
                ),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descController,
                maxLines: 3,
                style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                decoration: const InputDecoration(
                  labelText: 'Detailed Explanation',
                  hintText: 'Provide dates and detailed justification...',
                ),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _docUrlController,
                style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                decoration: const InputDecoration(
                  labelText: 'Supporting Document Link (Optional)',
                  hintText: 'https://drive.google.com/...',
                ),
              ),
              const SizedBox(height: 16),
              CustomButton(
                text: 'Submit Application',
                onPressed: _isLoading
                    ? null
                    : () {
                        // Use offering 1 as default if none selected in quick form
                        _selectedOfferingId ??= 1;
                        _handleSubmit();
                      },
                isLoading: _isLoading,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
