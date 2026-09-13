import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

# مسار قاعدة البيانات مثبّت على جذر المشروع وليس على مجلد التشغيل الحالي،
# حتى لا يُنشأ ملف قاعدة بيانات فارغ عند تشغيل السيرفر من مجلد آخر.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get("WAREHOUSE_DB_PATH", os.path.join(BASE_DIR, "warehouse.db"))

SQLALCHEMY_DATABASE_URL = "sqlite:///{}".format(DB_PATH.replace("\\", "/"))

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ترقيات بسيطة للمخطط: SQLite لا يضيف الأعمدة الجديدة للجداول الموجودة
# عبر ``create_all``، لذا نضيفها يدوياً عند الإقلاع.
_SCHEMA_UPGRADES = {
    "transactions": {
        "previous_quantity": "FLOAT",
    },
    # ✅ ترحيل عمود الصورة
    "items": {
        "image_path": "VARCHAR",
    },
}


def ensure_schema():
    """يضيف الأعمدة الناقصة للجداول القديمة (ترحيل خفيف لقواعد SQLite الحالية)."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, columns in _SCHEMA_UPGRADES.items():
            if table not in existing_tables:
                continue
            present = {col["name"] for col in inspector.get_columns(table)}
            for column, column_type in columns.items():
                if column not in present:
                    conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
                    )
