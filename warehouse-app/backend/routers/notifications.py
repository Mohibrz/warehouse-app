from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_db
from ..models import Item, Notification, Stock, Warehouse
from ..schemas import NotificationResponse, NotificationCountResponse

router = APIRouter(prefix="/api/notifications", tags=["الإشعارات"])


@router.get("", response_model=list[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """الحصول على قائمة الإشعارات"""
    return (
        db.query(Notification)
        .filter(Notification.is_dismissed == 0)
        .order_by(Notification.created_at.desc())
        .all()
    )


@router.get("/count", response_model=NotificationCountResponse)
def get_notification_count(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """الحصول على إحصائيات الإشعارات"""
    total = db.query(Notification).filter(Notification.is_dismissed == 0).count()
    unread = db.query(Notification).filter(Notification.is_read == 0).count()

    # عدد تنبيهات المخزون المنخفض
    low_stock = db.query(Notification).filter(
        Notification.type == "low_stock",
        Notification.is_dismissed == 0,
        Notification.is_read == 0
    ).count()

    return {
        "total": total,
        "unread": unread,
        "low_stock": low_stock
    }


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """تعويم الإشعار كمقرؤ"""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="الإشعار غير موجود")

    notification.is_read = 1
    notification.read_at = datetime.now()
    db.commit()

    return {"message": "تم تعويم الإشعار"}


@router.post("/{notification_id}/dismiss")
def mark_notification_dismissed(
    notification_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """إلغاء الإشعار (إخفاؤه مؤقتاً)"""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="الإشعار غير موجود")

    notification.is_dismissed = 1
    notification.dismissed_at = datetime.now()
    db.commit()

    return {"message": "تم إلغاء الإشعار"}


@router.post("/dismiss-all")
def dismiss_all_notifications(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """إلغاء جميع الإشعارات"""
    db.query(Notification).filter(Notification.is_dismissed == 0).update(
        {"is_dismissed": 1, "dismissed_at": datetime.now()},
        synchronize_session=False
    )
    db.commit()

    return {"message": "تم إلغاء جميع الإشعارات"}


@router.post("/mark-all-read")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """تعويم جميع الإشعارات كمقروءة"""
    db.query(Notification).filter(Notification.is_read == 0).update(
        {"is_read": 1, "read_at": datetime.now()},
        synchronize_session=False
    )
    db.commit()

    return {"message": "تم تعويم جميع الإشعارات"}


@router.post("/low-stock/{item_id}/{warehouse_id}")
def create_low_stock_notification(
    item_id: int,
    warehouse_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """إنشاء تنبيه مخزون منخفض"""
    # التحقق من وجود الصنف
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")

    # التحقق من وجود المستودع
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="المستودع غير موجود")

    # التحقق مما إذا كان تنبيه نشط بالفعل
    existing = (
        db.query(Notification)
        .filter(
            Notification.type == "low_stock",
            Notification.item_id == item_id,
            Notification.warehouse_id == warehouse_id,
            Notification.is_dismissed == 0
        )
        .first()
    )

    if existing:
        return {"message": "تنبيه موجود بالفعل", "id": existing.id}

    # جلب الكمية الحالية للمخزون
    stock = db.query(Stock).filter(
        Stock.item_id == item_id, Stock.warehouse_id == warehouse_id
    ).first()
    current_stock = stock.quantity if stock else 0

    notification = Notification(
        type="low_stock",
        title="تنبيه انخفاض المخزون",
        message=f"مخزون الصنف '{item.name}' ({item.sku}) في مستودع '{warehouse.name}' منخفض (الكمية الحالية: {current_stock})",
        item_id=item_id,
        warehouse_id=warehouse_id,
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return {"message": "تم إنشاء تنبيه المخزون", "id": notification.id}