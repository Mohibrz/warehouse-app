from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_db
from ..models import Item, Stock, Warehouse
from ..schemas import StockResponse

router = APIRouter(prefix="/api/stock", tags=["المخزون"])


@router.get("", response_model=list[StockResponse])
def list_stock(
    item_id: int = Query(None),
    warehouse_id: int = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """قائمة المخزون الحالية (قابلة للتصفية) مع أسماء الصنف والمستودع"""
    query = (
        db.query(Stock, Item.name, Warehouse.name)
        .join(Item, Stock.item_id == Item.id)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
    )
    if item_id:
        query = query.filter(Stock.item_id == item_id)
    if warehouse_id:
        query = query.filter(Stock.warehouse_id == warehouse_id)

    return [
        StockResponse(
            id=stock.id,
            quantity=stock.quantity,
            item_id=stock.item_id,
            warehouse_id=stock.warehouse_id,
            item_name=item_name,
            warehouse_name=warehouse_name,
        )
        for stock, item_name, warehouse_name in query.all()
    ]
