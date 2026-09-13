from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_db, require_role
from ..models import ActivityLog, Item, Stock, Transaction, Warehouse
from ..schemas import WarehouseCreate, WarehouseResponse, WarehouseUpdate

router = APIRouter(prefix="/api/warehouses", tags=["المستودعات"])


@router.post("", response_model=WarehouseResponse)
def create_warehouse(
    data: WarehouseCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """↯ إضافة مستودع جديد - للمشرف فقط"""
    warehouse = Warehouse(name=data.name, location=data.location)
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)

    log = ActivityLog(
        action="create",
        entity_type="warehouse",
        entity_id=warehouse.id,
        description=f"إضافة مستودع: {warehouse.name}",
        user_id=user.id,
    )
    db.add(log)
    db.commit()
    return warehouse


@router.get("", response_model=list[WarehouseResponse])
def list_warehouses(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """قائمة المستودعات"""
    return db.query(Warehouse).order_by(Warehouse.id).all()


@router.get("/{warehouse_id}", response_model=WarehouseResponse)
def get_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """الحصول على مستودع"""
    w = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="المستودع غير موجود")
    return w


@router.put("/{warehouse_id}", response_model=WarehouseResponse)
def update_warehouse(
    warehouse_id: int,
    data: WarehouseUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """تعديل مستودع - للمشرف فقط"""
    w = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="المستودع غير موجود")
    if data.name:
        w.name = data.name
    if data.location is not None:
        w.location = data.location
    db.commit()
    db.refresh(w)

    log = ActivityLog(
        action="update",
        entity_type="warehouse",
        entity_id=w.id,
        description=f"تعديل مستودع: {w.name}",
        user_id=user.id,
    )
    db.add(log)
    db.commit()
    return w


@router.delete("/{warehouse_id}")
def delete_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """حذف مستودع - للمشرف فقط"""
    w = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="المستودع غير موجود")

    # التحقق من وجود حركات مرتبطة بالمستودع
    tx_count = db.query(Transaction).filter(
        (Transaction.warehouse_id == warehouse_id)
        | (Transaction.target_warehouse_id == warehouse_id)
    ).count()
    if tx_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"لا يمكن حذف المستودع لوجود {tx_count} حركة مرتبطة به. يرجى حذف الحركات أولاً.",
        )

    warehouse_name = w.name

    # فك ارتباط الأصناف ثم حذف المخزون المرتبط
    db.query(Item).filter(Item.warehouse_id == warehouse_id).update(
        {Item.warehouse_id: None}
    )
    db.query(Stock).filter(Stock.warehouse_id == warehouse_id).delete()
    db.delete(w)

    db.add(
        ActivityLog(
            action="delete",
            entity_type="warehouse",
            entity_id=warehouse_id,
            description=f"حذف مستودع: {warehouse_name}",
            user_id=user.id,
        )
    )
    db.commit()
    return {"message": "تم حذف المستودع بنجاح"}
