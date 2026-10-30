# 📋 Project Report: GeoAttend AI
### Next-Generation Smart Campus Attendance & Anti-Proxy AI Ecosystem

---

## 1. Executive Summary & Project Overview

**GeoAttend AI** is an enterprise-grade, multi-tenant campus attendance automation and fraud-prevention ecosystem engineered for higher education institutions, universities, and schools. 

Traditional attendance systems (paper registers, manual roll calls, static RFID cards, or static printed QR codes) suffer from severe vulnerabilities:
1. **Proxy Attendance (Buddy Punching):** Friends marking attendance for absent students.
2. **Location Spoofing:** Students sitting in canteens, hostels, or off-campus using mock GPS apps.
3. **Classroom Time Wastage:** 10–15 minutes lost per lecture in roll calls.
4. **Lack of Telemetry & Auditing:** No verifiable proof of presence when disputes or debarment appeals arise.

**GeoAttend AI** solves these challenges by combining **Multi-Sensor Deterministic Telemetry** (GPS Geofencing, Hardware Device Fingerprinting, Rolling Cryptographic QR, and Campus Wi-Fi AP Validation) with **Machine Learning Anomaly Detection** (Isolation Forest multidimensional scoring + DBSCAN spatial density clustering).

---

## 2. System Architecture & Tech Stack

GeoAttend AI is built on a clean **modular three-tier architecture**:

```mermaid
graph TD
    A[Student Mobile App<br>Flutter / Android APK] -->|REST API / HTTPS| C[Backend API Gateway<br>FastAPI + Python 3.12]
    B[Web Dashboard<br>Next.js 15 + TypeScript] -->|REST API / HTTPS| C
    
    subgraph Backend Core [Render Cloud / Localhost]
        C --> D[Authentication & RBAC<br>JWT + Bcrypt]
        C --> E[Attendance Engine<br>Geofence + Device Verification]
        C --> F[Hybrid AI Sentinel<br>Isolation Forest + DBSCAN]
        C --> G[Academic ERP<br>Timetable + Enrollments]
        
        D --> H[(Database Engine<br>MySQL / PostgreSQL / SQLite)]
        E --> H
        F --> H
        G --> H
    end
    
    F --> I[Suspicious Activity Desk<br>Real-Time Fraud Triage]
```

### Technology Stack Summary

| Layer | Technologies Used | Key Responsibilities |
|---|---|---|
| **Mobile Client** | **Flutter 3.44**, Dart, Geolocator, Device Info | 1-Tap Direct GPS Check-In (No QR required), hardware fingerprint capture, student schedule, offline caching |
| **Web Frontend** | **Next.js 15 (App Router)**, React 19, TypeScript, TailwindCSS, Lucide Icons, Framer Motion | Multi-role dashboard (SuperAdmin, Faculty HOD, Student), Live Attendance Monitor, Suspicious Activity Desk |
| **Backend API** | **FastAPI**, Python 3.12, Uvicorn, Pydantic v2, Alembic | RESTful endpoints, role-based access control (RBAC), multi-tenant session manager, audit logging |
| **Database** | **MySQL 8.4** (Local) / **PostgreSQL & SQLite** (Cloud) | Relational schema with foreign key integrity, cascade guards, academic hierarchy, attendance records |
| **AI / Machine Learning** | **Scikit-learn**, NumPy, SciPy, Joblib | Isolation Forest multidimensional anomaly detection, DBSCAN spatial density clustering, feature extraction |
| **Deployment & CI/CD** | **GitHub**, **Render Cloud**, **Vercel**, Gradle | Automatic Git continuous deployment, 24/7 backend cloud hosting, optimized Android APK build |

---

## 3. Database Schema & Entity Relationship (ER) Diagram

GeoAttend AI uses an enterprise relational database schema with **22 tables** partitioned into 4 core functional domains. Foreign keys, composite unique constraints, and cascade delete rules ensure total data integrity.

### Visual ER Diagram (Mermaid Architecture)

