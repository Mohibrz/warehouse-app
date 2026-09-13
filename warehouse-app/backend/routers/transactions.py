from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_db, require_role
from ..models import ActivityLog, Item, Stock, Transaction, Warehouse
from ..schemas import TransactionCreate, TransactionResponse, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["حركات المخزون"])


def get_or_create_stock(db: Session, item_id: int, warehouse_id: int) -> Stock:
    stock = db.query(Stock).filter(
        Stock.item_id == item_id, Stock.warehouse_id == warehouse_id
    ).first()
    if not stock:
        stock = Stock(quantity=0.0, item_id=item_id, warehouse_id=warehouse_id)
        db.add(stock)
        db.flush()
    return stock


def _get_stock(db: Session, item_id: int, warehouse_id: int) -> Stock | None:
    return db.query(Stock).filter(
        Stock.item_id == item_id, Stock.warehouse_id == warehouse_id
    ).first()


def _apply_transaction_effect(db: Session, transaction: Transaction):
    """تطبيق تأثير حركة على المخزون (دخول، خروج، نقل، تعديل، ذمة، تالف)."""
    if transaction.type == "in":
        stock = get_or_create_stock(db, transaction.item_id, transaction.warehouse_id)
        stock.quantity += transaction.quantity
    elif transaction.type == "out":
        stock = get_or_create_stock(db, transaction.item_id, transaction.warehouse_id)
        stock.quantity -= transaction.quantity
    elif transaction.type == "transfer":
        src_stock = get_or_create_stock(db, transaction.item_id, transaction.warehouse_id)
        src_stock.quantity -= transaction.quantity
        if transaction.target_warehouse_id:
            tgt_stock = get_or_create_stock(
                db, transaction.item_id, transaction.target_warehouse_id
            )
            tgt_stock.quantity += transaction.quantity
    elif transaction.type == "adjustment":
        stock = get_or_create_stock(db, transaction.item_id, transaction.warehouse_id)
        # نحفظ الكمية السابقة حتى يمكن عكس التعديل بدقة لاحقاً
        transaction.previous_quantity = stock.quantity
        stock.quantity = transaction.quantity
    elif transaction.type == "credit":
        # الذمة: الصنف يخرج ولا يُخصم من المخزون (يُسجل فقط)
        pass
    elif transaction.type == "damaged":
        # التالف: يُخصم من المخزون
        stock = get_or_create_stock(db, transaction.item_id, transaction.warehouse_id)
        stock.quantity -= transaction.quantity


def _revert_transaction_effect(db: Session, transaction: Transaction):
    """عكس تأثير حركة على المخزون (للحذف أو التعديل)."""
    if transaction.type == "in":
        stock = _get_stock(db, transaction.item_id, transaction.warehouse_id)
        if stock:
            stock.quantity -= transaction.quantity
    elif transaction.type == "out":
        stock = _get_stock(db, transaction.item_id, transaction.warehouse_id)
        if stock:
            stock.quantity += transaction.quantity
    elif transaction.type == "transfer":
        src_stock = _get_stock(db, transaction.item_id, transaction.warehouse_id)
        if src_stock:
            src_stock.quantity += transaction.quantity
        if transaction.target_warehouse_id:
            tgt_stock = _get_stock(
                db, transaction.item_id, transaction.target_warehouse_id
            )
            if tgt_stock:
                tgt_stock.quantity -= transaction.quantity
    elif transaction.type == "adjustment":
        # نُرجع الكمية إلى ما كانت عليه قبل التعديل (إن كانت محفوظة)
        if transaction.previous_quantity is not None:
            stock = _get_stock(db, transaction.item_id, transaction.warehouse_id)
            if stock:
                stock.quantity = transaction.previous_quantity
    elif transaction.type == "credit":
        # الذمة: لا تأثير على المخزون عند الإنشاء، فلا حاجة للتراجع
        pass
    elif transaction.type == "damaged":
        # التالف: نرجع الكمية للمخزون عند الحذف
        stock = _get_stock(db, transaction.item_id, transaction.warehouse_id)
        if stock:
            stock.quantity += transaction.quantity


