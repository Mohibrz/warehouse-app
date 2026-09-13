from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_db
from ..models import Item, Notification, Stock, Warehouse
from ..schemas import AlertResponse

router = APIRouter(prefix="/api/alerts", tags=["التنبيهات"])


def create_or_update_low_stock_notification(
    db: Session, item: Item, warehouse: Warehouse, stock: Stock
):
    """إنشاء أو تحديث تنبيه مخزون منخفض تلقائياً."""
    existing = (
        db.query(Notification)
        .filter(
            Notification.type == "low_stock",
            Notification.item_id == item.id,
            Notification.warehouse_id == warehouse.id,
            Notification.is_dismissed == 0,
        )
        .first()
    )

    message = (
        f"مخزون الصنف '{item.name}' ({item.sku}) "
        f"في مستودع '{warehouse.name}' منخفض "
        f"(الكمية الحالية: {stock.quantity:.2f} / الحد الأدنى: {item.min_stock:.2f})"
    )

    if existing:
        existing.message = message
        existing.is_read = 0
    else:
        db.add(
            Notification(
                type="low_stock",
                title="تنبيه انخفاض المخزون",
                message=message,
                item_id=item.id,
                warehouse_id=warehouse.id,
            )
        )


@router.get("/low-stock", response_model=list[AlertResponse])
def low_stock_alerts(
    warehouse_id: int = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """تنبيهات المخزون المنخفض"""
    # التصفية تتم في قاعدة البيانات
    query = (
        db.query(Stock, Item, Warehouse)
        .join(Item, Stock.item_id == Item.id)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .filter(Stock.quantity <= Item.min_stock)
    )
    if warehouse_id:
        query = query.filter(Stock.warehouse_id == warehouse_id)

    results = query.order_by(Stock.quantity).all()

    # إنشاء إشعارات تلقائية لتنبيهات المخزون المنخفض
    for stock, item, wh in results:
        create_or_update_low_stock_notification(db, item, wh, stock)
    db.commit()

    return [
        {
            "item_id": item.id,
            "item_name": item.name,
            "sku": item.sku,
            "current_stock": stock.quantity,
            "min_stock": item.min_stock,
            "warehouse_name": wh.name,
            "warehouse_id": wh.id,
            "status": "منخفض" if stock.quantity > 0 else "مستنزف",
        }
        for stock, item, wh in results
    ]
