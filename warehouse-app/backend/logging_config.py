"""
إعدادات Logging محسّنة للنظام.
يسجّل الأخطاء والعمليات في ملف منفصل مع تدوير تلقائي.
"""
import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime

# مجلد السجلات
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(BASE_DIR, "logs")

# إنشاء مجلد السجلات إذا لم يكن موجوداً
if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR)


def setup_logging():
    """إعداد نظام Logging."""
    # اسم ملف السجلات مع التاريخ
    log_file = os.path.join(LOGS_DIR, f"app_{datetime.now().strftime('%Y%m')}.log")

    # مستوى التسجيل
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()

    # تنسيق السجلات
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # معالج الملف مع التدوير (10MB لكل ملف، 5 ملفات كحد أقصى)
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(getattr(logging, log_level))

    # معالج الكونسول
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(getattr(logging, log_level))

    # جذر الـ logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level))
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)

    return root_logger


# إنشاء logger للاستخدام في الملفات الأخرى
def get_logger(name: str) -> logging.Logger:
    """الحصول على logger باسم محدد."""
    return logging.getLogger(name)


# ==================== سجلات الأخطاء المحمية ====================

class SecurityLogger:
    """تسجيل محاولات الأمان."""

    def __init__(self):
        self.logger = get_logger("security")

    def log_login_attempt(self, username: str, success: bool, ip: str = "unknown"):
        """تسجيل محاولة تسجيل دخول."""
        status = "ناجحة" if success else "فاشلة"
        self.logger.warning(
            f"🔐 محاولة دخول {status}: المستخدم='{username}' | IP={ip}"
        )

    def log_failed_login(self, username: str, ip: str = "unknown"):
        """تسجيل محاولة دخول فاشلة."""
        self.logger.warning(f"❌ تسجيل دخول فاشل: المستخدم='{username}' | IP={ip}")

    def log_unauthorized_access(self, path: str, ip: str = "unknown"):
        """تسجيل محاولة وصول غير مصرّح."""
        self.logger.warning(f"🚫 وصول غير مصرّح: المسار='{path}' | IP={ip}")

    def log_password_change(self, user_id: int, username: str):
        """تسجيل تغيير كلمة المرور."""
        self.logger.info(f"🔑 تغيير كلمة المرور: المستخدم #{user_id} ({username})")

    def log_admin_action(self, admin_id: int, action: str, target: str):
        """تسجيل إجراء مشرف."""
        self.logger.info(f"👤 إجراء مشرف #{admin_id}: {action} → {target}")


# إنشاء instance واحد
security_logger = SecurityLogger()


# ==================== سجلات العمليات ====================

class AuditLogger:
    """تسجيل عمليات النظام."""

    def __init__(self):
        self.logger = get_logger("audit")

    def log_crud_operation(self, operation: str, entity: str, entity_id: int, user_id: int):
        """تسجيل عملية CRUD."""
        ops_arabic = {"create": "إضافة", "update": "تعديل", "delete": "حذف"}
        op_text = ops_arabic.get(operation, operation)
        self.logger.info(f"📝 {op_text} {entity} #{entity_id} بواسطة المستخدم #{user_id}")

    def log_transaction(self, transaction_id: int, tx_type: str, item_id: int, quantity: float, user_id: int):
        """تسجيل حركة مخزون."""
        self.logger.info(
            f"📦 حركة #{transaction_id}: نوع={tx_type} | صنف={item_id} | كمية={quantity} | المستخدم #{user_id}"
        )

    def log_backup(self, backup_id: int, filename: str, size: int):
        """تسجيل نسخة احتياطية."""
        self.logger.info(f"💾 نسخة احتياطية #{backup_id}: {filename} ({size} bytes)")


# إنشاء instance واحد
audit_logger = AuditLogger()