def _validate_transaction(
    db: Session,
    tx_type: str,
    quantity: float,
    item_id: int,
    warehouse_id: int,
    target_warehouse_id: int | None,
) -> tuple[Item, Warehouse, Warehouse | None]:
    """يتحقق من صحة بيانات الحركة ويُرجع الصنف والمستودعات."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")

    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="مستودع المصدر غير موجود")

    target_warehouse = None
    if tx_type == "transfer":
        if not target_warehouse_id:
            raise HTTPException(status_code=400, detail="مستودع الهدف مطلوب للنقل")
        if target_warehouse_id == warehouse_id:
            raise HTTPException(
                status_code=400, detail="مستودع المصدر والهدف يجب أن يكونا مختلفين"
            )
        target_warehouse = db.query(Warehouse).filter(
            Warehouse.id == target_warehouse_id
        ).first()
        if not target_warehouse:
            raise HTTPException(status_code=404, detail="مستودع الهدف غير موجود")

    # التحقق من كفاية المخزون للخروج والنقل والتالف
    if tx_type in ("out", "transfer", "damaged"):
        stock = _get_stock(db, item_id, warehouse_id)
        available = stock.quantity if stock else 0.0
        if available < quantity:
            raise HTTPException(
                status_code=400,
                detail=f"الكمية المطلوبة ({quantity}) أكبر من المخزون المتاح ({available})",
            )

    return item, warehouse, target_warehouse


def _describe(tx_type: str, quantity: float, item: Item, warehouse: Warehouse,
              target: Warehouse | None) -> str:
    labels = {
        "in": "دخول", "out": "خروج", "transfer": "نقل",
        "adjustment": "تعديل", "credit": "ذمة", "damaged": "تالف",
    }
    label = labels.get(tx_type, tx_type)
    place = f"من {warehouse.name}" if tx_type == "transfer" else f"في {warehouse.name}"
    suffix = f" إلى {target.name}" if target else ""
    return f"حركة {label}: {quantity} من صنف '{item.name}' {place}{suffix}"


@router.post("", response_model=TransactionResponse)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role("staff")),
):
    """تسجيل حركة مخزون (دخول، خروج، نقل، تعديل)"""
    from ..models import Shelf
    
    item, warehouse, target_warehouse = _validate_transaction(
        db,
        data.type,
        data.quantity,
        data.item_id,
        data.warehouse_id,
        data.target_warehouse_id,
    )

    # التحقق من الرف إذا تم تحديده
    shelf = None
    if data.shelf_id is not None and data.shelf_id > 0:
        shelf = db.query(Shelf).filter(Shelf.id == data.shelf_id).first()
        if not shelf:
            raise HTTPException(status_code=404, detail="الرف غير موجود")

    transaction = Transaction(
        type=data.type,
        quantity=data.quantity,
        notes=data.notes,
        item_id=data.item_id,
        warehouse_id=data.warehouse_id,
        target_warehouse_id=(
            data.target_warehouse_id if data.type == "transfer" else None
        ),
        user_id=user.id,
        shelf_id=data.shelf_id if data.shelf_id and data.shelf_id > 0 else None,
    )
    db.add(transaction)
    db.flush()

    _apply_transaction_effect(db, transaction)

    db.add(
        ActivityLog(
            action="create",
            entity_type="transaction",
            entity_id=transaction.id,
            description=_describe(
                data.type, data.quantity, item, warehouse, target_warehouse
            ),
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(transaction)
    return transaction


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    item_id: int = None,
    warehouse_id: int = None,
    type: str = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """قائمة حركات المخزون مع التصفية"""
    from ..models import Shelf
    
    query = db.query(Transaction, Shelf.name.label("shelf_name")).outerjoin(
        Shelf, Transaction.shelf_id == Shelf.id
    )
    if item_id:
        query = query.filter(Transaction.item_id == item_id)
    if warehouse_id:
        query = query.filter(
            (Transaction.warehouse_id == warehouse_id)
            | (Transaction.target_warehouse_id == warehouse_id)
        )
    if type:
        query = query.filter(Transaction.type == type)
    
    results = query.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()
    
    return [
        {
            "id": tx.id,
            "type": tx.type,
            "quantity": tx.quantity,
            "date": tx.date,
            "notes": tx.notes,
            "item_id": tx.item_id,
            "warehouse_id": tx.warehouse_id,
            "target_warehouse_id": tx.target_warehouse_id,
            "shelf_id": tx.shelf_id,
            "shelf_name": shelf_name,
            "user_id": tx.user_id,
            "item_name": tx.item.name if tx.item else None,
            "warehouse_name": tx.warehouse.name if tx.warehouse else None,
        }
        for tx, shelf_name in results
    ]


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """الحصول على حركة واحدة"""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id
    ).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="الحركة غير موجودة")
    return transaction


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """تعديل حركة مخزون - للمشرف فقط، مع عكس الحركة القديمة وتطبيق الجديدة"""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id
    ).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="الحركة غير موجودة")

    # القيم الجديدة (مع الرجوع للقيم الحالية عند عدم إرسالها)
    new_type = data.type or transaction.type
    new_quantity = (
        data.quantity if data.quantity is not None else transaction.quantity
    )
    new_item_id = data.item_id or transaction.item_id
    new_warehouse_id = data.warehouse_id or transaction.warehouse_id
    if new_type == "transfer":
        new_target_warehouse_id = (
            data.target_warehouse_id
            if data.target_warehouse_id is not None
            else transaction.target_warehouse_id
        )
    else:
        new_target_warehouse_id = None

    # عكس تأثير الحركة القديمة أولاً حتى يعكس التحقق المخزون الحقيقي بعد الإلغاء
    _revert_transaction_effect(db, transaction)
    db.flush()

    try:
        item, warehouse, target_warehouse = _validate_transaction(
            db,
            new_type,
            new_quantity,
            new_item_id,
            new_warehouse_id,
            new_target_warehouse_id,
        )
    except HTTPException:
        # التراجع عن عكس الحركة حتى لا يتغيّر المخزون عند فشل التعديل
        db.rollback()
        raise

    transaction.type = new_type
    transaction.quantity = new_quantity
    transaction.item_id = new_item_id
    transaction.warehouse_id = new_warehouse_id
    transaction.target_warehouse_id = new_target_warehouse_id
    transaction.previous_quantity = None
    if data.notes is not None:
        transaction.notes = data.notes

    _apply_transaction_effect(db, transaction)

    db.add(
        ActivityLog(
            action="update",
            entity_type="transaction",
            entity_id=transaction.id,
            description="تعديل "
            + _describe(new_type, new_quantity, item, warehouse, target_warehouse),
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """حذف حركة مخزون - للمشرف فقط، مع عكس تأثيرها على المخزون"""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id
    ).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="الحركة غير موجودة")

    _revert_transaction_effect(db, transaction)

    tx_type = transaction.type
    tx_quantity = transaction.quantity
    db.delete(transaction)

    db.add(
        ActivityLog(
            action="delete",
            entity_type="transaction",
            entity_id=transaction_id,
            description=f"حذف حركة {tx_type} بكمية {tx_quantity}",
            user_id=user.id,
        )
    )
    db.commit()
    return {"message": "تم حذف الحركة بنجاح"}
