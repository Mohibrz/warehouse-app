import os
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import models
from .auth import create_access_token, get_db, require_role, verify_password, is_account_locked, record_failed_attempt, clear_failed_attempts, validate_password_strength
from .database import Base, SessionLocal, engine, ensure_schema
from .health import get_full_health_report
from .i18n import translate_validation_errors
from .logging_config import audit_logger, security_logger, setup_logging
from .routers import (
    activity_logs,
    alerts,
    backup,
    categories,
    items,
    notifications,
    reports,
    shelves,
    stock,
    transactions,
    users,
    warehouses,
)
from .schemas import LoginRequest, TokenResponse

# Setup logging
setup_logging()
logger = setup_logging()

# Create database tables + apply light schema upgrades
Base.metadata.create_all(bind=engine)
ensure_schema()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create default admin user on first run if no users exist."""
    db = SessionLocal()
    try:
        from .auth import get_password_hash
        if not db.query(models.User).first():
            admin = models.User(
                username="admin",
                password_hash=get_password_hash(
                    os.environ.get("WAREHOUSE_ADMIN_PASSWORD", "admin123")
                ),
                role="admin",
            )
            db.add(admin)
            db.commit()
            print("Created default admin user: username='admin'")
    finally:
        db.close()
    yield

app = FastAPI(
    title="Warehouse Management System",
    description="نظام إدارة المخازن - REST API",
    version="1.0.0",
    lifespan=lifespan,
)

# --- Custom Exception Handlers for Arabic error messages ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """يعالج أخطاء الفاليديشن ويرجع رسائل عربية."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": translate_validation_errors(exc.errors())},
    )

# Allow frontend served separately / local dev.
_extra_origins = [
    origin.strip()
    for origin in os.environ.get("WAREHOUSE_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:9000",
        "http://127.0.0.1:9000",
        *_extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers FIRST (API should take priority)
app.include_router(users.router)
app.include_router(warehouses.router)
app.include_router(categories.router)
app.include_router(items.router)
app.include_router(transactions.router)
app.include_router(stock.router)
app.include_router(alerts.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(activity_logs.router)
app.include_router(backup.router)
app.include_router(shelves.router)

@app.post("/auth/login", response_model=TokenResponse)
def login(form_data: LoginRequest, db: Session = Depends(get_db)):
    """تسجيل الدخول - إرجاع JWT token"""
    # Brute Force Protection
    if is_account_locked(form_data.username):
        security_logger.log_unauthorized_login(form_data.username)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="🔒 تم إغلاق الحساب مؤقتاً بسبب محاولات دخول كثيرة. حاول مرة أخرى بعد 15 دقيقة.",
        )
    
    user = (
        db.query(models.User)
        .filter(models.User.username == form_data.username)
        .first()
    )
    if not user or not verify_password(form_data.password, user.password_hash):
        record_failed_attempt(form_data.username)
        security_logger.log_failed_login(form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم المستخدم أو كلمة المرور غير صحيحة",
        )
    
    security_logger.log_login_attempt(user.username, success=True)
    clear_failed_attempts(user.username)
    
    token = create_access_token(
        data={"username": user.username, "role": user.role, "user_id": user.id}
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "role": user.role},
    }

@app.get("/")
def root():
    return RedirectResponse(url="/app/", status_code=307)

@app.get("/health")
def health_check():
    """فحص بسيط للحالة"""
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/health-dashboard")
def health_dashboard_page():
    """صفحة لوحة المراقبة (HTML)"""
    frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "health.html")
    if os.path.exists(frontend_path):
        return FileResponse(frontend_path, media_type="text/html")
    return {"error": "Health dashboard page not found"}

@app.get("/admin/health-dashboard")
def health_dashboard(
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    """لوحة المراقبة - للمديرين فقط"""
    return get_full_health_report()

# ==========================================
# ✅ تعريف المسارات ومجلدات الملفات الثابتة
# ==========================================
backend_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(backend_dir)

# 1. إنشاء مجلد الصور إذا لم يكن موجوداً
uploads_dir = os.path.join(project_root, "uploads", "items")
os.makedirs(uploads_dir, exist_ok=True)

# 2. تقديم مجلد uploads كملفات ثابتة (يجب أن يكون قبل mount الواجهة الأمامية)
app.mount("/uploads", StaticFiles(directory=os.path.join(project_root, "uploads")), name="uploads")

# 3. تقديم واجهة المستخدم الأمامية
frontend_path = os.path.join(project_root, "frontend")
if os.path.isdir(frontend_path):
    app.mount("/app", StaticFiles(directory=frontend_path, html=True), name="frontend")