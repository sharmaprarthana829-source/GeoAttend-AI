import os
from PIL import Image, ImageDraw, ImageFont

def generate_er_image():
    width = 2200
    height = 1200
    img = Image.new("RGB", (width, height), color="#0F172A")
    draw = ImageDraw.Draw(img)

    # Try to load system fonts, fallback to default
    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/SFProText-Bold.otf", 44)
        subtitle_font = ImageFont.truetype("/System/Library/Fonts/SFProText-Regular.otf", 24)
        header_font = ImageFont.truetype("/System/Library/Fonts/SFProText-Bold.otf", 26)
        text_font = ImageFont.truetype("/System/Library/Fonts/SFProText-Regular.otf", 20)
        badge_font = ImageFont.truetype("/System/Library/Fonts/SFProText-Bold.otf", 16)
    except Exception:
        try:
            title_font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 44)
            subtitle_font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 24)
            header_font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 26)
            text_font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 20)
            badge_font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 16)
        except Exception:
            title_font = subtitle_font = header_font = text_font = badge_font = ImageFont.load_default()

    # Draw Title Header
    draw.text((width // 2, 50), "GeoAttend AI — Database Schema & ER Diagram", fill="#38BDF8", font=title_font, anchor="mm")
    draw.text((width // 2, 95), "Screenshot 5: Core Entity Relationships & Anomaly Detection Workflow", fill="#94A3B8", font=subtitle_font, anchor="mm")

    # Define 6 Core Compact Entities (2 rows x 3 cols + 1 AI anomaly)
    # Layout configuration
    card_w = 420
    card_h = 320
    
    # Coordinates for cards
    cards = {
        "USERS": {
            "title": "users",
            "rect": (100, 160, 100 + card_w, 160 + card_h),
            "accent": "#38BDF8",
            "fields": [
                ("PK", "id", "INTEGER (Auto Increment)"),
                ("UK", "email", "VARCHAR(255)"),
                ("  ", "full_name", "VARCHAR(150)"),
                ("  ", "hashed_password", "VARCHAR(255)"),
                ("  ", "role", "ENUM ('admin','faculty','student')"),
                ("  ", "is_active", "BOOLEAN"),
                ("  ", "created_at", "DATETIME"),
            ]
        },
        "STUDENTS": {
            "title": "students",
            "rect": (600, 160, 600 + card_w, 160 + card_h),
            "accent": "#06B6D4",
            "fields": [
                ("PK", "id", "INTEGER (Auto Increment)"),
                ("FK", "user_id", "INTEGER (users.id)"),
                ("UK", "enrollment_number", "VARCHAR(50)"),
                ("  ", "roll_number", "VARCHAR(50)"),
                ("  ", "current_semester", "INTEGER"),
                ("  ", "preferred_device_id", "VARCHAR(255)"),
                ("  ", "face_encoding", "TEXT"),
            ]
        },
        "FACULTY": {
            "title": "faculty",
            "rect": (100, 600, 100 + card_w, 600 + card_h),
            "accent": "#818CF8",
            "fields": [
                ("PK", "id", "INTEGER (Auto Increment)"),
                ("FK", "user_id", "INTEGER (users.id)"),
                ("UK", "employee_code", "VARCHAR(50)"),
                ("  ", "designation", "VARCHAR(100)"),
                ("  ", "phone_number", "VARCHAR(20)"),
                ("  ", "office_location", "VARCHAR(100)"),
            ]
        },
        "TIMETABLE": {
            "title": "timetable_entries",
            "rect": (600, 600, 600 + card_w, 600 + card_h),
            "accent": "#A78BFA",
            "fields": [
                ("PK", "id", "INTEGER (Auto Increment)"),
                ("FK", "subject_offering_id", "INTEGER (offering.id)"),
                ("FK", "room_id", "INTEGER (rooms.id)"),
                ("  ", "day_of_week", "ENUM ('monday'...'sunday')"),
                ("  ", "start_time", "TIME"),
                ("  ", "end_time", "TIME"),
                ("  ", "is_active", "BOOLEAN"),
            ]
        },
        "SESSIONS": {
            "title": "attendance_sessions",
            "rect": (1150, 380, 1150 + card_w, 380 + card_h + 30),
            "accent": "#34D399",
            "fields": [
                ("PK", "id", "INTEGER (Auto Increment)"),
                ("FK", "timetable_entry_id", "INTEGER (timetable.id)"),
                ("FK", "faculty_id", "INTEGER (faculty.id)"),
                ("  ", "session_date", "DATE"),
                ("  ", "geofence_lat / lng", "FLOAT"),
                ("  ", "geofence_radius", "FLOAT (meters)"),
                ("  ", "status", "ENUM ('active','completed')"),
                ("  ", "allowed_wifi_bssid", "VARCHAR(100)"),
            ]
        },
        "RECORDS": {
            "title": "attendance_records",
            "rect": (1680, 160, 1680 + card_w, 160 + card_h + 20),
            "accent": "#FBBF24",
            "fields": [
                ("PK", "id", "INTEGER (Auto Increment)"),
                ("FK", "session_id", "INTEGER (sessions.id)"),
                ("FK", "student_id", "INTEGER (students.id)"),
                ("  ", "check_in_time", "DATETIME"),
                ("  ", "status", "ENUM ('present','late','absent')"),
                ("  ", "client_lat / lng", "FLOAT"),
                ("  ", "distance_meters", "FLOAT"),
                ("  ", "device_id", "VARCHAR(255)"),
                ("  ", "is_verified", "BOOLEAN"),
            ]
        },
        "ANOMALIES": {
            "title": "suspicious_activities (AI/ML)",
            "rect": (1680, 620, 1680 + card_w, 620 + card_h + 20),
            "accent": "#F87171",
            "fields": [
                ("PK", "id", "INTEGER (Auto Increment)"),
                ("FK", "attendance_record_id", "INTEGER (records.id)"),
                ("  ", "risk_score", "FLOAT (0-100)"),
                ("  ", "isolation_forest_score", "FLOAT"),
                ("  ", "dbscan_cluster_id", "FLOAT"),
                ("  ", "trigger_reasons", "TEXT / JSON"),
                ("  ", "review_status", "ENUM ('pending','dismissed')"),
                ("  ", "faculty_remarks", "VARCHAR(255)"),
            ]
        }
    }

    # Draw Connecting Lines (Relationships)
    lines = [
        # USERS -> STUDENTS
        ((520, 320), (600, 320), "#38BDF8", "1 : 1"),
        # USERS -> FACULTY
        ((310, 480), (310, 600), "#38BDF8", "1 : 1"),
        # FACULTY -> SESSIONS
        ((520, 750), (1150, 580), "#818CF8", "1 : N"),
        # TIMETABLE -> SESSIONS
        ((1020, 750), (1150, 540), "#A78BFA", "1 : N"),
        # SESSIONS -> RECORDS
        ((1570, 480), (1680, 320), "#34D399", "1 : N"),
        # STUDENTS -> RECORDS
        ((1020, 280), (1680, 240), "#06B6D4", "1 : N"),
        # RECORDS -> ANOMALIES
        ((1890, 500), (1890, 620), "#F87171", "1 : 1"),
    ]

    for p1, p2, color, label in lines:
        draw.line([p1, p2], fill=color, width=3)
        # Relationship midpoint badge
        mx = (p1[0] + p2[0]) // 2
        my = (p1[1] + p2[1]) // 2
        draw.rounded_rectangle((mx - 24, my - 14, mx + 24, my + 14), radius=6, fill="#1E293B", outline=color, width=1)
        draw.text((mx, my), label, fill="#F8FAFC", font=badge_font, anchor="mm")

    # Draw Cards
    for key, c in cards.items():
        x1, y1, x2, y2 = c["rect"]
        accent = c["accent"]

        # Outer Card Box
        draw.rounded_rectangle((x1, y1, x2, y2), radius=14, fill="#1E293B", outline="#334155", width=2)
        # Header Strip
        draw.rounded_rectangle((x1, y1, x2, y1 + 54), radius=14, fill="#0F172A", outline="#334155", width=1)
        draw.rectangle((x1, y1 + 30, x2, y1 + 54), fill="#0F172A")
        draw.line([(x1, y1 + 54), (x2, y1 + 54)], fill="#334155", width=2)

        # Header Accent Indicator & Title
        draw.ellipse((x1 + 18, y1 + 22, x1 + 30, y1 + 34), fill=accent)
        draw.text((x1 + 42, y1 + 27), c["title"], fill="#F8FAFC", font=header_font, anchor="lm")

        # Fields List
        fy = y1 + 75
        for key_type, name, ftype in c["fields"]:
            # Key badge
            if key_type.strip():
                k_bg = "#EF4444" if key_type == "PK" else ("#3B82F6" if key_type == "FK" else "#10B981")
                draw.rounded_rectangle((x1 + 16, fy - 11, x1 + 46, fy + 11), radius=4, fill=k_bg)
                draw.text((x1 + 31, fy), key_type, fill="#FFFFFF", font=badge_font, anchor="mm")
            
            # Field Name
            draw.text((x1 + 56, fy), name, fill="#F1F5F9", font=text_font, anchor="lm")
            # Field Type
            draw.text((x2 - 16, fy), ftype, fill="#64748B", font=text_font, anchor="rm")
            fy += 34

    output_path = "/Users/apple/Projects/geoattend-ai/screenshot_5_er_diagram.png"
    img.save(output_path, "PNG", quality=100)
    print(f"Generated clean ER diagram at: {output_path}")

if __name__ == "__main__":
    generate_er_image()
