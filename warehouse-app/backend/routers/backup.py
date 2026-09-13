import os
import re
import shutil
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from ..auth import require_role
from ..database import DB_PATH

router = APIRouter(prefix="/api", tags=["النسخ الاحتياطي"])

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKUP_DIR = os.path.join(PROJECT_ROOT, "backups")

# أسماء النسخ التي ينشئها النظام فقط
_BACKUP_NAME_RE = re.compile(r"^warehouse-backup-\d{8}_\d{6}\.db$")


def _safe_backup_path(filename: str) -> str:
    """يتحقق من اسم الملف ويرجع مساراً آمناً داخل مجلد النسخ."""
    if not _BACKUP_NAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="اسم ملف غير صالح")
    path = os.path.abspath(os.path.join(BACKUP_DIR, filename))
    # حماية إضافية ضد الخروج من المجلد عبر روابط رمزية
    if os.path.commonpath([path, os.path.abspath(BACKUP_DIR)]) != os.path.abspath(BACKUP_DIR):
        raise HTTPException(status_code=400, detail="اسم ملف غير صالح")
    return path


@router.post("/backup")
def create_backup(user=Depends(require_role("admin"))):
    """إنشاء نسخة احتياطية من قاعدة البيانات"""
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="قاعدة البيانات غير موجودة")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup_path = os.path.join(BACKUP_DIR, f"warehouse-backup-{timestamp}.db")
    shutil.copy2(DB_PATH, backup_path)

    return {
        "message": "تم إنشاء النسخة الاحتياطية بنجاح",
        "filename": os.path.basename(backup_path),
        "size": os.path.getsize(backup_path),
    }


@router.get("/backups")
def list_backups(user=Depends(require_role("admin"))):
    """قائمة النسخ الاحتياطية"""
    if not os.path.isdir(BACKUP_DIR):
        return []

    backups = []
    for filename in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if not filename.endswith(".db"):
            continue
        filepath = os.path.join(BACKUP_DIR, filename)
        backups.append({
            "filename": filename,
            "size": os.path.getsize(filepath),
            "created": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat(),
        })
    return backups


@router.get("/backup/{filename}/download")
def download_backup(filename: str, user=Depends(require_role("admin"))):
    """تنزيل نسخة احتياطية"""
    backup_path = _safe_backup_path(filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="النسخة الاحتياطية غير موجودة")
    return FileResponse(
        backup_path, media_type="application/octet-stream", filename=filename
    )


@router.delete("/backup/{filename}")
def delete_backup(filename: str, user=Depends(require_role("admin"))):
    """حذف نسخة احتياطية"""
    backup_path = _safe_backup_path(filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="النسخة الاحتياطية غير موجودة")

    os.remove(backup_path)
    return {"message": "تم حذف النسخة الاحتياطية بنجاح"}
