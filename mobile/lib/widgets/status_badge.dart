import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  final String text;
  final Color backgroundColor;
  final Color textColor;
  final Color? borderColor;
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.text,
    required this.backgroundColor,
    required this.textColor,
    this.borderColor,
    this.icon,
  });

  factory StatusBadge.present() {
    return const StatusBadge(
      text: 'PRESENT',
      backgroundColor: Color(0xFF064E3B),
      textColor: Color(0xFF34D399),
      borderColor: Color(0xFF059669),
      icon: Icons.check_circle_outline,
    );
  }

  factory StatusBadge.late() {
    return const StatusBadge(
      text: 'LATE',
      backgroundColor: Color(0xFF451A03),
      textColor: Color(0xFFFBBF24),
      borderColor: Color(0xFFD97706),
      icon: Icons.access_time,
    );
  }

  factory StatusBadge.absent() {
    return const StatusBadge(
      text: 'ABSENT',
      backgroundColor: Color(0xFF4C0519),
      textColor: Color(0xFFFB7185),
      borderColor: Color(0xFFE11D48),
      icon: Icons.cancel_outlined,
    );
  }

  factory StatusBadge.suspicious() {
    return const StatusBadge(
      text: 'SUSPICIOUS',
      backgroundColor: Color(0xFF4C0519),
      textColor: Color(0xFFF87171),
      borderColor: Color(0xFFDC2626),
      icon: Icons.warning_amber_rounded,
    );
  }

  factory StatusBadge.active() {
    return const StatusBadge(
      text: 'ACTIVE NOW',
      backgroundColor: Color(0xFF064E3B),
      textColor: Color(0xFF34D399),
      borderColor: Color(0xFF059669),
      icon: Icons.fiber_manual_record,
    );
  }

  factory StatusBadge.completed() {
    return const StatusBadge(
      text: 'COMPLETED',
      backgroundColor: Color(0xFF1E293B),
      textColor: Color(0xFF94A3B8),
      borderColor: Color(0xFF475569),
    );
  }

  factory StatusBadge.pending() {
    return const StatusBadge(
      text: 'PENDING',
      backgroundColor: Color(0xFF451A03),
      textColor: Color(0xFFFBBF24),
      borderColor: Color(0xFFD97706),
      icon: Icons.hourglass_empty,
    );
  }

  factory StatusBadge.approved() {
    return const StatusBadge(
      text: 'APPROVED',
      backgroundColor: Color(0xFF064E3B),
      textColor: Color(0xFF34D399),
      borderColor: Color(0xFF059669),
      icon: Icons.verified_outlined,
    );
  }

  factory StatusBadge.rejected() {
    return const StatusBadge(
      text: 'REJECTED',
      backgroundColor: Color(0xFF4C0519),
      textColor: Color(0xFFFB7185),
      borderColor: Color(0xFFE11D48),
      icon: Icons.block,
    );
  }

  factory StatusBadge.custom({
    required String text,
    required Color color,
  }) {
    return StatusBadge(
      text: text.toUpperCase(),
      backgroundColor: color.withOpacity(0.15),
      textColor: color,
      borderColor: color.withOpacity(0.3),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(20),
        border: borderColor != null ? Border.all(color: borderColor!, width: 1) : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              color: textColor,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
