from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import (
    get_current_user,
    get_db,
    get_password_hash,
    require_role,
    verify_password,
    validate_password_strength,
)
from ..models import ActivityLog, Transaction, User
from ..schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/api/users", tags=["المستخدمين"])


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class PasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=6)


@router.post("/validate-password")
def validate_password_endpoint(
    payload: PasswordResetRequest,
    user=Depends(get_current_user),
):
    """فحص قوة كلمة المرور قبل إرسال النموذج"""
    is_valid, message = validate_password_strength(payload.new_password)
    return {"valid": is_valid, "message": message}


@router.post("", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    actor=Depends(require_role("admin")),
):
    """إنشاء مستخدم جديد - للمشرف فقط"""
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="اسم المستخدم موجود مسبقاً")

    # Validation of password strength
    is_valid, msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    hashed = get_password_hash(user_data.password)
    user = User(username=user_data.username, password_hash=hashed, role=user_data.role)
    db.add(user)
    db.commit()
    db.refresh(user)

    # تسجيل النشاط
    log = ActivityLog(
        action="create",
        entity_type="user",
        entity_id=user.id,
        description=f"إضافة مستخدم: {user.username} ({user.role})",
        user_id=actor.id,
    )
    db.add(log)
    db.commit()
    return user


@router.get("/me", response_model=UserResponse)
def get_me(user=Depends(get_current_user)):
    """الحصول على معلومات المستخدم الحالي"""
    return user


@router.get("", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """قائمة بجميع المستخدمين - للمشرف فقط"""
    return db.query(User).all()


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    actor=Depends(require_role("admin")),
):
    """تعديل بيانات مستخدم - للمشرف فقط"""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if data.username:
        # التحقق من أن الاسم الجديد غير مستخدم
        conflict = (
            db.query(User)
            .filter(User.username == data.username, User.id != user_id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail="اسم المستخدم موجود مسبقاً")
        target.username = data.username
    if data.role and data.role != target.role:
        # منع المشرف من إسقاط صلاحيته أو إزالة آخر مشرف في النظام
        if target.role == "admin":
            if target.id == actor.id:
                raise HTTPException(
                    status_code=400, detail="لا يمكنك تغيير صلاحية حسابك الخاص"
                )
            admin_count = db.query(User).filter(User.role == "admin").count()
            if admin_count <= 1:
                raise HTTPException(
                    status_code=400, detail="لا يمكن إزالة آخر مشرف في النظام"
                )
        target.role = data.role
    if data.password:
        target.password_hash = get_password_hash(data.password)
    db.commit()
    db.refresh(target)

    # تسجيل النشاط
    log = ActivityLog(
        action="update",
        entity_type="user",
        entity_id=target.id,
        description=f"تعديل مستخدم: {target.username} ({target.role})",
        user_id=actor.id,
    )
    db.add(log)
    db.commit()
    return target


@router.put("/me/password")
def change_my_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """تغيير كلمة المرور للمستخدم الحالي"""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=400, detail="كلمة المرور الحالية غير صحيحة"
        )
    user.password_hash = get_password_hash(payload.new_password)
    db.commit()

    log = ActivityLog(
        action="update",
        entity_type="user",
        entity_id=user.id,
        description="تغيير كلمة المرور الخاصة",
        user_id=user.id,
    )
    db.add(log)
    db.commit()
    return {"message": "تم تغيير كلمة المرور بنجاح"}


@router.put("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
    actor=Depends(require_role("admin")),
):
    """إعادة تعيين كلمة مرور مستخدم - للمشرف فقط"""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    target.password_hash = get_password_hash(payload.new_password)
    db.commit()

    log = ActivityLog(
        action="update",
        entity_type="user",
        entity_id=target.id,
        description=f"إعادة تعيين كلمة مرور المستخدم: {target.username}",
        user_id=actor.id,
    )
    db.add(log)
    db.commit()
    return {"message": "تم إعادة تعيين كلمة المرور بنجاح"}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor=Depends(require_role("admin")),
):
    """حذف مستخدم - للمشرف فقط"""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if target.id == actor.id:
        raise HTTPException(
            status_code=400, detail="لا يمكنك حذف حسابك الخاص"
        )
    if target.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400, detail="لا يمكن حذف آخر مشرف في النظام"
            )

    username = target.username
    # فك ارتباط السجلات التاريخية بدل حذفها للحفاظ على سجل الحركات
    db.query(Transaction).filter(Transaction.user_id == user_id).update(
        {Transaction.user_id: None}
    )
    db.query(ActivityLog).filter(ActivityLog.user_id == user_id).update(
        {ActivityLog.user_id: None}
    )
    db.delete(target)
    db.commit()

    log = ActivityLog(
        action="delete",
        entity_type="user",
        entity_id=user_id,
        description=f"حذف مستخدم: {username}",
        user_id=actor.id,
    )
    db.add(log)
    db.commit()
    return {"message": "تم حذف المستخدم بنجاح"}
