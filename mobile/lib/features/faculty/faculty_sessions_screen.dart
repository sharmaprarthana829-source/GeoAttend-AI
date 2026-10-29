import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../core/constants/theme.dart';
import '../../models/attendance_models.dart';
import '../../services/attendance_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';

class FacultySessionsScreen extends StatefulWidget {
  final int? initialSessionId;

  const FacultySessionsScreen({super.key, this.initialSessionId});

  @override
  State<FacultySessionsScreen> createState() => _FacultySessionsScreenState();
}

class _FacultySessionsScreenState extends State<FacultySessionsScreen> {
  bool _isLoading = true;
  List<AttendanceSession> _sessions = [];
  AttendanceSession? _selectedSession;
  List<AttendanceRecord> _records = [];
  String? _qrToken;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadSessions() async {
    setState(() => _isLoading = true);
    try {
      final service = Provider.of<AttendanceService>(context, listen: false);
      final list = await service.getFacultySessions();
      if (mounted) {
        setState(() {
          _sessions = list;
          if (widget.initialSessionId != null) {
            _selectedSession = list.firstWhere(
              (s) => s.id == widget.initialSessionId,
              orElse: () => list.isNotEmpty ? list.first : _selectedSession!,
            );
          } else if (_selectedSession == null && list.isNotEmpty) {
            _selectedSession = list.first;
          }
        });
        if (_selectedSession != null) {
          await _loadSessionDetails(_selectedSession!);
        }
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadSessionDetails(AttendanceSession session) async {
    final service = Provider.of<AttendanceService>(context, listen: false);
    final recs = await service.getSessionRecords(session.id).catchError((_) => <AttendanceRecord>[]);
    if (mounted) {
      setState(() {
        _selectedSession = session;
        _records = recs;
      });
    }

    // Start polling if session is active
    _pollingTimer?.cancel();
    if (session.isActive) {
      _pollingTimer = Timer.periodic(const Duration(seconds: 4), (_) async {
        if (!mounted || _selectedSession == null || !_selectedSession!.isActive) {
          _pollingTimer?.cancel();
          return;
        }
        final freshRecs = await service.getSessionRecords(_selectedSession!.id).catchError((_) => <AttendanceRecord>[]);
        if (mounted) {
          setState(() {
            _records = freshRecs;
          });
        }
      });
    }
  }

  Future<void> _closeSession() async {
    if (_selectedSession == null) return;
    try {
      final service = Provider.of<AttendanceService>(context, listen: false);
      await service.closeSession(_selectedSession!.id);
      _pollingTimer?.cancel();
      await _loadSessions();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Session closed successfully.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to close session: $e'), backgroundColor: AppTheme.danger),
        );
      }
    }
  }

  Future<void> _generateQr() async {
    if (_selectedSession == null) return;
    try {
      final service = Provider.of<AttendanceService>(context, listen: false);
      final qrData = await service.getSessionQr(_selectedSession!.id);
      if (mounted) {
        setState(() {
          _qrToken = qrData['qr_token'] as String?;
        });
        _showQrDialog(_qrToken ?? 'NO_TOKEN');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to generate QR: $e'), backgroundColor: AppTheme.danger),
        );
      }
    }
  }

