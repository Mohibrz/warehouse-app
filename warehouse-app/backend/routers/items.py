import os
import uuid
import random
import string
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_db, require_role
from ..models import ActivityLog, Category, Item, Stock, Transaction, Warehouse
from ..schemas import ItemCreate, ItemResponse, ItemUpdate

router = APIRouter(prefix="/api/items", tags=["الأصناف"])


class GenerateSKURequest(BaseModel):
    category: str | None = None


def generate_unique_sku(db: Session, category: str = None) -> str:
    """توليد رمز SKU فريد بصيغة: ITM-YYMMDD-XXXX"""
    today = datetime.now().strftime("%y%m%d")

    # البادئة بناءً على الفئة (اختياري)
    prefix = "ITM"
    if category:
        cat_clean = category.strip().upper()
        if cat_clean and len(cat_clean) <= 4 and cat_clean.isalpha():
            prefix = cat_clean

    # محاولة إيجاد رمز فريد (بحد أقصى 50 محاولة)
    for _ in range(50):
        random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        candidate = f"{prefix}-{today}-{random_part}"
        if not db.query(Item).filter(Item.sku == candidate).first():
            return candidate

    # Fallback: استخدم timestamp
    return f"{prefix}-{today}-{datetime.now().strftime('%H%M%S')}"


# ==================== دوال رفع وحذف الصور ====================

@router.post("/{item_id}/image")
async def upload_item_image(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("staff")),
):
    """رفع صورة لصنف معين"""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")

    # التحقق من نوع الملف
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="نوع الملف غير مدعوم. يُسمح بـ: JPG, PNG, WebP, GIF"
        )

    # قراءة المحتوى للتحقق من الحجم (5MB كحد أقصى)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="حجم الصورة يجب أن لا يتجاوز 5MB")

    # إنشاء اسم فريد للملف
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"item_{item_id}_{uuid.uuid4().hex[:8]}{ext}"
    
    # تحديد مسار الحفظ (مجلد uploads في جذر المشروع)
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    project_root = os.path.dirname(backend_dir)
    upload_dir = os.path.join(project_root, "uploads", "items")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)

    # حذف الصورة القديمة إن وُجدت
    if item.image_path:
        old_path = os.path.join(project_root, item.image_path.lstrip("/"))
        if os.path.exists(old_path):
            os.remove(old_path)

    # حفظ الملف الجديد
    with open(file_path, "wb") as f:
        f.write(content)

    # تحديث المسار في قاعدة البيانات
    item.image_path = f"/uploads/items/{filename}"
    
    # تسجيل النشاط
    db.add(
        ActivityLog(
            action="update",
            entity_type="item",
            entity_id=item.id,
            description=f"رفع صورة للصنف: {item.name} ({item.sku})",
            user_id=current_user.id,
        )
    )
    
    db.commit()
    db.refresh(item)

    return {"message": "تم رفع الصورة بنجاح", "image_path": item.image_path}


@router.delete("/{item_id}/image")
def delete_item_image(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("staff")),
):
    """حذف صورة صنف"""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")

    if item.image_path:
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        project_root = os.path.dirname(backend_dir)
        old_path = os.path.join(project_root, item.image_path.lstrip("/"))
        if os.path.exists(old_path):
            os.remove(old_path)
        item.image_path = None
        
        # تسجيل النشاط
        db.add(
            ActivityLog(
                action="update",
                entity_type="item",
                entity_id=item.id,
                description=f"حذف صورة الصنف: {item.name} ({item.sku})",
                user_id=current_user.id,
            )
        )
        
        db.commit()

    return {"message": "تم حذف الصورة بنجاح"}


# ==================== دوال الأصناف الأساسية ====================

