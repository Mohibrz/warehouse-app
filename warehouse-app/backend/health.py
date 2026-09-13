"""
Health Dashboard - مراقبة حالة النظام.
يعرض معلومات عن قاعدة البيانات، الذاكرة، السيرفر، والإحصائيات.
"""
import os
import time
import psutil
import platform
from datetime import datetime
from typing import Dict, Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import engine, SessionLocal
from .models import Item, Warehouse, Transaction, User, ActivityLog
from .logging_config import get_logger

logger = get_logger(__name__)


def get_system_info() -> Dict[str, Any]:
    """معلومات النظام."""
    return {
        "platform": platform.system(),
        "platform_version": platform.version(),
        "python_version": platform.python_version(),
        "processor": platform.processor() or "Unknown",
        "uptime_seconds": int(time.time() - psutil.boot_time()) if hasattr(psutil, 'boot_time') else 0,
    }


def get_database_stats(db: Session) -> Dict[str, Any]:
    """إحصائيات قاعدة البيانات."""
    try:
        # عدد السجلات
        item_count = db.query(Item).count()
        warehouse_count = db.query(Warehouse).count()
        transaction_count = db.query(Transaction).count()
        user_count = db.query(User).count()
        activity_count = db.query(ActivityLog).count()

        # حجم قاعدة البيانات
        db_path = os.environ.get("WAREHOUSE_DB_PATH")
        if not db_path:
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            db_path = os.path.join(BASE_DIR, "warehouse.db")

        db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0

        return {
            "status": "connected",
            "records": {
                "items": item_count,
                "warehouses": warehouse_count,
                "transactions": transaction_count,
                "users": user_count,
                "activity_logs": activity_count,
            },
            "size_bytes": db_size,
            "size_mb": round(db_size / (1024 * 1024), 2),
        }
    except Exception as e:
        logger.error(f"خطأ في جلب إحصائيات قاعدة البيانات: {e}")
        return {
            "status": "error",
            "error": str(e),
            "records": {},
            "size_bytes": 0,
            "size_mb": 0,
        }


def get_server_stats() -> Dict[str, Any]:
    """إحصائيات السيرفر."""
    try:
        # استخدام الذاكرة
        memory = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=0.1)

        return {
            "cpu_percent": round(cpu_percent, 1),
            "memory": {
                "total_mb": round(memory.total / (1024 * 1024), 0),
                "used_mb": round(memory.used / (1024 * 1024), 0),
                "available_mb": round(memory.available / (1024 * 1024), 0),
                "percent": memory.percent,
            },
            "disk": {
                "total_gb": round(psutil.disk_usage('/').total / (1024 ** 3), 1),
                "used_gb": round(psutil.disk_usage('/').used / (1024 ** 3), 1),
                "free_gb": round(psutil.disk_usage('/').free / (1024 ** 3), 1),
                "percent": psutil.disk_usage('/').percent,
            },
        }
    except Exception as e:
        logger.error(f"خطأ في جلب إحصائيات السيرفر: {e}")
        return {
            "cpu_percent": 0,
            "memory": {"total_mb": 0, "used_mb": 0, "available_mb": 0, "percent": 0},
            "disk": {"total_gb": 0, "used_gb": 0, "free_gb": 0, "percent": 0},
        }


def get_recent_activities(db: Session, limit: int = 10) -> list:
    """سجل آخر النشاطات."""
    try:
        activities = (
            db.query(ActivityLog)
            .order_by(ActivityLog.timestamp.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": a.id,
                "action": a.action,
                "entity_type": a.entity_type,
                "entity_id": a.entity_id,
                "description": a.description,
                "user_id": a.user_id,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            }
            for a in activities
        ]
    except Exception as e:
        logger.error(f"خطأ في جلب النشاطات: {e}")
        return []


def check_api_health() -> Dict[str, Any]:
    """فحص صحة الـ API."""
    checks = {}

    # فحص قاعدة البيانات
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = {"status": "healthy", "latency_ms": 0}
    except Exception as e:
        checks["database"] = {"status": "unhealthy", "error": str(e)}

    # فحص الذاكرة
    memory = psutil.virtual_memory()
    if memory.percent > 90:
        checks["memory"] = {"status": "warning", "percent": memory.percent}
    else:
        checks["memory"] = {"status": "healthy", "percent": memory.percent}

    # فحص القرص
    disk = psutil.disk_usage('/')
    if disk.percent > 90:
        checks["disk"] = {"status": "warning", "percent": disk.percent}
    else:
        checks["disk"] = {"status": "healthy", "percent": disk.percent}

    return checks


def get_full_health_report() -> Dict[str, Any]:
    """تقرير صحي شامل للنظام."""
    db = SessionLocal()
    try:
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "system": get_system_info(),
            "database": get_database_stats(db),
            "server": get_server_stats(),
            "api_checks": check_api_health(),
            "recent_activities": get_recent_activities(db),
        }
    finally:
        db.close()