  void _showQrDialog(String token) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Session QR Code', style: TextStyle(color: AppTheme.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.white,
              child: QrImageView(
                data: token,
                version: QrVersions.auto,
                size: 200.0,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Dynamic Token: $token',
              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11, fontFamily: 'monospace'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close', style: TextStyle(color: AppTheme.emeraldPrimary)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Attendance Sessions'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadSessions,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading sessions...')
          : _sessions.isEmpty
              ? const EmptyStateView(
                  icon: Icons.meeting_room_outlined,
                  title: 'No Attendance Sessions Found',
                  description: 'Start a session from your today\'s classes on the dashboard.',
                )
              : RefreshIndicator(
                  onRefresh: _loadSessions,
                  color: AppTheme.emeraldPrimary,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Session Selector Dropdown / Horizontal list
                        SizedBox(
                          height: 48,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: _sessions.length,
                            separatorBuilder: (_, __) => const SizedBox(width: 8),
                            itemBuilder: (context, index) {
                              final s = _sessions[index];
                              final isSel = _selectedSession?.id == s.id;
                              return ChoiceChip(
                                label: Text('Session #${s.id} · ${s.subjectName ?? "Class"}'),
                                selected: isSel,
                                selectedColor: AppTheme.emeraldPrimary,
                                backgroundColor: AppTheme.surfaceDark,
                                labelStyle: TextStyle(
                                  color: isSel ? Colors.white : AppTheme.textSecondary,
                                  fontSize: 12,
                                  fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                ),
                                side: BorderSide(
                                  color: isSel ? AppTheme.emeraldPrimary : const Color(0xFF334155),
                                ),
                                onSelected: (_) => _loadSessionDetails(s),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 16),

                        if (_selectedSession != null) ...[
                          // Selected Session Live Status Card
                          CustomCard(
                            borderColor: _selectedSession!.isActive
                                ? AppTheme.emeraldPrimary.withOpacity(0.5)
                                : const Color(0xFF334155),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        _selectedSession!.subjectName ?? 'Class Session',
                                        style: const TextStyle(
                                          color: AppTheme.textPrimary,
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    if (_selectedSession!.isActive)
                                      StatusBadge.active()
                                    else
                                      StatusBadge.completed(),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '${_selectedSession!.roomNumber ?? "Room"} · Section ${_selectedSession!.sectionName ?? "A"} ${_selectedSession!.studentGroupName != null ? "(Group ${_selectedSession!.studentGroupName})" : ""} · ${_selectedSession!.sessionDate}',
                                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF0F172A),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Column(
                                          children: [
                                            Text(
                                              '${_records.length}',
                                              style: const TextStyle(
                                                color: AppTheme.emeraldPrimary,
                                                fontSize: 20,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const Text('Present', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
                                          ],
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF0F172A),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Column(
                                          children: [
                                            Text(
                                              '${_records.where((r) => r.isSuspicious).length}',
                                              style: const TextStyle(
                                                color: AppTheme.warning,
                                                fontSize: 20,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const Text('Flagged', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                if (_selectedSession!.isActive) ...[
                                  const SizedBox(height: 14),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: CustomButton(
                                          text: 'Show QR',
                                          icon: Icons.qr_code,
                                          isOutlined: true,
                                          onPressed: _generateQr,
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: CustomButton(
                                          text: 'Close Session',
                                          icon: Icons.stop_circle_outlined,
                                          color: AppTheme.danger,
                                          onPressed: _closeSession,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Live Records Stream Header
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Live Check-Ins (${_records.length})',
                                style: const TextStyle(
                                  color: AppTheme.textPrimary,
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              if (_selectedSession!.isActive)
                                const Row(
                                  children: [
                                    SizedBox(
                                      width: 10,
                                      height: 10,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor: AlwaysStoppedAnimation<Color>(AppTheme.emeraldPrimary),
                                      ),
                                    ),
                                    SizedBox(width: 6),
                                    Text('Live Polling', style: TextStyle(color: AppTheme.emeraldLight, fontSize: 11)),
                                  ],
                                ),
                            ],
                          ),
                          const SizedBox(height: 8),

                          if (_records.isEmpty)
                            const CustomCard(
                              child: Center(
                                child: Padding(
                                  padding: EdgeInsets.all(12.0),
                                  child: Text(
                                    'No students have checked in to this session yet.',
                                    style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
                                  ),
                                ),
                              ),
                            )
                          else
                            ...(_records.map((r) => CustomCard(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  child: Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: r.isSuspicious
                                              ? AppTheme.warning.withOpacity(0.15)
                                              : AppTheme.emeraldPrimary.withOpacity(0.15),
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          r.isSuspicious ? Icons.warning_amber_rounded : Icons.person,
                                          size: 16,
                                          color: r.isSuspicious ? AppTheme.warning : AppTheme.emeraldPrimary,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              r.studentName ?? 'Student #${r.studentId}',
                                              style: const TextStyle(
                                                color: AppTheme.textPrimary,
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13,
                                              ),
                                            ),
                                            Text(
                                              r.studentRollNumber ?? 'Roll Number',
                                              style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          StatusBadge.custom(
                                            text: r.status.name.toUpperCase(),
                                            color: r.isSuspicious ? AppTheme.warning : AppTheme.success,
                                          ),
                                          if (r.distanceMeters != null)
                                            Text(
                                              '${r.distanceMeters!.toStringAsFixed(1)}m',
                                              style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
                                            ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ))),
                        ],
                      ],
                    ),
                  ),
                ),
    );
  }
}
