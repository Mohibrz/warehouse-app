from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_db
from ..models import ActivityLog, Category, Item, Stock, Transaction, Warehouse

router = APIRouter(prefix="/api/reports", tags=["التقارير المتقدمة"])


@router.get("/inventory-value")
def inventory_value_report(
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """تقرير قيمة المخزون الحالية - مجموع (الكمية × السعر)"""
    query = (
        db.query(
            Item.id,
            Item.name,
            Item.sku,
            Category.name.label("category_name"),
            Item.price,
            Item.unit,
            Warehouse.id.label("warehouse_id"),
            Warehouse.name.label("warehouse_name"),
            Stock.quantity,
        )
        .join(Stock, Stock.item_id == Item.id)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .outerjoin(Category, Item.category_id == Category.id)
    )

    if warehouse_id:
        query = query.filter(Warehouse.id == warehouse_id)

    results = query.all()
    total_value = 0.0
    items_data = []

    for item in results:
        value = float(item.quantity) * float(item.price)
        total_value += value
        items_data.append({
            "item_id": item.id,
            "item_name": item.name,
            "sku": item.sku,
            "category_name": item.category_name,
            "warehouse_id": item.warehouse_id,
            "warehouse_name": item.warehouse_name,
            "quantity": float(item.quantity),
            "unit": item.unit,
            "price": float(item.price),
            "total_value": round(value, 2)
        })

    return {
        "total_value": round(total_value, 2),
        "items": items_data,
        "currency": "IQD"
    }


@router.get("/top-moving-items")
def top_moving_items(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """الأصناف الأكثر حركة (دخول وخروج) في فترة معينة"""
    start_date = datetime.now() - timedelta(days=days)

    # الاستعلام: جمع الكميات حسب الصنف والنوع
    query = (
        db.query(
            Item.id,
            Item.name,
            Item.sku,
            Transaction.type,
            func.sum(Transaction.quantity).label("total_quantity"),
            func.count(Transaction.id).label("transaction_count"),
        )
        .join(Transaction, Transaction.item_id == Item.id)
        .filter(Transaction.date >= start_date)
        .group_by(Item.id, Item.name, Item.sku, Transaction.type)
        .order_by(func.sum(Transaction.quantity).desc())
        .limit(limit)
    )

    results = query.all()

    # تنظيم البيانات حسب الصنف
    items_map = {}
    for r in results:
        if r.id not in items_map:
            items_map[r.id] = {
                "item_id": r.id,
                "item_name": r.name,
                "sku": r.sku,
                "total_in": 0.0,
                "total_out": 0.0,
                "total_transfers": 0.0,
                "transaction_count": 0
            }

        if r.type == "in":
            items_map[r.id]["total_in"] = float(r.total_quantity)
        elif r.type == "out":
            items_map[r.id]["total_out"] = float(r.total_quantity)
        elif r.type == "transfer":
            items_map[r.id]["total_transfers"] = float(r.total_quantity)

        items_map[r.id]["transaction_count"] += r.transaction_count

    items_list = list(items_map.values())
    items_list.sort(key=lambda x: x["total_in"] + x["total_out"], reverse=True)

    return {
        "period_days": days,
        "items": items_list[:limit]
    }


@router.get("/warehouse-utilization")
def warehouse_utilization_report(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """تقرير استخدام المستودعات - عدد الأصناف والكمية الإجمالية"""
    query = (
        db.query(
            Warehouse.id,
            Warehouse.name,
            Warehouse.location,
            func.count(Stock.item_id).label("item_count"),
            func.coalesce(func.sum(Stock.quantity), 0).label("total_quantity"),
        )
        .outerjoin(Stock, Stock.warehouse_id == Warehouse.id)
        .group_by(Warehouse.id, Warehouse.name, Warehouse.location)
        .order_by(func.sum(Stock.quantity).desc())
    )

    results = query.all()

    return {
        "warehouses": [
            {
                "warehouse_id": r.id,
                "warehouse_name": r.name,
                "location": r.location,
                "item_count": r.item_count,
                "total_quantity": float(r.total_quantity or 0)
            }
            for r in results
        ]
    }


@router.get("/category-summary")
def category_summary_report(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """تقرير ملخص حسب الفئة - عدد الأصناف وقيمة المخزون"""
    query = (
        db.query(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.count(Item.id).label("item_count"),
            func.coalesce(func.sum(Stock.quantity), 0).label("total_quantity"),
        )
        .outerjoin(Item, Item.category_id == Category.id)
        .outerjoin(Stock, Stock.item_id == Item.id)
        .group_by(Category.id, Category.name)
    )

    results = query.all()
    total_value_all = 0
    categories = []

    for r in results:
        # حساب قيمة الفئة
        items = db.query(Item).filter(Item.category_id == r.category_id).all() if r.category_id else []
        category_value = 0
        for item in items:
            stocks = db.query(Stock).filter(Stock.item_id == item.id).all()
            for stock in stocks:
                category_value += float(stock.quantity) * float(item.price)

        total_value_all += category_value
        categories.append({
            "category_id": r.category_id,
            "category_name": r.category_name or "بدون فئة",
            "item_count": r.item_count,
            "total_quantity": float(r.total_quantity or 0),
            "total_value": round(category_value, 2)
        })

    categories.sort(key=lambda x: x["total_value"], reverse=True)

    return {
        "total_value": round(total_value_all, 2),
        "categories": categories
    }


@router.get("/daily-movements")
def daily_movements_report(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """تقرير الحركات اليومية - عدد الحركات وقيمتها"""
    start_date = datetime.now() - timedelta(days=days)

    # استعلام: عدد الحركات والكمية لكل يوم
    query = (
        db.query(
            func.date(Transaction.date).label("date"),
            Transaction.type,
            func.count(Transaction.id).label("count"),
            func.sum(Transaction.quantity).label("total_quantity")
        )
        .filter(Transaction.date >= start_date)
        .group_by(func.date(Transaction.date), Transaction.type)
        .order_by(func.date(Transaction.date).desc())
    )

    results = query.all()

    # تنظيم البيانات حسب التاريخ
    daily_data = {}
    for r in results:
        date_str = str(r.date)
        if date_str not in daily_data:
            daily_data[date_str] = {
                "date": date_str,
                "in_count": 0, "in_quantity": 0.0,
                "out_count": 0, "out_quantity": 0.0,
                "transfer_count": 0, "transfer_quantity": 0.0,
                "adjustment_count": 0, "adjustment_quantity": 0.0,
                "total_count": 0
            }

        daily_data[date_str][f"{r.type}_count"] = r.count
        daily_data[date_str][f"{r.type}_quantity"] = float(r.total_quantity or 0)
        daily_data[date_str]["total_count"] += r.count

    return {
        "period_days": days,
        "daily_data": list(daily_data.values())
    }


@router.get("/user-activity")
def user_activity_report(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """تقرير نشاط المستخدمين - عدد العمليات لكل مستخدم"""
    start_date = datetime.now() - timedelta(days=days)

    # نشاط سجلات النظام
    logs_query = (
        db.query(
            ActivityLog.user_id,
            ActivityLog.action,
            func.count(ActivityLog.id).label("count")
        )
        .filter(ActivityLog.timestamp >= start_date)
        .group_by(ActivityLog.user_id, ActivityLog.action)
    )

    # نشاط الحركات
    tx_query = (
        db.query(
            Transaction.user_id,
            func.count(Transaction.id).label("count")
        )
        .filter(Transaction.date >= start_date)
        .group_by(Transaction.user_id)
    )

    # جلب أسماء المستخدمين
    from ..models import User
    users = {u.id: u.username for u in db.query(User).all()}

    users_activity = {}
    for r in logs_query.all():
        if r.user_id not in users_activity:
            users_activity[r.user_id] = {
                "user_id": r.user_id,
                "username": users.get(r.user_id, "مستخدم محذوف"),
                "creates": 0, "updates": 0, "deletes": 0,
                "transactions": 0,
                "total_actions": 0
            }

        if r.action == "create":
            users_activity[r.user_id]["creates"] = r.count
        elif r.action == "update":
            users_activity[r.user_id]["updates"] = r.count
        elif r.action == "delete":
            users_activity[r.user_id]["deletes"] = r.count

        users_activity[r.user_id]["total_actions"] += r.count

    for r in tx_query.all():
        if r.user_id not in users_activity:
            users_activity[r.user_id] = {
                "user_id": r.user_id,
                "username": users.get(r.user_id, "مستخدم محذوف"),
                "creates": 0, "updates": 0, "deletes": 0,
                "transactions": 0,
                "total_actions": 0
            }
        users_activity[r.user_id]["transactions"] = r.count
        users_activity[r.user_id]["total_actions"] += r.count

    user_list = list(users_activity.values())
    user_list.sort(key=lambda x: x["total_actions"], reverse=True)

    return {
        "period_days": days,
        "users": user_list
    }