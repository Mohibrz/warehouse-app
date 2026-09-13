"""
تعريب رسائل أخطاء Pydantic والفالديشن.
يحوّل رسائل الخطأ الإنجليزية الافتراضية إلى عربية واضحة للمستخدم.
"""
from typing import Any, Dict, List


# قاموس ترجمات لأنواع الفالديشن الشائعة
_VALIDATION_TRANSLATIONS = {
    # String
    "string_too_short": "يجب أن يحتوي {field_label} على {min_length} حرف على الأقل",
    "string_too_long": "يجب أن لا يتجاوز {field_label} {max_length} حرف",
    "string_pattern_mismatch": "{field_label} غير صالح",
    # Number
    "greater_than": "يجب أن يكون {field_label} أكبر من {gt}",
    "greater_than_equal": "يجب أن يكون {field_label} {ge} أو أكبر",
    "less_than": "يجب أن يكون {field_label} أصغر من {lt}",
    "less_than_equal": "يجب أن يكون {field_label} {le} أو أصغر",
    "value_error": "قيمة غير صالحة لـ {field_label}",
    # Missing / required
    "missing": "{field_label} مطلوب",
    # UUID / type
    "uuid_parsing": "معرّف غير صالح",
    "int_parsing": "يجب أن يكون {field_label} رقم صحيح",
    "float_parsing": "يجب أن يكون {field_label} رقم",
    "bool_parsing": "يجب أن يكون {field_label} صحيح أو خطأ",
    # Other
    "extra_forbidden": "حقول إضافية غير مسموح بها",
}


# ترجمة أسماء الحقول للعربية
_FIELD_LABELS = {
    "username": "اسم المستخدم",
    "password": "كلمة المرور",
    "role": "الصلاحية",
    "name": "الاسم",
    "sku": "رمز الصنف",
    "category": "الفئة",
    "unit": "الوحدة",
    "min_stock": "الحد الأدنى للمخزون",
    "price": "السعر",
    "quantity": "الكمية",
    "type": "النوع",
    "item_id": "الصنف",
    "warehouse_id": "المستودع",
    "target_warehouse_id": "مستودع الهدف",
    "notes": "الملاحظات",
    "location": "الموقع",
    "current_password": "كلمة المرور الحالية",
    "new_password": "كلمة المرور الجديدة",
}


def _humanize_field(field_path: str) -> str:
    """يحوّل اسم الحقل التقني إلى اسم بشي بالعربية."""
    # الحقل الأخير في الـ path (مثل body.username -> username)
    last_field = field_path.split(".")[-1] if field_path else ""
    # إزالة prefix مثل "body_" أو "query_"
    last_field = last_field.replace("body_", "").replace("query_", "")

    if last_field in _FIELD_LABELS:
        return _FIELD_LABELS[last_field]

    # fallback: تحويل snake_case إلى نص مقروء
    return last_field.replace("_", " ")


def _translate_error(error: Dict[str, Any]) -> str:
    """يترجم خطأ Pydantic واحد إلى رسالة عربية."""
    error_type = error.get("type", "")
    loc = error.get("loc", [])
    field_path = ".".join(str(x) for x in loc)
    field_label = _humanize_field(field_path)

    ctx = error.get("ctx", {})
    msg_template = _VALIDATION_TRANSLATIONS.get(error_type)

    if msg_template:
        try:
            # بناء السياق للترجمة
            format_ctx = {"field_label": field_label}
            if "min_length" in ctx:
                format_ctx["min_length"] = ctx["min_length"]
            if "max_length" in ctx:
                format_ctx["max_length"] = ctx["max_length"]
            if "gt" in ctx:
                format_ctx["gt"] = ctx["gt"]
            if "ge" in ctx:
                format_ctx["ge"] = ctx["ge"]
            if "lt" in ctx:
                format_ctx["lt"] = ctx["lt"]
            if "le" in ctx:
                format_ctx["le"] = ctx["le"]
            return msg_template.format(**format_ctx)
        except (KeyError, IndexError):
            pass

    # رسائل خاصة حسب error_type
    if error_type == "string_too_short":
        min_len = ctx.get("min_length", 3)
        return f"يجب أن يحتوي {field_label} على {min_len} حرف على الأقل"
    if error_type == "string_too_long":
        max_len = ctx.get("max_length", 50)
        return f"يجب أن لا يتجاوز {field_label} {max_len} حرف"
    if error_type == "missing":
        return f"{field_label} مطلوب"
    if error_type == "extra_forbidden":
        return "حقول إضافية غير مسموح بها"
    if error_type == "value_error" and "pattern" in str(error.get("msg", "")).lower():
        return f"{field_label} غير صالح"
    if "string" in error_type and "short" in error_type:
        return f"{field_label} قصير جداً"
    if "int" in error_type or "float" in error_type or "decimal" in error_type:
        return f"يجب أن يكون {field_label} رقماً صالحاً"
    if "uuid" in error_type:
        return "معرّف غير صالح"
    if "bool" in error_type:
        return f"يجب أن يكون {field_label} صحيح أو خطأ"
    if "enum" in error_type:
        return f"{field_label} يجب أن يكون إحدى القيم المسموحة"

    # Fallback: استخدم الرسالة الأصلية لكن بترجمة اسم الحقل
    original = error.get("msg", "قيمة غير صالحة")
    return f"{field_label}: {original}"


def translate_validation_errors(errors: List[Dict[str, Any]]) -> str:
    """يترجم قائمة أخطاء Pydantic إلى رسالة عربية واحدة أو أكثر."""
    if not errors:
        return "بيانات غير صالحة"

    translated = [_translate_error(err) for err in errors]
    # إذا كان خطأ واحد، أرجعه كما هو
    if len(translated) == 1:
        return translated[0]
    # إذا كان أكثر، اربطها بـ " و "
    return " ، ".join(translated)
