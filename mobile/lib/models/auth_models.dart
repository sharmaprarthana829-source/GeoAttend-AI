enum UserRole {
  admin,
  faculty,
  student;

  static UserRole fromString(String value) {
    switch (value.toLowerCase()) {
      case 'admin':
        return UserRole.admin;
      case 'faculty':
        return UserRole.faculty;
      case 'student':
        return UserRole.student;
      default:
        return UserRole.student;
    }
  }

  String toJson() => name;
}

enum ResponsibilityType {
  professor,
  hod,
  dean,
  principal,
  coordinator;

  static ResponsibilityType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'professor':
        return ResponsibilityType.professor;
      case 'hod':
        return ResponsibilityType.hod;
      case 'dean':
        return ResponsibilityType.dean;
      case 'principal':
        return ResponsibilityType.principal;
      case 'coordinator':
        return ResponsibilityType.coordinator;
      default:
        return ResponsibilityType.professor;
    }
  }

  String toJson() => name;
}

class FacultyResponsibility {
  final int id;
  final int facultyId;
  final ResponsibilityType responsibilityType;
  final String scopeType;
  final int? departmentId;
  final bool isActive;

  FacultyResponsibility({
    required this.id,
    required this.facultyId,
    required this.responsibilityType,
    required this.scopeType,
    this.departmentId,
    required this.isActive,
  });

  factory FacultyResponsibility.fromJson(Map<String, dynamic> json) {
    return FacultyResponsibility(
      id: json['id'] as int,
      facultyId: json['faculty_id'] as int,
      responsibilityType: ResponsibilityType.fromString(json['responsibility_type'] as String),
      scopeType: json['scope_type'] as String? ?? 'department',
      departmentId: json['department_id'] as int?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'faculty_id': facultyId,
        'responsibility_type': responsibilityType.toJson(),
        'scope_type': scopeType,
        'department_id': departmentId,
        'is_active': isActive,
      };
}

class StudentProfile {
  final int id;
  final int userId;
  final String rollNumber;
  final String? deviceId;

  StudentProfile({
    required this.id,
    required this.userId,
    required this.rollNumber,
    this.deviceId,
  });

  factory StudentProfile.fromJson(Map<String, dynamic> json) {
    return StudentProfile(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      rollNumber: json['roll_number'] as String? ?? '',
      deviceId: json['device_id'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'roll_number': rollNumber,
        'device_id': deviceId,
      };
}

class FacultyProfile {
  final int id;
  final int userId;
  final String employeeId;
  final String? designation;
  final int? departmentId;
  final List<FacultyResponsibility> responsibilities;

  FacultyProfile({
    required this.id,
    required this.userId,
    required this.employeeId,
    this.designation,
    this.departmentId,
    this.responsibilities = const [],
  });

  bool get isHod => responsibilities.any((r) => r.responsibilityType == ResponsibilityType.hod && r.isActive);
  bool get isDean => responsibilities.any((r) => r.responsibilityType == ResponsibilityType.dean && r.isActive);

  factory FacultyProfile.fromJson(Map<String, dynamic> json) {
    return FacultyProfile(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      employeeId: json['employee_id'] as String? ?? '',
      designation: json['designation'] as String?,
      departmentId: json['department_id'] as int?,
      responsibilities: (json['responsibilities'] as List<dynamic>?)
              ?.map((r) => FacultyResponsibility.fromJson(r as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'employee_id': employeeId,
        'designation': designation,
        'department_id': departmentId,
        'responsibilities': responsibilities.map((r) => r.toJson()).toList(),
      };
}

class User {
  final int id;
  final String email;
  final String fullName;
  final UserRole role;
  final bool isActive;
  final StudentProfile? studentProfile;
  final FacultyProfile? facultyProfile;

  User({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    required this.isActive,
    this.studentProfile,
    this.facultyProfile,
  });

  bool get isStudent => role == UserRole.student;
  bool get isFaculty => role == UserRole.faculty;
  bool get isAdmin => role == UserRole.admin;
  bool get isHod => isFaculty && (facultyProfile?.isHod ?? false);

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      email: json['email'] as String,
      fullName: json['full_name'] as String? ?? '',
      role: UserRole.fromString(json['role'] as String),
      isActive: json['is_active'] as bool? ?? true,
      studentProfile: json['student_profile'] != null
          ? StudentProfile.fromJson(json['student_profile'] as Map<String, dynamic>)
          : null,
      facultyProfile: json['faculty_profile'] != null
          ? FacultyProfile.fromJson(json['faculty_profile'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'full_name': fullName,
        'role': role.toJson(),
        'is_active': isActive,
        'student_profile': studentProfile?.toJson(),
        'faculty_profile': facultyProfile?.toJson(),
      };
}

class LoginResponse {
  final String accessToken;
  final String refreshToken;
  final String tokenType;
  final UserRole role;
  final List<String> responsibilities;
  final User? user;

  LoginResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.tokenType,
    required this.role,
    this.responsibilities = const [],
    this.user,
  });

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
      tokenType: json['token_type'] as String? ?? 'bearer',
      role: json['role'] != null
          ? UserRole.fromString(json['role'] as String)
          : (json['user'] != null && json['user']['role'] != null
              ? UserRole.fromString(json['user']['role'] as String)
              : UserRole.student),
      responsibilities: (json['responsibilities'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      user: json['user'] != null
          ? User.fromJson(json['user'] as Map<String, dynamic>)
          : null,
    );
  }
}

