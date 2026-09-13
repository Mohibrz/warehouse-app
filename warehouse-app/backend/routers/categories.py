from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_db, require_role
from ..models import ActivityLog, Category, Item
from ..schemas import CategoryCreate, CategoryResponse, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["الفئات"])


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """قائمة الفئات مع عدد الأصناف في كل فئة."""
    categories = db.query(Category).order_by(Category.name).all()
    counts = dict(
        db.query(Item.category_id, func.count(Item.id))
        .group_by(Item.category_id)
        .all()
    )
    response = []
    for cat in categories:
        response.append({
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "created_at": cat.created_at,
            "items_count": counts.get(cat.id, 0),
        })
    return response


@router.post("", response_model=CategoryResponse)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role("staff")),
):
    """إنشاء فئة جديدة."""
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="اسم الفئة مطلوب")

    existing = db.query(Category).filter(Category.name == name).first()
    if existing:
        raise HTTPException(
            status_code=400, detail=f"الفئة '{name}' موجودة مسبقاً"
        )

    category = Category(name=name, description=data.description)
    db.add(category)
    db.flush()

    db.add(
        ActivityLog(
            action="create",
            entity_type="category",
            entity_id=category.id,
            description=f"إضافة فئة: {category.name}",
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("staff")),
):
    """تعديل فئة."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="الفئة غير موجودة")

    if data.name and data.name.strip() != category.name:
        new_name = data.name.strip()
        existing = (
            db.query(Category)
            .filter(Category.name == new_name, Category.id != category_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400, detail=f"الفئة '{new_name}' موجودة مسبقاً"
            )
        category.name = new_name

    if data.description is not None:
        category.description = data.description

    db.add(
        ActivityLog(
            action="update",
            entity_type="category",
            entity_id=category.id,
            description=f"تعديل فئة: {category.name}",
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """حذف فئة - للمشرف فقط.
    لا يمكن حذف فئة مرتبطة بأصناف."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="الفئة غير موجودة")

    items_count = (
        db.query(Item).filter(Item.category_id == category_id).count()
    )
    if items_count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"لا يمكن حذف الفئة '{category.name}' لوجود {items_count} "
                "صنف مرتبط بها. قم بنقل الأصناف إلى فئة أخرى أولاً."
            ),
        )

    name = category.name
    db.delete(category)
    db.add(
        ActivityLog(
            action="delete",
            entity_type="category",
            entity_id=category_id,
            description=f"حذف فئة: {name}",
            user_id=user.id,
        )
    )
    db.commit()
    return {"message": f"تم حذف الفئة '{name}' بنجاح"}
