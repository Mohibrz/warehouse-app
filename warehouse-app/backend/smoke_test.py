"""
اختبار دخان شامل للنظام - يشغّل على قاعدة بيانات مؤقتة ولا يمسّ warehouse.db

لا يحتاج أي مكتبة إضافية (يستدعي التطبيق عبر ASGI مباشرة، بدون httpx).

التشغيل من جذر المشروع:
    venv\\Scripts\\python.exe backend/smoke_test.py
"""
import asyncio
import json
import os
import sys
import tempfile
import warnings
from urllib.parse import urlsplit

# قاعدة بيانات مؤقتة ومفاتيح اختبار - يجب ضبطها قبل استيراد التطبيق
_TMP_DB = os.path.join(tempfile.gettempdir(), "wms_smoke_test.db")
if os.path.exists(_TMP_DB):
    os.remove(_TMP_DB)
os.environ["WAREHOUSE_DB_PATH"] = _TMP_DB
os.environ.setdefault("WAREHOUSE_SECRET_KEY", "smoke-test-secret-key")
os.environ.setdefault("WAREHOUSE_ADMIN_PASSWORD", "admin123")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
warnings.filterwarnings("ignore")

from backend.main import app  # noqa: E402


class Response:
    def __init__(self, status_code, headers, body):
        self.status_code = status_code
        self.headers = headers
        self.body = body

    @property
    def text(self):
        return self.body.decode("utf-8", errors="replace")

    def json(self):
        return json.loads(self.body)


class AsgiClient:
    """عميل ASGI بسيط - بديل خفيف لـ TestClient بدون الاعتماد على httpx."""

    def __init__(self, app):
        self.app = app
        self._loop = asyncio.new_event_loop()
        self._lifespan_receive = asyncio.Queue()
        self._lifespan_task = None

    def __enter__(self):
        self._loop.run_until_complete(self._startup())
        return self

    def __exit__(self, *exc):
        self._loop.run_until_complete(self._shutdown())
        self._loop.close()
        return False

    async def _startup(self):
        self._lifespan_events = asyncio.Queue()

        async def receive():
            return await self._lifespan_receive.get()

        async def send(message):
            await self._lifespan_events.put(message)

        self._lifespan_task = asyncio.ensure_future(
            self.app({"type": "lifespan", "asgi": {"version": "3.0"}}, receive, send)
        )
        await self._lifespan_receive.put({"type": "lifespan.startup"})
        await self._lifespan_events.get()

    async def _shutdown(self):
        await self._lifespan_receive.put({"type": "lifespan.shutdown"})
        try:
            await asyncio.wait_for(self._lifespan_events.get(), timeout=5)
        except (asyncio.TimeoutError, Exception):
            pass
        if self._lifespan_task:
            self._lifespan_task.cancel()

    def request(self, method, url, json_body=None, headers=None):
        return self._loop.run_until_complete(
            self._request(method, url, json_body, headers)
        )

    async def _request(self, method, url, json_body, headers):
        parts = urlsplit(url)
        raw_headers = [(b"host", b"testserver")]
        for k, v in (headers or {}).items():
            raw_headers.append((k.lower().encode(), v.encode()))

        body = b""
        if json_body is not None:
            body = json.dumps(json_body).encode("utf-8")
            raw_headers.append((b"content-type", b"application/json"))
            raw_headers.append((b"content-length", str(len(body)).encode()))

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": method.upper(),
            "scheme": "http",
            "path": parts.path,
            "raw_path": parts.path.encode(),
            "query_string": parts.query.encode(),
            "root_path": "",
            "headers": raw_headers,
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
        }

        sent = {"status": None, "headers": {}, "body": b""}
        request_done = False

        async def receive():
            nonlocal request_done
            if not request_done:
                request_done = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.disconnect"}

        async def send(message):
            if message["type"] == "http.response.start":
                sent["status"] = message["status"]
                sent["headers"] = {
                    k.decode().lower(): v.decode()
                    for k, v in message.get("headers", [])
                }
            elif message["type"] == "http.response.body":
                sent["body"] += message.get("body", b"")

        await self.app(scope, receive, send)
        return Response(sent["status"], sent["headers"], sent["body"])

    def get(self, url, headers=None):
        return self.request("GET", url, None, headers)

    def post(self, url, json=None, headers=None):
        return self.request("POST", url, json, headers)

    def put(self, url, json=None, headers=None):
        return self.request("PUT", url, json, headers)

    def delete(self, url, headers=None):
        return self.request("DELETE", url, None, headers)


_failures = []
_checks = 0


def check(label, condition, detail=""):
    global _checks
    _checks += 1
    if condition:
        print(f"  [PASS] {label}")
    else:
        print(f"  [FAIL] {label} :: {detail}")
        _failures.append(label)


