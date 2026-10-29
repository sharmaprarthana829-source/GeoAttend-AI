from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, require_roles
from app.models import Campus, Room, User, UserRole
from app.schemas import MessageResponse, RoomCreate, RoomRead, RoomUpdate
from app.services.audit import AuditService

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("", response_model=list[RoomRead])
def get_rooms(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))],
    campus_id: int | None = Query(None),
):
    query = db.query(Room)
    if campus_id:
        query = query.filter(Room.campus_id == campus_id)
    return query.order_by(Room.name).all()


@router.post("", response_model=RoomRead, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: RoomCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    campus = db.query(Campus).filter(Campus.id == payload.campus_id).first()
    if not campus:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campus not found")

    existing = db.query(Room).filter(Room.campus_id == payload.campus_id, Room.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Room already exists in this campus")

    room = Room(
        campus_id=payload.campus_id,
        name=payload.name,
        building=payload.building,
        latitude=payload.latitude,
        longitude=payload.longitude,
        geofence_radius_meters=payload.geofence_radius_meters,
        gps_accuracy_threshold=payload.gps_accuracy_threshold,
        capacity=payload.capacity,
        is_active=payload.is_active,
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    AuditService.log_action(
        db=db,
        user=current_user,
        action="CREATE_ROOM",
        entity_type="ROOM",
        entity_id=room.id,
        metadata={"name": room.name, "campus_id": room.campus_id, "radius": room.geofence_radius_meters},
        reason=f"Created classroom {room.name}",
    )
    return room


@router.put("/{room_id}", response_model=RoomRead)
def update_room(
    room_id: int,
    payload: RoomUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    old_values = {
        "name": room.name,
        "latitude": room.latitude,
        "longitude": room.longitude,
        "radius": room.geofence_radius_meters,
    }

    if payload.name is not None:
        room.name = payload.name
    if payload.building is not None:
        room.building = payload.building
    if payload.latitude is not None:
        room.latitude = payload.latitude
    if payload.longitude is not None:
        room.longitude = payload.longitude
    if payload.geofence_radius_meters is not None:
        room.geofence_radius_meters = payload.geofence_radius_meters
    if payload.gps_accuracy_threshold is not None:
        room.gps_accuracy_threshold = payload.gps_accuracy_threshold
    if payload.capacity is not None:
        room.capacity = payload.capacity
    if payload.is_active is not None:
        room.is_active = payload.is_active

    db.commit()
    db.refresh(room)

    AuditService.log_action(
        db=db,
        user=current_user,
        action="UPDATE_ROOM",
        entity_type="ROOM",
        entity_id=room.id,
        metadata={"old_values": old_values, "new_values": {"name": room.name, "radius": room.geofence_radius_meters}},
        reason=f"Updated classroom {room.name} geofence and parameters",
    )
    return room


@router.delete("/{room_id}", response_model=MessageResponse)
def delete_room(
    room_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    # Safe deactivation rather than hard delete if in use
    room.is_active = False
    db.commit()

    AuditService.log_action(
        db=db,
        user=current_user,
        action="DEACTIVATE_ROOM",
        entity_type="ROOM",
        entity_id=room.id,
        metadata={"name": room.name},
        reason=f"Deactivated classroom {room.name}",
    )
    return MessageResponse(message=f"Room {room.name} deactivated successfully")
