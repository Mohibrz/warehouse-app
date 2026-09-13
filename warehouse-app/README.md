# نظام إدارة المخازن - Warehouse Management System (WMS)

نظام إدارة مخازن متكامل مبني بـ Python و FastAPI مع واجهة عربية RTL.

## المميزات

- ✅ إدارة الأصناف (إضافة/تعديل/حذف) مع توليد رمز SKU تلقائي
- ✅ إدارة المستودعات
- ✅ حركات المخزون (دخول/خروج/نقل/تعديل) مع عكس دقيق عند الحذف أو التعديل
- ✅ تتبع المخزون الحالي لكل صنف في كل مستودع
- ✅ تنبيهات المخزون المنخفض
- ✅ **مسح الباركود بكاميرا الجهاز** (QR, Code128, EAN, UPC, ITF)
- ✅ توليد وطباعة الباركود و QR للأصناف
- ✅ تصدير Excel وطباعة التقارير
- ✅ لوحة معلومات مع رسوم بيانية
- ✅ إدارة المستخدمين وسجل النشاطات
- ✅ نسخ احتياطي لقاعدة البيانات
- ✅ نظام مصادقة JWT وأذونات متدرجة
- ✅ REST API متكامل مع رسائل خطأ عربية
- ✅ الوصول الآمن عبر Tailscale

## المتطلبات

- Python 3.10+
- Tailscale (للوصول عن بُعد - اختياري)
- كاميرا (لمسح الباركود - اختياري)

## التثبيت

```bash
cd warehouse-app
python -m venv venv

# تفعيل البيئة (Windows)
venv\Scripts\activate

pip install -r backend/requirements.txt
```

## الإعداد (متغيرات البيئة)

كل المتغيرات اختيارية، لكن يجب ضبط أول متغيرين قبل الاستخدام الفعلي:

| المتغير | الافتراضي | الوصف |
|---------|-----------|-------|
| `WAREHOUSE_SECRET_KEY` | مفتاح تطوير (يصدر تحذيراً) | مفتاح توقيع JWT - **اضبطه في الإنتاج** |
| `WAREHOUSE_ADMIN_PASSWORD` | `admin123` | كلمة مرور حساب admin عند إنشائه لأول مرة |
| `WAREHOUSE_DB_PATH` | `<جذر المشروع>/warehouse.db` | مسار ملف قاعدة البيانات |
| `WAREHOUSE_TOKEN_EXPIRE_MINUTES` | `1440` (24 ساعة) | مدة صلاحية الرمز المميز |
| `WAREHOUSE_CORS_ORIGINS` | فارغ | نطاقات إضافية مسموح بها، مفصولة بفواصل |

مثال (PowerShell):

```powershell
$env:WAREHOUSE_SECRET_KEY = "ضع-هنا-مفتاحاً-عشوائياً-طويلاً"
$env:WAREHOUSE_ADMIN_PASSWORD = "كلمة-مرور-قوية"
```

## التشغيل

```bash
# السكربت الجاهز (ينشئ البيئة ويشغّل السيرفر على المنفذ 9000)
run.bat

# أو يدوياً
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
```

### الوصول عبر Tailscale

```bash
tailscale up
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
tailscale serve 9000
```

## الوصول

| البيئة | الرابط |
|-------|--------|
| **الواجهة** | http://localhost:9000/app/ |
| **Tailscale** | https://desktop-vlbl3dk.tail4614ad.ts.net |
| **وثائق API** | http://localhost:9000/docs |
| **فحص الصحة** | http://localhost:9000/health |

الجذر `/` يعيد التوجيه تلقائياً إلى `/app/`.

## بيانات الدخول الافتراضية

- **اسم المستخدم:** `admin`
- **كلمة المرور:** `admin123` (أو قيمة `WAREHOUSE_ADMIN_PASSWORD`)

يُنشأ هذا الحساب مرة واحدة فقط عند أول تشغيل على قاعدة بيانات فارغة.

## هيكل المشروع

