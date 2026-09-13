"""
اختبارات تلقائية للـ Backend.
تشغيل: pytest tests/
"""
import pytest
import sys
import os

# إضافة مسار المشروع
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.i18n import translate_validation_errors, _translate_error, _humanize_field
from backend.logging_config import get_logger


class TestI18n:
    """اختبارات الترجمة."""

    def test_humanize_field_arabic(self):
        assert _humanize_field("username") == "اسم المستخدم"
        assert _humanize_field("password") == "كلمة المرور"
        assert _humanize_field("body.username") == "اسم المستخدم"

    def test_humanize_field_unknown(self):
        assert _humanize_field("unknown_field") == "unknown field"

    def test_translate_string_too_short(self):
        error = {
            "type": "string_too_short",
            "loc": ["body", "username"],
            "msg": "String should have at least 3 characters",
            "ctx": {"min_length": 3}
        }
        result = _translate_error(error)
        assert "اسم المستخدم" in result
        assert "3" in result

    def test_translate_missing(self):
        error = {
            "type": "missing",
            "loc": ["body", "name"],
            "msg": "Field required"
        }
        result = _translate_error(error)
        assert "مطلوب" in result

    def test_translate_int_parsing(self):
        error = {
            "type": "int_parsing",
            "loc": ["body", "quantity"],
            "msg": "Input should be a valid integer"
        }
        result = _translate_error(error)
        assert "الكمية" in result

    def test_translate_multiple_errors(self):
        errors = [
            {
                "type": "missing",
                "loc": ["body", "username"],
                "msg": "Field required"
            },
            {
                "type": "string_too_short",
                "loc": ["body", "password"],
                "msg": "Too short",
                "ctx": {"min_length": 6}
            }
        ]
        result = translate_validation_errors(errors)
        assert "مطلوب" in result or "كلمة المرور" in result

    def test_translate_empty_errors(self):
        assert translate_validation_errors([]) == "بيانات غير صالحة"


class TestLogging:
    """اختبارات نظام التسجيل."""

    def test_logger_exists(self):
        logger = get_logger("test")
        assert logger is not None
        assert logger.name == "test"

    def test_logger_messages(self, caplog):
        logger = get_logger("test")
        with caplog.at_level("INFO"):
            logger.info("رسالة اختبار")
        assert "رسالة اختبار" in caplog.text


class TestValidators:
    """اختبارات سريعة للصحة."""

    def test_password_hashing(self):
        from backend.auth import get_password_hash, verify_password
        password = "test123456"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True
        assert verify_password("wrong", hashed) is False


class TestSchemas:
    """اختبارات المخططات."""

    def test_login_request_valid(self):
        from backend.schemas import LoginRequest
        req = LoginRequest(username="admin", password="admin123")
        assert req.username == "admin"

    def test_login_request_short_username(self):
        from backend.schemas import UserCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            UserCreate(username="a", password="admin123", role="staff")