def main():
    with AsgiClient(app) as c:
        print("\n== المصادقة ==")
        r = c.post("/auth/login", json={"username": "admin", "password": "admin123"})
        check("تسجيل الدخول", r.status_code == 200, r.text[:200])
        if r.status_code != 200:
            return 1
        token = r.json()["access_token"]
        H = {"Authorization": f"Bearer {token}"}

        r = c.post("/auth/login", json={"username": "admin", "password": "wrong"})
        check("رفض كلمة مرور خاطئة", r.status_code == 401, r.text[:120])

        check("رفض الوصول بدون رمز", c.get("/api/warehouses").status_code == 403)
        check("مسار غير موجود يرجع 404", c.get("/api/nope", headers=H).status_code == 404)
        check("فحص الصحة", c.get("/health").json() == {"status": "healthy"})

        print("\n== رسائل الفاليديشن العربية ==")
        r = c.post("/api/items", json={"name": ""}, headers=H)
        detail = r.json().get("detail")
        check("422 برسالة عربية نصية",
              r.status_code == 422 and isinstance(detail, str), r.text[:200])
        print(f"         -> {detail}")

        print("\n== المستودعات ==")
        r = c.post("/api/warehouses", json={"name": "الرئيسي", "location": "أ"}, headers=H)
        check("إنشاء مستودع", r.status_code == 200, r.text[:200])
        wh1 = r.json()["id"]
        wh2 = c.post("/api/warehouses", json={"name": "الفرعي"}, headers=H).json()["id"]

        print("\n== الأصناف ==")
        r = c.post("/api/items", json={"name": "شاشة", "sku": "SKU-1",
                                       "min_stock": 5, "price": 100,
                                       "warehouse_id": wh1}, headers=H)
        check("إنشاء صنف", r.status_code == 200, r.text[:200])
        item = r.json()
        check("ربط الصنف بالمستودع من الـ body", item["warehouse_id"] == wh1, str(item))
        item_id = item["id"]

        r = c.post("/api/items", json={"name": "مكرر", "sku": "SKU-1"}, headers=H)
        check("رفض SKU مكرر", r.status_code == 400, r.text[:200])

        r = c.post("/api/items", json={"name": "بدون رمز"}, headers=H)
        check("توليد SKU تلقائي", r.status_code == 200 and r.json().get("sku"), r.text[:200])

        check("جلب صنف يتطلب مصادقة", c.get(f"/api/items/{item_id}").status_code == 403)

        print("\n== الحركات: دخول/خروج ==")
        r = c.post("/api/transactions", json={"type": "in", "quantity": 50,
                                              "item_id": item_id,
                                              "warehouse_id": wh1}, headers=H)
        check("حركة دخول", r.status_code == 200, r.text[:200])
        tx_in = r.json()["id"]

        def qty(wh):
            rows = c.get(f"/api/stock?item_id={item_id}&warehouse_id={wh}", headers=H).json()
            return rows[0]["quantity"] if rows else 0.0

        check("المخزون بعد الدخول = 50", qty(wh1) == 50, qty(wh1))

        r = c.post("/api/transactions", json={"type": "out", "quantity": 500,
                                              "item_id": item_id,
                                              "warehouse_id": wh1}, headers=H)
        check("رفض خروج أكبر من المتاح", r.status_code == 400, r.text[:200])

        print("\n== إثراء أسماء المخزون ==")
        row = c.get(f"/api/stock?item_id={item_id}", headers=H).json()[0]
        check("stock يحوي item_name", row.get("item_name") == "شاشة", str(row))
        check("stock يحوي warehouse_name", row.get("warehouse_name") == "الرئيسي", str(row))

        print("\n== النقل ==")
        r = c.post("/api/transactions", json={"type": "transfer", "quantity": 20,
                                              "item_id": item_id, "warehouse_id": wh1,
                                              "target_warehouse_id": wh2}, headers=H)
        check("حركة نقل", r.status_code == 200, r.text[:200])
        tx_tr = r.json()["id"]
        check("المصدر = 30 بعد النقل", qty(wh1) == 30, qty(wh1))
        check("الهدف = 20 بعد النقل", qty(wh2) == 20, qty(wh2))

        r = c.post("/api/transactions", json={"type": "transfer", "quantity": 5,
                                              "item_id": item_id, "warehouse_id": wh1,
                                              "target_warehouse_id": wh1}, headers=H)
        check("رفض نقل لنفس المستودع", r.status_code == 400, r.text[:200])

        c.delete(f"/api/transactions/{tx_tr}", headers=H)
        check("حذف النقل يعيد الكميات",
              qty(wh1) == 50 and qty(wh2) == 0, f"{qty(wh1)}/{qty(wh2)}")

        print("\n== التعديل (adjustment) وعكسه ==")
        r = c.post("/api/transactions", json={"type": "adjustment", "quantity": 7,
                                              "item_id": item_id,
                                              "warehouse_id": wh1}, headers=H)
        check("حركة تعديل", r.status_code == 200, r.text[:200])
        tx_adj = r.json()["id"]
        check("المخزون ضُبط على 7", qty(wh1) == 7, qty(wh1))

        c.delete(f"/api/transactions/{tx_adj}", headers=H)
        check("حذف التعديل يعيد المخزون إلى 50", qty(wh1) == 50, qty(wh1))

        print("\n== تعديل حركة مرفوض لا يغيّر المخزون ==")
        before = qty(wh1)
        r = c.put(f"/api/transactions/{tx_in}", json={"type": "out",
                                                     "quantity": 9999}, headers=H)
        check("رفض تعديل غير صالح", r.status_code == 400, r.text[:200])
        check("المخزون لم يتغيّر بعد الرفض", qty(wh1) == before, f"{qty(wh1)} != {before}")

        r = c.put(f"/api/transactions/{tx_in}", json={"quantity": 80}, headers=H)
        check("تعديل ناجح للكمية", r.status_code == 200, r.text[:200])
        check("المخزون = 80 بعد التعديل", qty(wh1) == 80, qty(wh1))

        print("\n== التنبيهات ==")
        c.post("/api/transactions", json={"type": "adjustment", "quantity": 2,
                                          "item_id": item_id,
                                          "warehouse_id": wh1}, headers=H)
        alerts = c.get("/api/alerts/low-stock", headers=H).json()
        check("تنبيه مخزون منخفض",
              any(a["item_id"] == item_id for a in alerts), str(alerts)[:200])

        print("\n== المستخدمون والصلاحيات ==")
        r = c.post("/api/users", json={"username": "موظف", "password": "pass123",
                                       "role": "staff"}, headers=H)
        check("إنشاء موظف", r.status_code == 200, r.text[:200])
        staff_id = r.json()["id"]

        SH = {"Authorization": "Bearer " + c.post(
            "/auth/login", json={"username": "موظف",
                                 "password": "pass123"}).json()["access_token"]}
        check("الموظف ممنوع من سجل النشاطات",
              c.get("/api/activity-logs", headers=SH).status_code == 403)
        check("الموظف ممنوع من حذف صنف",
              c.delete(f"/api/items/{item_id}", headers=SH).status_code == 403)
        check("الموظف يستطيع تسجيل حركة",
              c.post("/api/transactions", json={"type": "in", "quantity": 1,
                                                "item_id": item_id,
                                                "warehouse_id": wh1},
                     headers=SH).status_code == 200)

        r = c.put(f"/api/users/{staff_id}", json={"password": "newpass123"}, headers=H)
        check("تعديل كلمة مرور مستخدم", r.status_code == 200, r.text[:200])
        check("كلمة المرور الجديدة تعمل",
              c.post("/auth/login", json={"username": "موظف",
                                          "password": "newpass123"}).status_code == 200)

        admin_id = c.get("/api/users/me", headers=H).json()["id"]
        check("منع تغيير صلاحية النفس",
              c.put(f"/api/users/{admin_id}", json={"role": "staff"},
                    headers=H).status_code == 400)
        check("منع حذف النفس",
              c.delete(f"/api/users/{admin_id}", headers=H).status_code == 400)

        print("\n== سجل النشاطات ==")
        logs = c.get("/api/activity-logs", headers=H).json()
        check("السجل غير فارغ", len(logs) > 0)
        check("السجل يحوي اسم المستخدم",
              any(entry.get("username") for entry in logs), str(logs[:1])[:200])

        print("\n== النسخ الاحتياطي ==")
        r = c.post("/api/backup", headers=H)
        check("إنشاء نسخة احتياطية", r.status_code == 200, r.text[:200])
        fname = r.json()["filename"]
        check("لا يسرّب المسار المطلق", "path" not in r.json(), str(r.json()))
        check("رفض اسم ملف خبيث",
              c.delete("/api/backup/evil.db", headers=H).status_code == 400,
              "المتوقع 400 لاسم لا يطابق نمط النسخ")
        check("تنزيل النسخة",
              c.get(f"/api/backup/{fname}/download", headers=H).status_code == 200)
        check("حذف النسخة", c.delete(f"/api/backup/{fname}", headers=H).status_code == 200)

        print("\n== قيود الحذف ==")
        check("منع حذف صنف له حركات",
              c.delete(f"/api/items/{item_id}", headers=H).status_code == 400)
        check("منع حذف مستودع له حركات",
              c.delete(f"/api/warehouses/{wh1}", headers=H).status_code == 400)

    print("\n" + "=" * 46)
    if _failures:
        print(f"فشل {len(_failures)} من أصل {_checks} فحصاً:")
        for f in _failures:
            print(f"  - {f}")
        return 1
    print(f"نجحت جميع الفحوصات ({_checks}/{_checks})")
    return 0


if __name__ == "__main__":
    try:
        code = main()
    finally:
        if os.path.exists(_TMP_DB):
            try:
                os.remove(_TMP_DB)
            except OSError:
                pass
    sys.exit(code)
