from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="staff")  # admin / staff / viewer
    created_at = Column(DateTime, server_default=func.now(), nullable=True)

    transactions = relationship("Transaction", back_populates="user")
    activity_logs = relationship("ActivityLog", back_populates="user")


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)

    items = relationship("Item", back_populates="warehouse", cascade="all, delete-orphan")
    stock = relationship("Stock", back_populates="warehouse", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="warehouse", foreign_keys="Transaction.warehouse_id")
    shelves = relationship("Shelf", back_populates="warehouse", cascade="all, delete-orphan")


class Shelf(Base):
    __tablename__ = "shelves"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # اسم/رقم الرف
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)

    warehouse = relationship("Warehouse", back_populates="shelves")
    items = relationship("Item", back_populates="shelf")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    items = relationship("Item", back_populates="category")


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    unit = Column(String, nullable=False, default="unit")
    min_stock = Column(Float, default=0.0)
    price = Column(Float, default=0.0)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)  # ✅ حقل جديد للرف
    
    # ✅ حقل جديد للصورة
    image_path = Column(String, nullable=True)
    
    warehouse = relationship("Warehouse", back_populates="items")
    category = relationship("Category", back_populates="items")
    shelf = relationship("Shelf", back_populates="items")
    stock = relationship("Stock", back_populates="item", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="item")

class Stock(Base):
    __tablename__ = "stock"
    # صف واحد فقط لكل (صنف، مستودع) - يمنع تكرار سجلات المخزون
    __table_args__ = (
        UniqueConstraint("item_id", "warehouse_id", name="uq_stock_item_warehouse"),
    )

    id = Column(Integer, primary_key=True, index=True)
    quantity = Column(Float, default=0.0)

    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)

    item = relationship("Item", back_populates="stock")
    warehouse = relationship("Warehouse", back_populates="stock")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transactions_date", "date"),)

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # in / out / transfer / adjustment
    quantity = Column(Float, nullable=False)
    date = Column(DateTime, server_default=func.now())
    notes = Column(String, nullable=True)
    # الكمية التي كانت في المخزون قبل حركة "adjustment" - تسمح بعكسها بدقة.
    previous_quantity = Column(Float, nullable=True)

    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    # For "transfer" type: destination warehouse. NULL for in/out/adjustment.
    target_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)  # ✅ حقل جديد للرف (للحركة)

    item = relationship("Item", back_populates="transactions")
    warehouse = relationship("Warehouse", back_populates="transactions", foreign_keys=[warehouse_id])
    target_warehouse = relationship("Warehouse", foreign_keys=[target_warehouse_id])
    user = relationship("User", back_populates="transactions")
    shelf = relationship("Shelf", foreign_keys=[shelf_id])


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)  # create, update, delete
    entity_type = Column(String, nullable=False)  # item, warehouse, transaction, user
    entity_id = Column(Integer, nullable=True)
    description = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="activity_logs")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # low_stock, system, info
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    is_read = Column(Integer, default=0)  # 0 = unread, 1 = read
    is_dismissed = Column(Integer, default=0)  # 0 = active, 1 = dismissed
    created_at = Column(DateTime, server_default=func.now())
    read_at = Column(DateTime, nullable=True)
    dismissed_at = Column(DateTime, nullable=True)

    item = relationship("Item", foreign_keys=[item_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])