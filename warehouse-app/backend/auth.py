import os
import re
import warnings
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import User

# Read SECRET_KEY from environment. Fall back to a development default so the
# app keeps booting if the env var is missing, but emit a clear warning.
_DEV_SECRET = "dev-insecure-secret-key-do-not-use-in-production"
SECRET_KEY = os.environ.get("WAREHOUSE_SECRET_KEY", _DEV_SECRET)
if SECRET_KEY == _DEV_SECRET:
    warnings.warn(
        "WAREHOUSE_SECRET_KEY غير مضبوط - يتم استخدام مفتاح تطوير غير آمن. "
        "اضبط المتغير قبل التشغيل في بيئة الإنتاج.",
        RuntimeWarning,
        stacklevel=2,
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.environ.get("WAREHOUSE_TOKEN_EXPIRE_MINUTES", str(60 * 24))  # 24 hours default
)

security = HTTPBearer()

# Brute force protection settings
MAX_LOGIN_ATTEMPTS = int(os.environ.get("WAREHOUSE_MAX_LOGIN_ATTEMPTS", "5"))
LOCKOUT_DURATION_MINUTES = int(os.environ.get("WAREHOUSE_LOCKOUT_DURATION_MINUTES", "15"))
_login_attempts = defaultdict(list)  # In-memory store for login attempts (use Redis in production)


def is_account_locked(username: str) -> bool:
    """Check if account is locked due to too many failed attempts."""
    now = datetime.now(timezone.utc)
    attempts = _login_attempts.get(username, [])

    # Remove attempts older than lockout duration
    attempts = [ts for ts in attempts if now - ts < timedelta(minutes=LOCKOUT_DURATION_MINUTES)]
    _login_attempts[username] = attempts  # Update with cleaned attempts

    return len(attempts) >= MAX_LOGIN_ATTEMPTS


def record_failed_attempt(username: str):
    """Record a failed login attempt."""
    _login_attempts[username].append(datetime.now(timezone.utc))


def clear_failed_attempts(username: str):
    """Clear failed attempts after successful login."""
    if username in _login_attempts:
        del _login_attempts[username]


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password strength.
    Returns (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "يجب أن تكون كلمة المرور على الأقل 8 أحرف"

    if not re.search(r"[A-Z]", password):
        return False, "يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل"

    if not re.search(r"[a-z]", password):
        return False, "يجب أن تحتوي كلمة المرور على حرف صغير واحد على الأقل"

    if not re.search(r"\d", password):
        return False, "يجب أن تحتوي كلمة المرور على رقم واحد على الأقل"

    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "يجب أن تحتوي كلمة المرور على رمز خاص واحد على الأقل (!@#$%^&*(),.?\":{}|<>)"

    return True, "كلمة المرور قوية"


# ... existing code ...


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode("utf-8")
    if isinstance(plain_password, str):
        plain_password = plain_password.encode("utf-8")
    # bcrypt يقصر كلمة المرور على 72 بايت ويرفض ما زاد عن ذلك
    plain_password = plain_password[:72]
    try:
        return bcrypt.checkpw(plain_password, hashed_password)
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    if isinstance(password, str):
        password = password.encode("utf-8")
    password = password[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password, salt)
    return hashed.decode("utf-8")


def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("username")
        role: Optional[str] = payload.get("role")
        user_id: Optional[int] = payload.get("user_id")
        if username is None or user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def require_role(required_role: str):
    """Dependency factory: user must have at least the required role (hierarchical)."""
    role_hierarchy = {"viewer": 0, "staff": 1, "admin": 2}

    def role_dependency(user=Depends(get_current_user)):
        if role_hierarchy.get(user.role, 0) < role_hierarchy.get(required_role, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return role_dependency
