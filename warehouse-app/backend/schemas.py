from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ---- User Schemas ----

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    role: str = Field(default="staff", pattern="^(admin|staff|viewer)$")

    class Config:
        json_schema_extra = {
            "example": {"username": "أحمد", "password": "secure123", "role": "admin"}
        }


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[str] = Field(None, pattern="^(admin|staff|viewer)$")


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---- Warehouse Schemas ----

class WarehouseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    location: Optional[str] = Field(None, max_length=200)

    class Config:
        json_schema_extra = {
            "example": {"name": "المستودع الرئيسي", "location": "الطابق الأرضي"}
        }


class WarehouseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    location: Optional[str] = Field(None, max_length=200)


class WarehouseResponse(BaseModel):
    id: int
    name: str
    location: Optional[str]

    class Config:
        from_attributes = True


# ---- Category Schemas ----

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: Optional[datetime] = None
    items_count: int = 0

    class Config:
        from_attributes = True


# ---- Item Schemas ----

# ---- Item Schemas ----
class ItemCreate(BaseModel):
    sku: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    category_id: Optional[int] = Field(None, gt=0)
    unit: str = Field(default="وحدة")
    min_stock: float = Field(default=0.0, ge=0)
    price: float = Field(default=0.0, ge=0)
    warehouse_id: Optional[int] = Field(None, gt=0)
    initial_quantity: float = Field(default=0.0, ge=0)
    transaction_notes: Optional[str] = Field(None, max_length=500)
    # ✅ حقل جديد
    image_path: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "sku": "SKU001",
                "name": "شاشة لابتوب",
                "category_id": 1,
                "unit": "قطعة",
                "min_stock": 5.0,
                "price": 1500.0,
                "initial_quantity": 100.0,
                "transaction_notes": "رصيد افتتاحي",
            }
        }

class ItemUpdate(BaseModel):
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category_id: Optional[int] = Field(None, gt=0)
    unit: Optional[str] = None
    min_stock: Optional[float] = Field(None, ge=0)
    price: Optional[float] = Field(None, ge=0)
    warehouse_id: Optional[int] = Field(None, gt=0)
    # ✅ حقل جديد
    image_path: Optional[str] = None

class ItemResponse(BaseModel):
    id: int
    sku: str
    name: str
    category_id: Optional[int]
    category_name: Optional[str] = None
    unit: str
    min_stock: float
    price: float
    warehouse_id: Optional[int]
    # ✅ حقل جديد
    image_path: Optional[str] = None

    class Config:
        from_attributes = True
        
# ---- Stock Schemas ----

class StockResponse(BaseModel):
    id: int
    quantity: float
    item_id: int
    warehouse_id: int
    item_name: Optional[str] = None
    warehouse_name: Optional[str] = None

    class Config:
        from_attributes = True


# ---- Transaction Schemas ----

class TransactionCreate(BaseModel):
    type: str = Field(..., pattern="^(in|out|transfer|adjustment|credit|damaged)$")
    quantity: float = Field(..., gt=0)
    item_id: int = Field(..., gt=0)
    warehouse_id: int = Field(..., gt=0)
    notes: Optional[str] = Field(None, max_length=500)
    # For transfers
    target_warehouse_id: Optional[int] = Field(None, gt=0)

    class Config:
        json_schema_extra = {
            "example": {
                "type": "in",
                "quantity": 100.0,
                "item_id": 1,
                "warehouse_id": 1,
                "notes": "شحنة واردة من المورد",
            }
        }


class TransactionUpdate(BaseModel):
    type: Optional[str] = Field(None, pattern="^(in|out|transfer|adjustment|credit|damaged)$")
    quantity: Optional[float] = Field(None, gt=0)
    item_id: Optional[int] = Field(None, gt=0)
    warehouse_id: Optional[int] = Field(None, gt=0)
    notes: Optional[str] = Field(None, max_length=500)
    target_warehouse_id: Optional[int] = Field(None, gt=0)


class TransactionResponse(BaseModel):
    id: int
    type: str
    quantity: float
    date: datetime
    notes: Optional[str]
    item_id: int
    warehouse_id: int
    target_warehouse_id: Optional[int] = None
    user_id: Optional[int]
    item_name: Optional[str] = None
    warehouse_name: Optional[str] = None

    class Config:
        from_attributes = True


# ---- Alert Schemas ----

class AlertResponse(BaseModel):
    item_id: int
    item_name: str
    sku: str
    current_stock: float
    min_stock: float
    warehouse_name: str
    warehouse_id: int
    status: str


# ---- Activity Log Schemas ----

class ActivityLogResponse(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    description: Optional[str] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


# ---- Notification Schemas ----

class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    item_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    is_read: int
    is_dismissed: int
    created_at: datetime
    read_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationCountResponse(BaseModel):
    total: int
    unread: int
    low_stock: int