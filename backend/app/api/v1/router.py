from fastapi import APIRouter

from app.api.v1 import (
    academic,
    anomaly,
    applications,
    attendance,
    audit,
    auth,
    colleges,
    faculty,
    ml,
    notices,
    notifications,
    rooms,
    students,
    subjects,
    system_config,
    timetable,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(colleges.router)
api_router.include_router(faculty.router)
api_router.include_router(students.router)
api_router.include_router(academic.router)
api_router.include_router(subjects.router)
api_router.include_router(timetable.router)
api_router.include_router(rooms.router)
api_router.include_router(attendance.router)
api_router.include_router(anomaly.router)
api_router.include_router(applications.router)
api_router.include_router(notices.router)
api_router.include_router(notifications.router)
api_router.include_router(audit.router)
api_router.include_router(system_config.router)
api_router.include_router(ml.router)



