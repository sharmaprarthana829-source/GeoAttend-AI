import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/attendance_models.dart';
import '../../services/attendance_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/status_badge.dart';

class StudentCheckinSheet extends StatefulWidget {
  final AttendanceSession session;
  final VoidCallback onCheckInSuccess;

  const StudentCheckinSheet({
    super.key,
    required this.session,
    required this.onCheckInSuccess,
  });

  static Future<void> show(
    BuildContext context, {
    required AttendanceSession session,
    required VoidCallback onCheckInSuccess,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StudentCheckinSheet(
        session: session,
        onCheckInSuccess: onCheckInSuccess,
      ),
    );
  }

  @override
  State<StudentCheckinSheet> createState() => _StudentCheckinSheetState();
}

class _StudentCheckinSheetState extends State<StudentCheckinSheet> {
  final _qrController = TextEditingController();
  bool _isLoading = false;
  String? _statusMessage;
  CheckInResponse? _response;
  String? _errorMessage;

  @override
  void dispose() {
    _qrController.dispose();
    super.dispose();
  }

  Future<void> _handleCheckIn() async {
    setState(() {
      _isLoading = true;
      _statusMessage = 'Acquiring GPS location & sensor signals...';
      _errorMessage = null;
      _response = null;
    });

    try {
      final attendanceService = Provider.of<AttendanceService>(context, listen: false);

      setState(() {
        _statusMessage = 'Verifying campus geofence with backend...';
      });

      final res = await attendanceService.checkIn(
        sessionId: widget.session.id,
        qrToken: _qrController.text.trim().isNotEmpty ? _qrController.text.trim() : null,
      );

      setState(() {
        _response = res;
      });

      widget.onCheckInSuccess();
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
        _statusMessage = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;

    return Container(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFF475569),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Class Check-In',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Session #${session.id} · ${session.sessionDate}',
                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                  ),
                ],
              ),
              StatusBadge.active(),
            ],
          ),
          const SizedBox(height: 16),

          // Session Details Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.bgDark,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.subjectName ?? 'Scheduled Class',
                  style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.person_outline, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      session.facultyName ?? 'Faculty',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                    ),
                    const SizedBox(width: 12),
                    const Icon(Icons.meeting_room_outlined, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      session.roomNumber ?? 'Room C-204',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.layers_outlined, size: 14, color: AppTheme.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      'Section ${session.sectionName ?? "A"} ${session.studentGroupName != null ? "(Group ${session.studentGroupName})" : ""}',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Optional QR Code input if requested by faculty
          if (_response == null) ...[
            TextFormField(
              controller: _qrController,
              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
              decoration: const InputDecoration(
                labelText: 'QR Token (Optional / Auto-Scanned)',
                hintText: 'Enter session QR token if provided',
                prefixIcon: Icon(Icons.qr_code_scanner, size: 20, color: AppTheme.textMuted),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Loading Progress State
          if (_isLoading && _statusMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.emeraldPrimary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.emeraldPrimary.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.emeraldPrimary),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _statusMessage!,
                      style: const TextStyle(color: AppTheme.emeraldLight, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Error State
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.danger.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.danger.withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.cancel, size: 18, color: AppTheme.danger),
                      SizedBox(width: 8),
                      Text(
                        'Check-In Failed',
                        style: TextStyle(color: AppTheme.danger, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _errorMessage!,
                    style: const TextStyle(color: AppTheme.danger, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Success / Verification Result State
          if (_response != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _response!.isSuspicious
                    ? AppTheme.warning.withOpacity(0.12)
                    : AppTheme.success.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _response!.isSuspicious
                      ? AppTheme.warning.withOpacity(0.4)
                      : AppTheme.success.withOpacity(0.4),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        _response!.isSuspicious ? Icons.warning_amber_rounded : Icons.check_circle,
                        color: _response!.isSuspicious ? AppTheme.warning : AppTheme.success,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _response!.isSuspicious
                            ? 'CHECK-IN FLAGGED FOR REVIEW'
                            : 'ATTENDANCE MARKED PRESENT',
                        style: TextStyle(
                          color: _response!.isSuspicious ? AppTheme.warning : AppTheme.success,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _response!.message,
                    style: const TextStyle(color: AppTheme.textPrimary, fontSize: 12),
                  ),
                  if (_response!.record.distanceMeters != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Distance from classroom: ${_response!.record.distanceMeters!.toStringAsFixed(1)} meters (Verified GPS)',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                    ),
                  ],
                  if (_response!.isSuspicious && _response!.flagReason != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Flag reason: ${_response!.flagReason}',
                      style: const TextStyle(color: AppTheme.warning, fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Action Button
          if (_response == null)
            CustomButton(
              text: 'Verify GPS & Check In',
              icon: Icons.my_location,
              onPressed: _isLoading ? null : _handleCheckIn,
              isLoading: _isLoading,
            )
          else
            CustomButton(
              text: 'Done',
              onPressed: () => Navigator.of(context).pop(),
            ),
        ],
      ),
    );
  }
}