@router.post("", response_model=ItemResponse)
def create_item(
    data: ItemCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role("staff")),
):
    """إضافة صنف جديد - إذا لم يتم توفير SKU يتم توليده تلقائياً."""
    sku = (data.sku or "").strip()
    if not sku:
        sku = generate_unique_sku(db, None)
    elif db.query(Item).filter(Item.sku == sku).first():
        raise HTTPException(
            status_code=400,
            detail=f"رمز الصنف '{sku}' مستخدم مسبقاً. اختر رمزاً آخر أو اتركه فارغاً للتوليد التلقائي.",
        )

    name_clean = data.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="اسم المادة مطلوب")

    name_normalized = name_clean.lower()
    existing = db.query(Item).filter(Item.name != None, Item.id != None).all()
    for existing_item in existing:
        if existing_item.name and existing_item.name.strip().lower() == name_normalized:
            raise HTTPException(
                status_code=400,
                detail=f"الصنف '{data.name}' موجود مسبقاً في النظام.",
            )

    warehouse_id = data.warehouse_id
    category_id = data.category_id

    if data.initial_quantity > 0 and warehouse_id is None:
        raise HTTPException(
            status_code=400,
            detail="يجب تحديد المستودع عند إدخال كمية ابتدائية أكبر من صفر",
        )

    if warehouse_id is not None:
        if not db.query(Warehouse).filter(Warehouse.id == warehouse_id).first():
            raise HTTPException(status_code=404, detail="المستودع غير موجود")

    item = Item(
        sku=sku,
        name=name_clean,
        category_id=category_id,
        unit=data.unit,
        min_stock=data.min_stock,
        price=data.price,
        warehouse_id=warehouse_id,
    )
    db.add(item)
    db.flush()

    if warehouse_id is not None:
        stock = Stock(quantity=0, item_id=item.id, warehouse_id=warehouse_id)
        db.add(stock)
        db.flush()

        if data.initial_quantity > 0:
            stock.quantity = data.initial_quantity
            transaction_notes = data.transaction_notes or f"رصيد افتتاحي عند إضافة الصنف"
            transaction = Transaction(
                type="in",
                quantity=data.initial_quantity,
                item_id=item.id,
                warehouse_id=warehouse_id,
                notes=transaction_notes,
                user_id=user.id,
            )
            db.add(transaction)
            db.flush()

            db.add(
                ActivityLog(
                    action="create",
                    entity_type="transaction",
                    entity_id=transaction.id,
                    description=f"حركة دخول تلقائية: {data.initial_quantity} من الصنف {item.name} ({item.sku})",
                    user_id=user.id,
                )
            )

    activity_description = f"إضافة صنف: {item.name} ({item.sku})"
    if data.initial_quantity > 0 and warehouse_id is not None:
        activity_description += f" مع رصيد افتتاحي {data.initial_quantity}"

    db.add(
        ActivityLog(
            action="create",
            entity_type="item",
            entity_id=item.id,
            description=activity_description,
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(item)
    
    return ItemResponse(
        id=item.id,
        sku=item.sku,
        name=item.name,
        category_id=item.category_id,
        category_name=item.category.name if item.category else None,
        unit=item.unit,
        min_stock=item.min_stock,
        price=item.price,
        warehouse_id=item.warehouse_id,
        image_path=item.image_path, # ✅ إضافة مسار الصورة
    )


@router.post("/generate-sku")
def generate_sku(
    body: GenerateSKURequest = None,
    db: Session = Depends(get_db),
    user=Depends(require_role("staff")),
):
    """توليد رمز SKU فريد"""
    category = body.category if body else None
    return {"sku": generate_unique_sku(db, category)}


@router.get("", response_model=list[ItemResponse])
def list_items(
    sku: str = None,
    name: str = None,
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """قائمة الأصناف"""
    query = db.query(Item, Category.name.label("category_name")) \
        .outerjoin(Category, Item.category_id == Category.id)
    if sku:
        query = query.filter(Item.sku == sku)
    if name:
        query = query.filter(Item.name.contains(name))
    rows = query.order_by(Item.id).offset(offset).limit(limit).all()
    
    return [
        ItemResponse(
            id=item.id,
            sku=item.sku,
            name=item.name,
            category_id=item.category_id,
            category_name=cat_name,
            unit=item.unit,
            min_stock=item.min_stock,
            price=item.price,
            warehouse_id=item.warehouse_id,
            image_path=item.image_path, # ✅ إضافة مسار الصورة
        )
        for item, cat_name in rows
    ]


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """الحصول على صنف"""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")
    return ItemResponse(
        id=item.id,
        sku=item.sku,
        name=item.name,
        category_id=item.category_id,
        category_name=item.category.name if item.category else None,
        unit=item.unit,
        min_stock=item.min_stock,
        price=item.price,
        warehouse_id=item.warehouse_id,
        image_path=item.image_path, # ✅ إضافة مسار الصورة
    )


@router.put("/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    data: ItemUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("staff")),
):
    """تعديل صنف"""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")

    if data.sku and data.sku != item.sku:
        conflict = db.query(Item).filter(Item.sku == data.sku, Item.id != item_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail=f"رمز الصنف '{data.sku}' مستخدم مسبقاً")
        item.sku = data.sku
        
    if data.name:
        name_clean = data.name.strip()
        if not name_clean:
            raise HTTPException(status_code=400, detail="اسم المادة مطلوب")
        new_name = name_clean.lower()
        existing = db.query(Item).filter(Item.id != item_id, Item.name != None).all()
        for other in existing:
            if other.name and other.name.strip().lower() == new_name:
                raise HTTPException(status_code=400, detail=f"الصنف '{data.name}' موجود مسبقاً.")
        item.name = name_clean
        
    if data.category_id is not None:
        item.category_id = data.category_id if data.category_id > 0 else None
    if data.unit:
        item.unit = data.unit
    if data.min_stock is not None:
        item.min_stock = data.min_stock
    if data.price is not None:
        item.price = data.price
    if data.warehouse_id is not None:
        if not db.query(Warehouse).filter(Warehouse.id == data.warehouse_id).first():
            raise HTTPException(status_code=404, detail="المستودع غير موجود")
        item.warehouse_id = data.warehouse_id
        exists = db.query(Stock).filter(Stock.item_id == item.id, Stock.warehouse_id == data.warehouse_id).first()
        if not exists:
            db.add(Stock(quantity=0, item_id=item.id, warehouse_id=data.warehouse_id))

    db.add(
        ActivityLog(
            action="update",
            entity_type="item",
            entity_id=item.id,
            description=f"تعديل صنف: {item.name} ({item.sku})",
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(item)
    
    return ItemResponse(
        id=item.id,
        sku=item.sku,
        name=item.name,
        category_id=item.category_id,
        category_name=item.category.name if item.category else None,
        unit=item.unit,
        min_stock=item.min_stock,
        price=item.price,
        warehouse_id=item.warehouse_id,
        image_path=item.image_path, # ✅ إضافة مسار الصورة
    )


@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """حذف صنف - للمشرف فقط"""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")

    tx_count = db.query(Transaction).filter(Transaction.item_id == item_id).count()
    if tx_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"لا يمكن حذف الصنف لوجود {tx_count} حركة مرتبطة به.",
        )

    # ✅ حذف صورة الصنف من القرص إن وُجدت
    if item.image_path:
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        project_root = os.path.dirname(backend_dir)
        old_path = os.path.join(project_root, item.image_path.lstrip("/"))
        if os.path.exists(old_path):
            os.remove(old_path)

    item_name = item.name
    item_sku = item.sku
    db.query(Stock).filter(Stock.item_id == item_id).delete()
    db.delete(item)

    db.add(
        ActivityLog(
            action="delete",
            entity_type="item",
            entity_id=item_id,
            description=f"حذف صنف: {item_name} ({item_sku})",
            user_id=user.id,
        )
    )
    db.commit()
    return {"message": "تم حذف الصنف بنجاح"}