```mermaid
erDiagram
    %% IAM & User Profiles
    USERS ||--o| STUDENT_PROFILES : "1:1 profile"
    USERS ||--o| FACULTY_PROFILES : "1:1 profile"
    USERS ||--o{ AUDIT_LOGS : "performs"
    USERS ||--o{ NOTIFICATIONS : "receives"
    
    %% Institutional Hierarchy
    COLLEGES ||--o{ CAMPUSES : "operates"
    COLLEGES ||--o{ COURSES : "offers"
    COLLEGES ||--o{ USERS : "employs/enrolls"
    CAMPUSES ||--o{ DEPARTMENTS : "houses"
    CAMPUSES ||--o{ ROOMS : "contains"
    
    %% Academic Structure
    DEPARTMENTS ||--o{ BRANCHES : "administers"
    DEPARTMENTS ||--o{ FACULTY_PROFILES : "employs"
    DEPARTMENTS ||--o{ SUBJECTS : "teaches"
    COURSES ||--o{ BRANCHES : "branches_into"
    BRANCHES ||--o{ BATCHES : "admits"
    BATCHES ||--o{ SECTIONS : "divides_into"
    SECTIONS ||--o{ STUDENT_GROUPS : "splits_into"
    
    %% Enrollments
    STUDENT_PROFILES ||--o{ ACADEMIC_ENROLLMENTS : "enrolled_in"
    COURSES ||--o{ ACADEMIC_ENROLLMENTS : "categorizes"
    SECTIONS ||--o{ ACADEMIC_ENROLLMENTS : "groups"
    
    %% Curriculum & Scheduling
    SUBJECTS ||--o{ SUBJECT_OFFERINGS : "offered_as"
    SECTIONS ||--o{ SUBJECT_OFFERINGS : "assigned_to"
    SUBJECT_OFFERINGS ||--o{ FACULTY_ASSIGNMENTS : "teaches"
    FACULTY_PROFILES ||--o{ FACULTY_ASSIGNMENTS : "assigned_to"
    SUBJECT_OFFERINGS ||--o{ TIMETABLE_ENTRIES : "scheduled_in"
    FACULTY_ASSIGNMENTS ||--o{ TIMETABLE_ENTRIES : "instructed_by"
    
    %% Attendance Sessions & Verification
    FACULTY_PROFILES ||--o{ ATTENDANCE_SESSIONS : "conducts"
    SECTIONS ||--o{ ATTENDANCE_SESSIONS : "attends"
    TIMETABLE_ENTRIES ||--o{ ATTENDANCE_SESSIONS : "instantiates"
    ATTENDANCE_SESSIONS ||--o{ QR_SESSIONS : "rotates_token"
    
    %% Telemetry & AI Fraud Detection
    ATTENDANCE_SESSIONS ||--o{ ATTENDANCE_RECORDS : "logs"
    STUDENT_PROFILES ||--o{ ATTENDANCE_RECORDS : "submits"
    ATTENDANCE_RECORDS ||--o| SUSPICIOUS_ACTIVITIES : "triggers_if_anomaly"
    STUDENT_PROFILES ||--o{ ATTENDANCE_APPLICATIONS : "applies_for_leave"
    SUBJECT_OFFERINGS ||--o{ ATTENDANCE_APPLICATIONS : "applies_to"

    USERS {
        int id PK
        int college_id FK
        string email UK
        string full_name
        string role "admin | faculty | student"
        boolean is_active
    }

    STUDENT_PROFILES {
        int id PK
        int user_id FK "1:1 UK"
        string roll_number UK
        string enrollment_number
        string device_id "Hardware UUID"
    }

    FACULTY_PROFILES {
        int id PK
        int user_id FK "1:1 UK"
        int department_id FK
        string employee_id UK
        string designation
    }

    COLLEGES {
        int id PK
        string name
        string code UK
        string city
        string country
    }

    CAMPUSES {
        int id PK
        int college_id FK
        string name
        float latitude
        float longitude
        int geofence_radius_meters
    }

    DEPARTMENTS {
        int id PK
        int campus_id FK
        string name
        string code
    }

    COURSES {
        int id PK
        string name
        string code UK
        int duration_years
        int total_semesters
    }

    BRANCHES {
        int id PK
        int department_id FK
        int course_id FK
        string name
        string code
    }

    BATCHES {
        int id PK
        int branch_id FK
        string name
        int start_year
        int end_year
    }

    SECTIONS {
        int id PK
        int batch_id FK
        string name
        int capacity
    }

    STUDENT_GROUPS {
        int id PK
        int section_id FK
        string name
    }

    ACADEMIC_ENROLLMENTS {
        int id PK
        int student_id FK
        int course_id FK
        int branch_id FK
        int batch_id FK
        int section_id FK
        int semester
        string academic_year
        string status "active | completed"
    }

    SUBJECTS {
        int id PK
        int department_id FK
        string name
        string code UK
        int credits
    }

    SUBJECT_OFFERINGS {
        int id PK
        int subject_id FK
        int course_id FK
        int section_id FK
        int semester
        string class_type "theory | lab"
    }

    FACULTY_ASSIGNMENTS {
        int id PK
        int faculty_id FK
        int subject_offering_id FK
        boolean is_primary
    }

    TIMETABLE_ENTRIES {
        int id PK
        int subject_offering_id FK
        int faculty_assignment_id FK
        int section_id FK
        string day_of_week
        time start_time
        time end_time
        string room_number
    }

    ROOMS {
        int id PK
        int campus_id FK
        string name
        float latitude
        float longitude
        int geofence_radius_meters
    }

    ATTENDANCE_SESSIONS {
        int id PK
        int faculty_id FK
        int section_id FK
        int timetable_entry_id FK
        string status "active | completed"
        datetime started_at
        datetime ended_at
        float geofence_latitude
        float geofence_longitude
        int geofence_radius_meters
    }

    QR_SESSIONS {
        int id PK
        int attendance_session_id FK
        string token UK
        datetime expires_at
    }

    ATTENDANCE_RECORDS {
        int id PK
        int session_id FK
        int student_id FK
        string status "present | absent | late"
        datetime marked_at
        float latitude
        float longitude
        float distance_meters
        string device_id
        boolean is_suspicious
        string verification_json
    }

    SUSPICIOUS_ACTIVITIES {
        int id PK
        int attendance_record_id FK
        int student_id FK
        int session_id FK
        float risk_score "0 - 100"
        string detection_method "gps | device | multi_signal"
        string reason
        string review_status "pending | confirmed | dismissed"
        int reviewed_by FK
    }

    ATTENDANCE_APPLICATIONS {
        int id PK
        int student_id FK
        int subject_offering_id FK
        string reason
        string status "pending | approved | rejected"
        int faculty_reviewer_id FK
    }
```

