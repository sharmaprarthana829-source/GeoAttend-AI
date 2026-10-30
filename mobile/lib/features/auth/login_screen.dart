import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/theme.dart';
import '../../models/auth_models.dart';
import '../../services/auth_service.dart';
import '../../widgets/custom_button.dart';
import '../admin/admin_dashboard_screen.dart';
import '../faculty/faculty_dashboard_screen.dart';
import '../student/student_dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'student@geoattend.ai');
  final _passwordController = TextEditingController(text: 'Student@12345');
  bool _obscurePassword = true;
  String? _errorMessage;
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _fillCredentials(String email, String password) {
    setState(() {
      _emailController.text = email;
      _passwordController.text = password;
      _errorMessage = null;
    });
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final user = await authService.login(
        _emailController.text,
        _passwordController.text,
      );

      if (!mounted) return;

      Widget destination;
      switch (user.role) {
        case UserRole.student:
          destination = const StudentDashboardScreen();
          break;
        case UserRole.faculty:
          destination = const FacultyDashboardScreen();
          break;
        case UserRole.admin:
          destination = const AdminDashboardScreen();
          break;
      }

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => destination),
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo & App Name
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.emeraldPrimary.withOpacity(0.12),
                        shape: BoxShape.circle,
                        border: Border.all(color: AppTheme.emeraldPrimary.withOpacity(0.3), width: 2),
                      ),
                      child: const Icon(
                        Icons.location_on,
                        size: 42,
                        color: AppTheme.emeraldPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'GeoAttend AI',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Sign in to your campus account',
                    style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 13,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),

                  // Error Message
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.danger.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppTheme.danger.withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, size: 18, color: AppTheme.danger),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(color: AppTheme.danger, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Email Field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                    decoration: const InputDecoration(
                      labelText: 'Email Address',
                      prefixIcon: Icon(Icons.email_outlined, size: 20, color: AppTheme.textMuted),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password Field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline, size: 20, color: AppTheme.textMuted),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                          size: 20,
                          color: AppTheme.textMuted,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your password';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  // Login Button
                  CustomButton(
                    text: 'Sign In',
                    onPressed: _handleLogin,
                    isLoading: _isLoading,
                  ),
                  const SizedBox(height: 24),

                  // Quick Demo / Test Selector
                  const Divider(color: Color(0xFF334155)),
                  const SizedBox(height: 12),
                  const Text(
                    'Quick Test Accounts:',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.w600),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ActionChip(
                        label: const Text('Student', style: TextStyle(fontSize: 11)),
                        backgroundColor: AppTheme.surfaceDark,
                        side: const BorderSide(color: Color(0xFF334155)),
                        onPressed: () => _fillCredentials('student@geoattend.ai', 'Student@12345'),
                      ),
                      ActionChip(
                        label: const Text('Faculty', style: TextStyle(fontSize: 11)),
                        backgroundColor: AppTheme.surfaceDark,
                        side: const BorderSide(color: Color(0xFF334155)),
                        onPressed: () => _fillCredentials('faculty@geoattend.ai', 'Faculty@12345'),
                      ),
                      ActionChip(
                        label: const Text('Faculty 2', style: TextStyle(fontSize: 11)),
                        backgroundColor: AppTheme.surfaceDark,
                        side: const BorderSide(color: Color(0xFF334155)),
                        onPressed: () => _fillCredentials('faculty2@geoattend.ai', 'Faculty@12345'),
                      ),
                      ActionChip(
                        label: const Text('Admin', style: TextStyle(fontSize: 11)),
                        backgroundColor: AppTheme.surfaceDark,
                        side: const BorderSide(color: Color(0xFF334155)),
                        onPressed: () => _fillCredentials('admin@geoattend.ai', 'Admin@12345'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
