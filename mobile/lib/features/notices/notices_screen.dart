import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/notice_models.dart';
import '../../services/notice_service.dart';
import '../../widgets/custom_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/status_badge.dart';
import 'notifications_screen.dart';

class NoticesScreen extends StatefulWidget {
  const NoticesScreen({super.key});

  @override
  State<NoticesScreen> createState() => _NoticesScreenState();
}

class _NoticesScreenState extends State<NoticesScreen> {
  bool _isLoading = true;
  List<Notice> _notices = [];

  @override
  void initState() {
    super.initState();
    _loadNotices();
  }

  Future<void> _loadNotices() async {
    setState(() => _isLoading = true);
    try {
      final service = Provider.of<NoticeService>(context, listen: false);
      final list = await service.getMyNotices();
      if (mounted) setState(() => _notices = list);
    } catch (_) {
      // Ignore
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final noticeService = Provider.of<NoticeService>(context);

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Campus Notice Board'),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                ),
              ),
              if (noticeService.unreadCount > 0)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppTheme.danger,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '${noticeService.unreadCount}',
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadNotices,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading campus notices...')
          : _notices.isEmpty
              ? const EmptyStateView(
                  icon: Icons.campaign_outlined,
                  title: 'No Active Notices',
                  description: 'Important announcements and campus notices will be posted here.',
                )
              : RefreshIndicator(
                  onRefresh: _loadNotices,
                  color: AppTheme.emeraldPrimary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _notices.length,
                    itemBuilder: (context, index) {
                      final item = _notices[index];
                      return CustomCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    item.title,
                                    style: const TextStyle(
                                      color: AppTheme.textPrimary,
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                StatusBadge.custom(
                                  text: item.audienceType.name.toUpperCase(),
                                  color: AppTheme.emeraldLight,
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.publishedAt,
                              style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              item.content,
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.4),
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
