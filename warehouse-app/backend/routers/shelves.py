from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_db, require_role
from ..models import ActivityLog, Shelf, Warehouse
from ..schemas import ShelfCreate, ShelfResponse, ShelfUpdate

router = APIRouter(prefix="/api/shelves", tags=["الأرفف"])


@router.post("", response_model=ShelfResponse)
def create_shelf(
    data: ShelfCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """↯ إضافة رف جديد - للمشرف فقط"""
    warehouse = db.query(Warehouse).filter(Warehouse.id == data.warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="المستودع غير موجود")
    
    shelf = Shelf(name=data.name, warehouse_id=data.warehouse_id)
    db.add(shelf)
    db.commit()
    db.refresh(shelf)

    log = ActivityLog(
        action="create",
        entity_type="shelf",
        entity_id=shelf.id,
        description=f"إضافة رف: {shelf.name} في المستودع {warehouse.name}",
        user_id=user.id,
    )
    db.add(log)
    db.commit()
    
    return shelf


@router.get("", response_model=list[ShelfResponse])
def list_shelves(
    warehouse_id: int = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """قائمة الأرفف مع إمكانية التصفية حسب المستودع"""
    query = db.query(Shelf)
    if warehouse_id:
        query = query.filter(Shelf.warehouse_id == warehouse_id)
    return query.order_by(Shelf.warehouse_id, Shelf.name).all()


@router.get("/{shelf_id}", response_model=ShelfResponse)
def get_shelf(
    shelf_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """الحصول على رف محدد"""
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="الرف غير موجود")
    return shelf


@router.put("/{shelf_id}", response_model=ShelfResponse)
def update_shelf(
    shelf_id: int,
    data: ShelfUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """تعديل رف - للمشرف فقط"""
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="الرف غير موجود")
    
    if data.name:
        shelf.name = data.name
    if data.warehouse_id:
        warehouse = db.query(Warehouse).filter(Warehouse.id == data.warehouse_id).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="المستودع غير موجود")
        shelf.warehouse_id = data.warehouse_id
    
    db.commit()
    db.refresh(shelf)

    log = ActivityLog(
        action="update",
        entity_type="shelf",
        entity_id=shelf.id,
        description=f"تعديل رف: {shelf.name}",
        user_id=user.id,
    )
    db.add(log)
    db.commit()
    return shelf


@router.delete("/{shelf_id}")
def delete_shelf(
    shelf_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """حذف رف - للمشرف فقط"""
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="الرف غير موجود")

    shelf_name = shelf.name
    
    db.delete(shelf)
    db.add(
        ActivityLog(
            action="delete",
            entity_type="shelf",
            entity_id=shelf_id,
            description=f"حذف رف: {shelf_name}",
            user_id=user.id,
        )
    )
    db.commit()
    return {"message": "تم حذف الرف بنجاح"}