```
warehouse-app/
├── backend/
│   ├── main.py           # نقطة الدخول، تسجيل الدخول، معالجات الأخطاء
│   ├── models.py         # نماذج قاعدة البيانات (SQLAlchemy)
│   ├── schemas.py        # نماذج Pydantic
│   ├── database.py       # الاتصال + ترقيات المخطط الخفيفة
│   ├── auth.py           # JWT، تشفير كلمات المرور، الأدوار
│   ├── i18n.py           # تعريب رسائل الفاليديشن
│   └── routers/
│       ├── users.py
│       ├── warehouses.py
│       ├── items.py
│       ├── transactions.py
│       ├── stock.py
│       ├── alerts.py
│       ├── activity_logs.py
│       └── backup.py
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js        # إعدادات مشتركة (API_BASE_URL، getAuthHeaders، escapeHtml)
│       ├── app.js        # منطق التطبيق الرئيسي
│       └── barcode.js    # ماسح الباركود
├── backups/              # النسخ الاحتياطية (تُنشأ تلقائياً)
├── warehouse.db          # قاعدة البيانات (تُنشأ تلقائياً)
└── run.bat
```

## الأدوار

الصلاحيات متدرجة: `viewer < staff < admin` — أي صلاحية أعلى تشمل ما دونها.

| الدور | الوصف |
|-------|-------|
| admin | مشرف - صلاحيات كاملة (المستخدمون، الحذف، تعديل الحركات، النسخ الاحتياطي) |
| staff | موظف - إضافة/تعديل الأصناف والمستودعات وتسجيل الحركات |
| viewer | مشاهد - عرض فقط |

## API Endpoints

كل المسارات تحت `/api` تتطلب ترويسة `Authorization: Bearer <token>`.

### المصادقة والمستخدمون

| Method | Endpoint | الصلاحية |
|--------|----------|----------|
| POST | /auth/login | عام |
| GET | /api/users/me | مسجّل دخول |
| GET | /api/users | admin |
| POST | /api/users | admin |
| PUT | /api/users/{id} | admin |
| PUT | /api/users/me/password | مسجّل دخول |
| PUT | /api/users/{id}/reset-password | admin |
| DELETE | /api/users/{id} | admin |

### المستودعات والأصناف

| Method | Endpoint | الصلاحية |
|--------|----------|----------|
| GET | /api/warehouses | viewer |
| GET | /api/warehouses/{id} | viewer |
| POST | /api/warehouses | admin |
| PUT | /api/warehouses/{id} | admin |
| DELETE | /api/warehouses/{id} | admin |
| GET | /api/items | viewer |
| GET | /api/items/{id} | viewer |
| POST | /api/items | staff |
| POST | /api/items/generate-sku | staff |
| PUT | /api/items/{id} | staff |
| DELETE | /api/items/{id} | admin |

### الحركات والمخزون

| Method | Endpoint | الصلاحية |
|--------|----------|----------|
| GET | /api/transactions | viewer |
| GET | /api/transactions/{id} | viewer |
| POST | /api/transactions | staff |
| PUT | /api/transactions/{id} | admin |
| DELETE | /api/transactions/{id} | admin |
| GET | /api/stock | viewer |
| GET | /api/alerts/low-stock | viewer |

### السجلات والنسخ الاحتياطي

| Method | Endpoint | الصلاحية |
|--------|----------|----------|
| GET | /api/activity-logs | admin |
| POST | /api/backup | admin |
| GET | /api/backups | admin |
| GET | /api/backup/{filename}/download | admin |
| DELETE | /api/backup/{filename} | admin |

## أنواع الحركات

| النوع | التأثير على المخزون |
|-------|---------------------|
| `in` | زيادة الكمية في المستودع |
| `out` | إنقاص الكمية (مع التحقق من الكفاية) |
| `transfer` | إنقاص من المصدر وزيادة في `target_warehouse_id` |
| `adjustment` | ضبط الكمية على قيمة محددة (تُحفظ الكمية السابقة لإمكانية العكس) |

حذف أو تعديل أي حركة يعكس تأثيرها على المخزون تلقائياً.

## إعداد Tailscale

```bash
# 1. التثبيت (Windows)
winget install tailscale

# 2. تسجيل الدخول
tailscale up

# 3. تفعيل Serve
#    افتح https://login.tailscale.com/f/serve وفعّل HTTPS certificates
tailscale serve 9000
```

## ملاحظات الأمان

- ⚠️ اضبط `WAREHOUSE_SECRET_KEY` قبل الإنتاج — النظام يصدر تحذيراً عند استخدام المفتاح الافتراضي
- ⚠️ غيّر كلمة مرور admin الافتراضية فوراً بعد أول تشغيل
- ⚠️ لا تعرّض السيرفر للإنترنت العام مباشرة
- ⚠️ لا ترفع ملف `warehouse.db` أو مجلد `backups/` إلى مستودع عام
- ✅ Tailscale يوفر وصولاً آمناً مشفّراً لأجهزة الشبكة فقط
