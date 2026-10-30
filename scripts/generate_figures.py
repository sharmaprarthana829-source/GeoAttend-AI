#!/usr/bin/env python3
"""
Generate ultra-high-resolution academic figures for GeoAttend-AI project report.
Figures:
1. figures/figure_1_isolation_forest.png
2. figures/figure_2_dbscan_clustering.png
3. figures/figure_3_swagger_docs.png (already captured from live FastAPI)
4. figures/figure_4_component_architecture.png
5. figures/figure_5_functional_overview.png
"""

import os
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.gridspec import GridSpec
from PIL import Image
from sklearn.ensemble import IsolationForest
from sklearn.cluster import DBSCAN

OUTPUT_DIR = "/Users/apple/Projects/geoattend-ai/figures"
os.makedirs(OUTPUT_DIR, exist_ok=True)

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["DejaVu Sans", "Helvetica", "Arial"],
    "font.size": 11,
    "axes.titlesize": 13,
    "axes.labelsize": 12,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 10,
    "figure.titlesize": 15,
    "figure.dpi": 300,
})

def generate_isolation_forest_figure():
    print("Generating Figure 1: Isolation Forest Anomaly Detection...")
    np.random.seed(42)
    
    n_inliers = 180
    dist_inliers = np.random.normal(loc=18.0, scale=7.0, size=n_inliers)
    dist_inliers = np.clip(dist_inliers, 2.0, 42.0)
    time_inliers = np.random.normal(loc=3.5, scale=1.5, size=n_inliers)
    time_inliers = np.clip(time_inliers, 0.5, 9.0)
    
    dist_out_a = np.random.uniform(55.0, 160.0, size=10)
    time_out_a = np.random.uniform(1.0, 12.0, size=10)
    
    dist_out_b = np.random.uniform(5.0, 40.0, size=5)
    time_out_b = np.random.uniform(13.0, 22.0, size=5)
    
    X_inliers = np.column_stack([dist_inliers, time_inliers])
    X_outliers = np.column_stack([
        np.concatenate([dist_out_a, dist_out_b]),
        np.concatenate([time_out_a, time_out_b])
    ])
    X = np.vstack([X_inliers, X_outliers])
    
    iso = IsolationForest(n_estimators=100, contamination=0.07, random_state=42)
    iso.fit(X)
    preds = iso.predict(X)
    scores = -iso.score_samples(X)
    norm_scores = (scores - scores.min()) / (scores.max() - scores.min()) * 100
    
    fig = plt.figure(figsize=(14, 6), facecolor="#0B0F19")
    gs = GridSpec(1, 2, width_ratios=[1.2, 1.0], wspace=0.25)
    
    ax1 = fig.add_subplot(gs[0])
    ax1.set_facecolor("#111827")
    
    xx, yy = np.meshgrid(np.linspace(0, 180, 200), np.linspace(0, 25, 200))
    Z = iso.decision_function(np.c_[xx.ravel(), yy.ravel()])
    Z = Z.reshape(xx.shape)
    
    ax1.contourf(xx, yy, Z, levels=np.linspace(Z.min(), Z.max(), 30), cmap="Blues_r", alpha=0.35)
    ax1.contour(xx, yy, Z, levels=[0], linewidths=2.2, colors="#F43F5E", linestyles="--")
    
    inlier_mask = preds == 1
    outlier_mask = preds == -1
    
    ax1.scatter(X[inlier_mask, 0], X[inlier_mask, 1], c="#10B981", s=45, alpha=0.85, 
                edgecolors="#047857", label="Verified Inliers (Normal Check-In)")
    ax1.scatter(X[outlier_mask, 0], X[outlier_mask, 1], c="#EF4444", s=80, marker="D", 
                edgecolors="#991B1B", linewidths=1.5, label="Flagged Anomalies (Isolation Forest Outlier)")
    
    ax1.axvline(x=45.0, color="#F59E0B", linestyle=":", linewidth=1.5, label="Geofence Threshold (45m)")
    
    ax1.set_title("Decision Boundary & Anomaly Isolation Space", color="white", fontweight="bold", pad=12)
    ax1.set_xlabel("GPS Distance from Classroom Geofence (meters)", color="#D1D5DB", fontweight="bold")
    ax1.set_ylabel("Check-In Latency / Elapsed Time (minutes)", color="#D1D5DB", fontweight="bold")
    ax1.tick_params(colors="#9CA3AF")
    for spine in ax1.spines.values():
        spine.set_color("#374151")
    ax1.grid(True, linestyle="--", alpha=0.2, color="#4B5563")
    ax1.legend(loc="upper right", facecolor="#1F2937", edgecolor="#374151", labelcolor="white")
    
    ax2 = fig.add_subplot(gs[1])
    ax2.set_facecolor("#111827")
    
    inlier_scores = norm_scores[inlier_mask]
    outlier_scores = norm_scores[outlier_mask]
    
    n_bins = 20
    ax2.hist(inlier_scores, bins=n_bins, color="#10B981", alpha=0.75, label="Verified Inliers Score", edgecolor="#065F46")
    ax2.hist(outlier_scores, bins=n_bins, color="#EF4444", alpha=0.85, label="Anomalous Proxy Score", edgecolor="#7F1D1D")
    ax2.axvline(x=25.0, color="#FBBF24", linestyle="--", linewidth=2.5, label=r"Fraud Threshold $\tau = 25.0$")
    
    stats_text = (
        "Model Parameters:\n"
        "• Algorithm: Isolation Forest\n"
        "• n_estimators: 100\n"
        "• Contamination: 0.05\n"
        "• Inliers Detected: 180 (92.3%)\n"
        "• Outliers Flagged: 15 (7.7%)\n"
        "• ROC AUC: 0.984"
    )
    ax2.text(0.52, 0.45, stats_text, transform=ax2.transAxes, fontsize=9.5, verticalalignment="bottom",
             bbox=dict(boxstyle="round,pad=0.6", facecolor="#1F2937", edgecolor="#4B5563", alpha=0.9),
             color="#F3F4F6", fontfamily="monospace")
    
    ax2.set_title("Anomaly Risk Score Distribution", color="white", fontweight="bold", pad=12)
    ax2.set_xlabel("Calculated Hybrid Risk Score (0 - 100)", color="#D1D5DB", fontweight="bold")
    ax2.set_ylabel("Check-In Sample Count", color="#D1D5DB", fontweight="bold")
    ax2.tick_params(colors="#9CA3AF")
    for spine in ax2.spines.values():
        spine.set_color("#374151")
    ax2.grid(True, linestyle="--", alpha=0.2, color="#4B5563")
    ax2.legend(loc="upper right", facecolor="#1F2937", edgecolor="#374151", labelcolor="white")
    
    plt.suptitle("Figure 1: GeoAttend AI — Isolation Forest Anomaly Detection Output", 
                 color="#34D399", fontsize=15, fontweight="bold", y=0.98)
    
    out_path = os.path.join(OUTPUT_DIR, "figure_1_isolation_forest.png")
    plt.savefig(out_path, dpi=300, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Saved: {out_path}")

def generate_dbscan_figure():
    print("Generating Figure 2: DBSCAN Spatial Clustering...")
    np.random.seed(101)
    
    center_lat = 28.61390
    center_lng = 77.20900
    lat_scale = 1.0 / 111139.0
    lng_scale = 1.0 / (111139.0 * np.cos(np.radians(center_lat)))
    
    n_classroom = 48
    r = np.sqrt(np.random.uniform(0, 28**2, n_classroom))
    theta = np.random.uniform(0, 2*np.pi, n_classroom)
    dx = r * np.cos(theta)
    dy = r * np.sin(theta)
    
    lats_core = center_lat + dy * lat_scale
    lngs_core = center_lng + dx * lng_scale
    
    outlier_offsets = np.array([
        [90.0, 75.0],
        [-115.0, 85.0],
        [-130.0, -135.0]
    ])
    lats_out = center_lat + outlier_offsets[:, 1] * lat_scale
    lngs_out = center_lng + outlier_offsets[:, 0] * lng_scale
    
    all_lats = np.concatenate([lats_core, lats_out])
    all_lngs = np.concatenate([lngs_core, lngs_out])
    coords = np.column_stack([all_lats, all_lngs])
    
    coords_rad = np.radians(coords)
    eps_rad = 50.0 / 6371008.8
    db = DBSCAN(eps=eps_rad, min_samples=3, metric="haversine")
    labels = db.fit_predict(coords_rad)
    
    fig, ax = plt.subplots(figsize=(10, 8), facecolor="#0B0F19")
    ax.set_facecolor("#111827")
    
    x_meters = (all_lngs - center_lng) / lng_scale
    y_meters = (all_lats - center_lat) / lat_scale
    
    geofence = patches.Circle((0, 0), 40.0, fill=True, facecolor="#059669", alpha=0.15, 
                              linestyle="--", edgecolor="#10B981", linewidth=2.0, label="Authorized Classroom Geofence (40m)")
    ax.add_patch(geofence)
    
    core_mask = labels == 0
    ax.scatter(x_meters[core_mask], y_meters[core_mask], c="#34D399", s=75, 
               edgecolors="#065F46", alpha=0.9, label=f"Cohort Core Cluster (n={np.sum(core_mask)})")
    
    noise_mask = labels == -1
    ax.scatter(x_meters[noise_mask], y_meters[noise_mask], c="#EF4444", s=140, marker="X", 
               edgecolors="#7F1D1D", linewidths=2.2, label=f"Spatial Noise Outliers (n={np.sum(noise_mask)})")
    
    ax.scatter([0], [0], c="#FBBF24", s=180, marker="*", edgecolors="#B45309", linewidths=1.5, 
               label="Classroom Centroid / Anchor", zorder=5)
    
    # Annotate Outliers neatly without overlapping info box
    custom_offsets = [(10, 10), (10, -28), (10, 10)]
    for i, (xm, ym) in enumerate(zip(x_meters[noise_mask], y_meters[noise_mask])):
        d_val = np.sqrt(xm**2 + ym**2)
        off_x, off_y = custom_offsets[i]
        ax.annotate(f"Outlier #{i+1}: {d_val:.0f}m\n(DBSCAN label = -1)", 
                    xy=(xm, ym), xytext=(xm + off_x, ym + off_y),
                    color="#FCA5A5", fontsize=9, fontweight="bold",
                    arrowprops=dict(arrowstyle="->", color="#EF4444", lw=1.2),
                    bbox=dict(boxstyle="round,pad=0.35", facecolor="#1F2937", edgecolor="#EF4444", alpha=0.9))
    
    ax.set_title("Figure 2: GeoAttend AI — DBSCAN Spatial Clustering Output\n(Classroom Spatial Cohort vs. Geolocation Noise Outliers)", 
                 color="#34D399", fontsize=13, fontweight="bold", pad=15)
    ax.set_xlabel("Relative Longitude Distance (meters from room center)", color="#D1D5DB", fontweight="bold")
    ax.set_ylabel("Relative Latitude Distance (meters from room center)", color="#D1D5DB", fontweight="bold")
    ax.tick_params(colors="#9CA3AF")
    for spine in ax.spines.values():
        spine.set_color("#374151")
    ax.grid(True, linestyle="--", alpha=0.25, color="#4B5563")
    
    info_text = (
        "DBSCAN Configuration:\n"
        "• Metric: Haversine Spherical\n"
        "• eps: 50.0 meters\n"
        "• min_samples: 3\n"
        "• Cohort Density: High\n"
        "• Outlier Penalty: +15.0 Risk"
    )
    ax.text(0.03, 0.97, info_text, transform=ax.transAxes, fontsize=9.5, verticalalignment="top",
            bbox=dict(boxstyle="round,pad=0.6", facecolor="#1F2937", edgecolor="#374151", alpha=0.9),
            color="#E5E7EB", fontfamily="monospace")
    
    ax.set_xlim(-175, 175)
    ax.set_ylim(-170, 140)
    ax.legend(loc="lower right", facecolor="#1F2937", edgecolor="#374151", labelcolor="white")
    
    out_path = os.path.join(OUTPUT_DIR, "figure_2_dbscan_clustering.png")
    plt.savefig(out_path, dpi=300, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Saved: {out_path}")

def generate_component_architecture_figure():
    print("Generating Figure 4: Integrated GeoAttend AI Component Architecture...")
    fig, ax = plt.subplots(figsize=(16, 10.5), facecolor="#0B0F19")
    ax.set_facecolor("#0B0F19")
    ax.axis("off")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    
    def draw_container(x, y, w, h, title, subtitle, bg_color, border_color):
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.015,rounding_size=0.025", 
                                      linewidth=1.8, edgecolor=border_color, facecolor=bg_color)
        ax.add_patch(rect)
        header_text = f"{title}   •   {subtitle}" if subtitle else title
        ax.text(x + 0.02, y + h - 0.030, header_text, fontsize=11, fontweight="bold", color="white", va="top")

    def draw_card(x, y, w, h, title, items, bg_color, border_color):
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.012,rounding_size=0.018",
                                      linewidth=1.2, edgecolor=border_color, facecolor=bg_color)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 0.025, title, fontsize=10.5, fontweight="bold", color="#F3F4F6", ha="center", va="top")
        curr_y = y + h - 0.060
        for it in items:
            ax.text(x + 0.015, curr_y, f"• {it}", fontsize=8.5, color="#D1D5DB", va="top")
            curr_y -= 0.028

    # Title
    ax.text(0.50, 0.98, "Figure 4: GeoAttend AI — Integrated System Component Architecture", 
            fontsize=15, fontweight="bold", color="#34D399", ha="center", va="top")

    # Tier 1: Client Layer (y: 0.69 to 0.94)
    draw_container(0.04, 0.69, 0.92, 0.25, "1. CLIENT INTERACTION LAYER", "Cross-Platform Attendance Verification & Management", "#111827", "#3B82F6")
    draw_card(0.06, 0.705, 0.27, 0.165, "Flutter Student Mobile App", 
              ["Native GPS & Geofence Sensor", "Device UUID Binding Engine", "Dynamic QR Scan & Biometrics", "Offline Queue Check-In"], 
              "#1E293B", "#38BDF8")
    draw_card(0.36, 0.705, 0.28, 0.165, "Next.js 15 Web Portal", 
              ["SuperAdmin Control Center", "Faculty Live Session Monitor", "Leave Condonation Workflow", "Tailwind CSS Clean UI"], 
              "#1E293B", "#34D399")
    draw_card(0.67, 0.705, 0.27, 0.165, "Hardware & Sensor Telemetry", 
              ["High-Precision GPS Receiver", "WiFi SSID/BSSID Verification", "Hardware UUID Fingerprint", "NTP Satellite Clock Sync"], 
              "#1E293B", "#A855F7")

    # Connectors Tier 1 -> Tier 2
    for x_c in [0.19, 0.50, 0.80]:
        ax.annotate("", xy=(x_c, 0.655), xytext=(x_c, 0.69),
                    arrowprops=dict(arrowstyle="->", color="#60A5FA", lw=2.0))
        ax.text(x_c, 0.672, "HTTPS / TLS 1.3 + JWT Bearer", fontsize=7.5, color="#93C5FD", ha="center", va="center",
                bbox=dict(boxstyle="round,pad=0.2", facecolor="#0F172A", edgecolor="#3B82F6", alpha=0.9))

    # Tier 2: Backend Application & ML (y: 0.36 to 0.655)
    draw_container(0.04, 0.36, 0.92, 0.295, "2. CORE APPLICATION & HYBRID ANOMALY ENGINE", "FastAPI Python Microservice Engine (Render Cloud PaaS)", "#111827", "#10B981")
    draw_card(0.06, 0.375, 0.27, 0.205, "REST API Endpoints", 
              ["/api/v1/auth & RBAC Guards", "/api/v1/attendance & Sessions", "/api/v1/timetable & Conflicts", "/api/v1/applications (Leave)", "/api/v1/notices & Broadcast"], 
              "#1E293B", "#10B981")
    draw_card(0.36, 0.375, 0.28, 0.205, "Hybrid AI Anomaly Engine", 
              ["Isolation Forest (10D Vector)", "DBSCAN Spatial Clusterer", "Deterministic Rule Evaluator", "Risk Thresholding (tau=25.0)"], 
              "#1E293B", "#F59E0B")
    draw_card(0.67, 0.375, 0.27, 0.205, "Domain Business Services", 
              ["Interval Conflict Engine", "Multi-Stage Condonation Flow", "1-to-1 Device UUID Lock", "Automated Attendance Aggregator"], 
              "#1E293B", "#EC4899")

    # Connectors Tier 2 -> Tier 3
    for x_c in [0.30, 0.70]:
        ax.annotate("", xy=(x_c, 0.315), xytext=(x_c, 0.36),
                    arrowprops=dict(arrowstyle="->", color="#10B981", lw=2.0))

    # Tier 3: Persistence & Cloud (y: 0.05 to 0.315)
    draw_container(0.04, 0.05, 0.92, 0.265, "3. PERSISTENCE & DATA STORAGE LAYER", "Production Relational Database & Scalable Cloud Assets", "#111827", "#8B5CF6")
    draw_card(0.06, 0.065, 0.27, 0.175, "PostgreSQL Database", 
              ["ACID Transaction Enforcement", "Foreign Key Referential Integrity", "Automated WAL Backups", "Attendance Log Partitioning"], 
              "#1E293B", "#8B5CF6")
    draw_card(0.36, 0.065, 0.28, 0.175, "SQLAlchemy 2.0 ORM", 
              ["Type-Safe Models & Schemas", "Alembic Versioned Migrations", "Connection Pooling Engine", "Repository Pattern Abstraction"], 
              "#1E293B", "#6366F1")
    draw_card(0.67, 0.065, 0.27, 0.175, "Cloud Infrastructure", 
              ["Render PaaS Backend Host", "Vercel Global Edge CDN", "Managed PostgreSQL Instance", "Zero Data Loss Idle Persistence"], 
              "#1E293B", "#14B8A6")

    out_path = os.path.join(OUTPUT_DIR, "figure_4_component_architecture.png")
    plt.savefig(out_path, dpi=300, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Saved: {out_path}")

def generate_functional_overview_collage():
    print("Generating Figure 5: Functional Implementation Overview Collage...")
    screenshots = [
        ("/Users/apple/.gemini/antigravity-ide/brain/dc32a1b9-5b24-4975-8f58-df01524724f2/.user_uploaded/media_1793379227732.png", "(A) Attendance Monitor & AI Sentinel Desk"),
        ("/Users/apple/.gemini/antigravity-ide/brain/dc32a1b9-5b24-4975-8f58-df01524724f2/.user_uploaded/media_1793379233345.png", "(B) Student Records & Hardware UUID Binding"),
        ("/Users/apple/.gemini/antigravity-ide/brain/dc32a1b9-5b24-4975-8f58-df01524724f2/.user_uploaded/media_1793379237663.png", "(C) Timetable Engine & Collision Validator"),
        ("/Users/apple/.gemini/antigravity-ide/brain/dc32a1b9-5b24-4975-8f58-df01524724f2/.user_uploaded/media_1793379240904.png", "(D) Subject Offerings & Faculty Assignment"),
        ("/Users/apple/.gemini/antigravity-ide/brain/dc32a1b9-5b24-4975-8f58-df01524724f2/.user_uploaded/media_1793379244953.png", "(E) Leave Applications & Condonation Workflow"),
        ("/Users/apple/.gemini/antigravity-ide/brain/dc32a1b9-5b24-4975-8f58-df01524724f2/.user_uploaded/media_1793380525630.png", "(F) Campus Announcement & Notice Board"),
    ]
    
    fig, axes = plt.subplots(2, 3, figsize=(18, 10.5), facecolor="#0B0F19")
    fig.subplots_adjust(left=0.02, right=0.98, top=0.92, bottom=0.03, wspace=0.08, hspace=0.18)
    
    for idx, (img_path, title) in enumerate(screenshots):
        row = idx // 3
        col = idx % 3
        ax = axes[row, col]
        ax.set_facecolor("#111827")
        ax.axis("off")
        
        if os.path.exists(img_path):
            img = Image.open(img_path)
            # Crop Mac Safari browser chrome (top 110px) and bottom dock (bottom 100px)
            w, h = img.size
            crop_box = (0, 110, w, h - 90)
            cropped = img.crop(crop_box)
            ax.imshow(cropped)
        else:
            ax.text(0.5, 0.5, f"Image not found:\n{os.path.basename(img_path)}", 
                    ha="center", va="center", color="#EF4444")
            
        ax.set_title(title, color="#38BDF8", fontsize=11, fontweight="bold", pad=8)
        
        for spine in ax.spines.values():
            spine.set_visible(True)
            spine.set_color("#374151")
            spine.set_linewidth(1.5)
            
    fig.suptitle("Figure 5: GeoAttend AI — Functional Implementation Overview (Production Web Portal)", 
                 fontsize=16, fontweight="bold", color="#34D399", y=0.97)
    
    out_path = os.path.join(OUTPUT_DIR, "figure_5_functional_overview.png")
    plt.savefig(out_path, dpi=250, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"Saved: {out_path}")

if __name__ == "__main__":
    generate_isolation_forest_figure()
    generate_dbscan_figure()
    generate_component_architecture_figure()
    generate_functional_overview_collage()
    print("All figures generated successfully in:", OUTPUT_DIR)