### High-Resolution Rendered Diagram Image
A rendered graphical screenshot is provided in the root directory:
* File link: [`screenshot_5_er_diagram.png`](file:///Users/apple/Projects/geoattend-ai/screenshot_5_er_diagram.png) *(223 KB high-resolution database schema preview)*
* Standalone interactive viewer: [`erd.html`](file:///Users/apple/Projects/geoattend-ai/erd.html)

---

## 4. End-to-End Workflow (How It Works)

### Step 1: Academic Structure & Scheduling (SuperAdmin)
* The institution administrator defines:
  * **Colleges & Campuses:** Campus GPS coordinates (Latitude, Longitude) and default geofence radius.
  * **Academic Hierarchy:** Departments $\rightarrow$ Courses $\rightarrow$ Branches $\rightarrow$ Batches $\rightarrow$ Sections $\rightarrow$ Student Groups (for lab batches).
  * **Curriculum & Timetable:** Subjects, Theory/Lab offerings, Faculty assignments, classroom allocations, and weekly schedule slots.

### Step 2: Lecture Initiation (Faculty / Teacher)
* The faculty logs into the Web Dashboard.
* Navigates to **"Attendance Sessions"** and clicks **"Start Session"**.
* Selects the assigned subject, section, room number, and geofence radius (e.g., 50m or 100m).
* The session becomes **ACTIVE** in real-time.

### Step 3: Attendance Check-In (Student)
* The student opens the **GeoAttend AI Mobile App** (or Web Student Dashboard).
* The active ongoing lecture appears prominently on their screen.
* The student taps **"Check In"** $\rightarrow$ **"Tap to Mark Attendance"**.
* The mobile app automatically:
  1. Requests GPS coordinates via device hardware.
  2. Extracts the unique hardware **Device ID**.
  3. Sends a signed check-in payload to the backend.

### Step 4: Verification & Multi-Sensor Defense
The backend processes the check-in through sequential defense layers:

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student (Mobile)
    participant API as FastAPI Backend
    participant Sensor as Verification Service
    participant AI as AI Anomaly Sentinel
    participant DB as Database
    actor Faculty as Teacher Dashboard

    Student->>API: POST /attendance/check-in (lat, lon, device_id)
    API->>Sensor: Verify GPS Distance (Haversine)
    alt Outside Geofence (> 100m)
        Sensor-->>API: Rejected (Outside classroom)
        API-->>Student: 400 Bad Request: "Outside geofence"
    else Inside Geofence (<= 100m)
        Sensor-->>API: GPS Passed
        API->>Sensor: Verify Device ID
        alt Duplicate Device used by another student
            Sensor-->>AI: Flag DUPLICATE_DEVICE (+45 risk)
        end
        API->>AI: Evaluate 10-Feature Vector
        AI-->>API: Hybrid Risk Score (0 - 100)
        API->>DB: Save AttendanceRecord (PRESENT)
        alt Risk Score >= 25.0
            API->>DB: Create SuspiciousActivity (Flagged)
            API->>Faculty: Push Alert to Suspicious Activity Desk
        end
        API-->>Student: 201 Created: "Attendance Marked Present"
    end
```

---

## 5. AI & Machine Learning Fraud Detection Engine

GeoAttend AI incorporates a **Hybrid Anomaly Detection Engine** (`HybridAnomalyEngine`):

### 1. Deterministic Rule Scoring
* **Duplicate Device Binding (+45.0 Score):** Prevents friend-to-friend proxy check-in from the same phone.
* **Geofence Boundary Proximity (+30.0 Score):** Detects borderline check-ins (>80% of radius) or mock GPS apps.
* **Rapid Check-In Timing (+25.0 Score):** Flags automated bot scripts checking in within $<10$ seconds of session opening.
* **Data Quality Guards:** Detects clock drift, negative intervals, or missing satellite timestamps.

### 2. Machine Learning Anomaly Detection
* **10-Dimensional Feature Vector:**
  $$\vec{x} = [\text{distance\_meters}, \text{distance\_ratio}, \text{elapsed\_minutes}, \text{hour\_of\_day}, \text{day\_of\_week}, \text{device\_reuse\_count}, \text{late\_ratio}, \text{suspicious\_ratio}, \text{has\_wifi}, \text{has\_gps}]$$
* **Isolation Forest:** An unsupervised tree ensemble model trained to isolate anomalous multidimensional behavioral outliers without requiring pre-labeled fraud datasets.
* **DBSCAN Spatial Density Clustering:** Evaluates all check-in coordinates inside a lecture. Legitimate students form a dense spatial cluster in the classroom. Any student spoofing coordinates that fall outside this physical cluster is classified as **spatial noise outlier**.

### 3. Ethical AI Principle (Advisory Sentinel)
* The AI **never arbitrarily marks a student absent** solely on an automated model prediction.
* It flags suspicious records with an explanatory breakdown and alerts the teacher on the **Suspicious Activity Desk**.
* The teacher can inspect the telemetry evidence and choose:
  * **"Confirm Fraud"** — Converts the record to official Absence / Fraud.
  * **"Dismiss"** — Clears genuine false positives (e.g., poor satellite signal inside thick concrete walls).

---

## 6. User Roles & Modules

| Role | Key Capabilities |
|---|---|
| **SuperAdmin** | Full institution control, campus configuration, department/course CRUD, faculty & student directory, system settings, timetable scheduler, global analytics |
| **Faculty (Teacher / HOD)** | Start & close live attendance sessions, live student check-in monitor, review suspicious proxy alerts, attendance application approvals (medical leaves/OD), debarment reports |
| **Student** | 1-Tap GPS attendance check-in, real-time schedule, personal attendance percentage tracking, medical leave & on-duty application submission, notice board |

---

## 7. Live Deployment & Deliverables

The project is fully deployed, operational, and accessible:

* **GitHub Repository:** [https://github.com/sharmaprarthana829-source/GeoAttend-AI](https://github.com/sharmaprarthana829-source/GeoAttend-AI)
* **Backend Cloud API (Render):** [https://geoattend-api-0602.onrender.com](https://geoattend-api-0602.onrender.com)
  * Interactive Swagger Documentation: [`/docs`](https://geoattend-api-0602.onrender.com/docs)
  * System Health Check: [`/health`](https://geoattend-api-0602.onrender.com/health)
* **Web Frontend (Vercel):** [https://geo-attend-ai.vercel.app](https://geo-attend-ai.vercel.app)
* **Mobile Client APK:** Android Release Build ready for sideloading and student distribution:
  * File location: [`GeoAttend-AI.apk`](file:///Users/apple/Projects/geoattend-ai/GeoAttend-AI.apk) *(50MB)*
  * Also available directly in the GitHub repository.

---

## 8. Demo & Presentation Guidelines (For Viva / Project Showcase)

When presenting this project to professors, examiners, or evaluators:

1. **Highlight the Core Innovation:** Emphasize that this is not just a standard database app; it is a **cyber-physical security system** combining mobile sensors with machine learning anomaly detection.
2. **Showcase the 1-Tap Attendance:** Show how students don't need clunky QR scanners — one tap on their screen verifies GPS and device hardware in $<1$ second.
3. **Demonstrate Proxy Prevention:** 
   * Show what happens when a student checks in from outside the college geofence (instant rejection).
   * Show what happens when two students use the same phone (instant `DUPLICATE_DEVICE` alert on the Suspicious Activity Desk).
4. **Showcase the AI Desk:** Walk the evaluators through `/dashboard/suspicious-activity` and click **"View Evidence"** to display the raw telemetry breakdown, Isolation Forest scores, and human-in-the-loop governance.
