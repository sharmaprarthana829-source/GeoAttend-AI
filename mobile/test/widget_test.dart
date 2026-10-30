import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geoattend_mobile/features/auth/login_screen.dart';
import 'package:geoattend_mobile/main.dart';
import 'package:geoattend_mobile/widgets/status_badge.dart';
import 'package:provider/provider.dart';
import 'package:geoattend_mobile/services/auth_service.dart';

void main() {
  testWidgets('GeoAttendApp root smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const GeoAttendApp());
    expect(find.text('GeoAttend AI'), findsWidgets);
  });

  testWidgets('LoginScreen renders credentials fields and quick test chips', (WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AuthService(),
        child: const MaterialApp(
          home: LoginScreen(),
        ),
      ),
    );

    expect(find.text('Sign In'), findsWidgets);
    expect(find.text('Email Address'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Student'), findsOneWidget);
    expect(find.text('Faculty'), findsOneWidget);
    expect(find.text('Admin'), findsOneWidget);
  });

  testWidgets('StatusBadge semantic rendering test', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              StatusBadge.present(),
              StatusBadge.late(),
              StatusBadge.suspicious(),
              StatusBadge.active(),
            ],
          ),
        ),
      ),
    );

    expect(find.text('PRESENT'), findsOneWidget);
    expect(find.text('LATE'), findsOneWidget);
    expect(find.text('SUSPICIOUS'), findsOneWidget);
    expect(find.text('ACTIVE NOW'), findsOneWidget);
  });
}
