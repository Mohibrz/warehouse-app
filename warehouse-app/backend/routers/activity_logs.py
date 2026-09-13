from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from ..auth import get_db, require_role
from ..models import ActivityLog
from ..schemas import ActivityLogResponse

router = APIRouter(prefix="/api/activity-logs", tags=["سجل النشاطات"])


def log_activity(db: Session, action: str, entity_type: str, entity_id: int = None,
                 description: str = None, user_id: int = None):
    """تسجيل نشاط في السجل (بدون commit - يترك ذلك للمستدعي)"""
    db.add(
        ActivityLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            user_id=user_id,
        )
    )


@router.get("", response_model=list[ActivityLogResponse])
def list_activity_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """قائمة سجل النشاطات - للمشرف فقط"""
    logs = (
        db.query(ActivityLog)
        .options(joinedload(ActivityLog.user))
        .order_by(ActivityLog.timestamp.desc(), ActivityLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "description": log.description,
            "user_id": log.user_id,
            "username": log.user.username if log.user else None,
            "timestamp": log.timestamp,
        }
        for log in logs
    ]
