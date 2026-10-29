import 'package:flutter/material.dart' hide Notification;
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/notice_models.dart';
import '../../services/notice_service.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _isLoading = true;
  List<Notification> _notifications = [];

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() => _isLoading = true);
    try {
      final service = Provider.of<NoticeService>(context, listen: false);
      final list = await service.getMyNotifications();
      if (mounted) setState(() => _notifications = list);
    } catch (_) {
      // Ignore
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _markRead(Notification n) async {
    if (n.isRead) return;
    final service = Provider.of<NoticeService>(context, listen: false);
    await service.markNotificationRead(n.id);
    await _loadNotifications();
  }

  Future<void> _markAllRead() async {
    final service = Provider.of<NoticeService>(context, listen: false);
    await service.markAllNotificationsRead();
    await _loadNotifications();
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => !n.isRead).length;

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read', style: TextStyle(color: AppTheme.emeraldPrimary, fontSize: 13)),
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadNotifications,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading notifications...')
          : _notifications.isEmpty
              ? const EmptyStateView(
                  icon: Icons.notifications_none,
                  title: 'No Notifications',
                  description: 'You\'re all caught up! Important updates will appear here.',
                )
              : RefreshIndicator(
                  onRefresh: _loadNotifications,
                  color: AppTheme.emeraldPrimary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _notifications.length,
                    itemBuilder: (context, index) {
                      final n = _notifications[index];
                      return CustomCard(
                        onTap: () => _markRead(n),
                        borderColor: n.isRead ? const Color(0xFF334155) : AppTheme.emeraldPrimary.withOpacity(0.4),
                        backgroundColor: n.isRead ? AppTheme.surfaceCard : AppTheme.emeraldPrimary.withOpacity(0.06),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: n.isRead ? const Color(0xFF0F172A) : AppTheme.emeraldPrimary.withOpacity(0.15),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.notifications,
                                size: 16,
                                color: n.isRead ? AppTheme.textMuted : AppTheme.emeraldPrimary,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          n.title,
                                          style: TextStyle(
                                            color: AppTheme.textPrimary,
                                            fontWeight: n.isRead ? FontWeight.w500 : FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        ),
                                      ),
                                      if (!n.isRead)
                                        Container(
                                          width: 8,
                                          height: 8,
                                          decoration: const BoxDecoration(
                                            color: AppTheme.emeraldPrimary,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    n.message,
                                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    n.createdAt,
                                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
                                  ),
                                ],
                              ),
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
