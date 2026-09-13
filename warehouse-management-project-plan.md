# Project Implementation Plan: Warehouse Management System (WMS)
### A ready-to-use instruction file to hand to an AI assistant (e.g. Claude Code) to build the project step by step

> **Note:** This planning document is written in English, but **the application itself (UI, labels, messages) must be built in Arabic**, since the end users are Arabic speakers. All instructions below explicitly call this out wherever relevant.

---

## 1. Research Summary

Modern Warehouse Management Systems (WMS) in 2026 rely on:

- **Cloud-native / composable architecture** instead of monolithic closed systems, making updates and scaling easier.
- **Real-time inventory tracking**: SKU-level quantities, locations inside the warehouse, and automatic alerts when stock is low or excessive.
- **Receiving & dispatch operations**: goods receiving, storage, picking, packing, and shipping.
- **Barcode / QR code scanning** to speed up stocktaking and dispatch while reducing human error.
- **Dashboards & analytics**: current stock status, item movement history, slow-moving items, and performance metrics.
- **Multi-level user permissions** (admin, warehouse keeper, view-only user).
- **API integration** with other systems (accounting, sales, ERP).

Based on this research, the plan below describes a **simplified, practical application** covering these core functions, built with **Python** (server/API), **HTML/CSS/JS** (web interface), and a **REST API**, running as a **Web App** accessible only from devices connected to your private **Tailscale** network — without opening any public ports or exposing a public IP.

---

## 2. Project Overview (context to give the AI)

> **Goal:** Build a Warehouse Management Web App using Python for the backend and HTML/CSS/JavaScript for the frontend, connected via a REST API, running locally on a server and accessible only through the private Tailscale network (no public internet exposure).

> **Language requirement:** The application's user interface — all page labels, buttons, form fields, messages, and reports — must be written **in Arabic** (RTL layout). Code (variable names, comments, API field names) can remain in English for maintainability, but everything the end user sees must be in Arabic.

---

## 3. Functional Requirements

1. **Item Management**
   - Add / edit / delete items (name, SKU code, unit of measure, minimum stock threshold, price, category) — all displayed in Arabic in the UI.
2. **Warehouses & Locations**
   - Support multiple warehouses, with shelves/locations inside each one.
3. **Stock Transactions**
   - Stock In
   - Stock Out
   - Transfer between warehouses
   - Stock Adjustment
4. **Alerts**
   - Alert when an item reaches its minimum stock threshold.
5. **Users & Permissions**
   - Login system with roles: Admin / Warehouse Keeper / View-only.
6. **Reports**
   - Current stock report, movement history for a specific item, items below minimum threshold.
7. **API**
   - All operations above exposed via REST API (JSON) so they can later be integrated with other systems.
8. **Access via Tailscale**
   - The app runs on the server and is only usable by devices connected to the same Tailscale network (tailnet).

---

## 4. Proposed Tech Stack

| Layer | Suggested Technology |
|---|---|
| Backend / API | Python + **FastAPI** (faster, with automatic Swagger docs, easier than Flask) |
| Database | **SQLite** initially (simple, no separate server needed) — upgradeable to PostgreSQL later |
| ORM | SQLAlchemy |
| Authentication | JWT (JSON Web Token) + hashed passwords (bcrypt) |
| Frontend | HTML + CSS + JavaScript (Fetch API), with **RTL layout and Arabic text** — no heavy framework needed at first; React can be added later if the app grows |
| Server runtime | Uvicorn (to run FastAPI) |
| Private networking | Tailscale — to connect the server only to authorized devices |
| Auto API docs | Swagger UI (comes built-in with FastAPI at `/docs`) |

---

## 5. Suggested Project Folder Structure

```
warehouse-app/
│
├── backend/
│   ├── main.py                # FastAPI entry point
│   ├── models.py               # Database models (SQLAlchemy)
│   ├── schemas.py              # Data validation models (Pydantic)
│   ├── database.py             # Database connection setup
│   ├── auth.py                  # Login and JWT tokens
│   ├── routers/
│   │   ├── items.py             # Item-related API routes
│   │   ├── warehouses.py        # Warehouse-related API routes
│   │   ├── transactions.py      # Stock transaction API routes
│   │   └── users.py             # User-related API routes
│   └── requirements.txt
│
├── frontend/                    # All pages/text below must be in Arabic (RTL)
│   ├── index.html               # Main dashboard (لوحة التحكم)
│   ├── login.html               # تسجيل الدخول
│   ├── items.html               # إدارة الأصناف
│   ├── transactions.html        # حركات المخزون
│   ├── css/
│   │   └── style.css            # include `direction: rtl;` and an Arabic-friendly font
│   └── js/
│       ├── api.js               # Functions to call the API
│       └── app.js
│
├── warehouse.db                 # SQLite database (auto-created)
└── README.md
```

---

## 6. Implementation Steps (phase-by-phase task sequence for the AI)

### Phase 1 — Environment & Project Setup
1. Create a Python virtual environment (venv).
2. Install libraries: `fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `python-jose`, `passlib[bcrypt]`, `python-multipart`.
3. Create the folder structure shown above.

### Phase 2 — Database & Models
1. Design the database tables:
   - `users` (id, username, password_hash, role)
   - `warehouses` (id, name, location)
   - `items` (id, sku, name, category, unit, min_stock, price)
   - `stock` (id, item_id, warehouse_id, quantity)
   - `transactions` (id, item_id, warehouse_id, type[in/out/transfer/adjustment], quantity, date, user_id, notes)
2. Build the models in `models.py` using SQLAlchemy.
3. Build `schemas.py` for input/output validation (Pydantic). Error messages returned to the frontend should be in Arabic.

### Phase 3 — Authentication System
1. Create a `/auth/login` endpoint that returns a JWT token.
2. Protect all API routes so they require a valid token.
3. Enable role-based permissions (admin / warehouse keeper / view-only).

### Phase 4 — Building the REST API
1. **Items:** `GET/POST/PUT/DELETE /items`
2. **Warehouses:** `GET/POST/PUT/DELETE /warehouses`
3. **Stock transactions:** `POST /transactions` (in, out, transfer, adjustment) + `GET /transactions` for history
4. **Current stock:** `GET /stock` (filterable by warehouse or item)
5. **Alerts:** `GET /alerts/low-stock`
6. Verify every endpoint works using the automatic Swagger docs at `/docs`.

### Phase 5 — Frontend (Arabic UI)
1. Login page (`login.html`) — Arabic labels ("اسم المستخدم", "كلمة المرور", "تسجيل الدخول") — calls `/auth/login` and stores the token.
2. Main dashboard (`index.html`) — shows total items, low-stock alerts, and recent transactions, all labeled in Arabic ("إجمالي الأصناف", "تنبيهات النقص", "آخر الحركات").
3. Item management page (`items.html`) with an Arabic table + add/edit form.
4. Stock transactions page (`transactions.html`) for recording in/out/transfer operations, all in Arabic.
5. A unified `js/api.js` file handling all fetch requests and attaching the token in the header.
6. Make sure the HTML `<html>` tag uses `dir="rtl" lang="ar"`, and the CSS uses an Arabic-friendly font (e.g., "Tajawal", "Cairo", or "Noto Sans Arabic").

### Phase 6 — Local Testing
1. Run the server: `uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload`
2. Browse `http://localhost:8000/docs` to verify all API endpoints work.
3. Open the frontend and confirm it connects correctly to the API (update the API base URL in `api.js` if needed).
4. Test scenarios: adding an item, login/logout, a stock-in and stock-out transaction, and a low-stock alert appearing — verify all displayed text renders correctly in Arabic.

### Phase 7 — Connecting the App to Tailscale
1. Install Tailscale on the server that will run the app (preferably a device that stays on continuously, such as a Raspberry Pi, a home server, or a private VPS).
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
2. Log in with your Tailscale account — the device will get a private IP address like `100.x.x.x`.
3. Run the app bound to `0.0.0.0` (not `127.0.0.1`) so it's reachable within the Tailscale network:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
4. **Preferred and safest option:** use `tailscale serve` to expose the app over HTTPS automatically, without opening any port to the outside world:
   ```bash
   tailscale serve https / http://127.0.0.1:8000
   ```
   This makes the app available only at an address like `https://device-name.tailnet-name.ts.net`, reachable exclusively from devices inside the same Tailscale network.
5. Install Tailscale on the other devices (computer, phone) you want to access the app from, and log in with the same account or invite them as members of the same tailnet.
6. Make sure the app is never bound to a port exposed to the public internet (no NAT, no port forwarding) — access should be through Tailscale only.

### Phase 8 — Future Enhancements (optional)
- Add barcode scanning support via the phone's camera (a JS library reading barcodes in the browser).
- Export reports to Excel/PDF (with Arabic text support).
- Upgrade from SQLite to PostgreSQL as data volume grows.
- Run the app as a persistent service (systemd service) so it starts automatically on server reboot.
- Set up periodic database backups.

---

## 7. Important Security Notes

- Do not expose the app on `0.0.0.0` with the port forwarded on your router's firewall — rely entirely on Tailscale to restrict access.
- Use strong, hashed passwords (bcrypt); never store plain-text passwords.
- Enable role-based permissions (admin/staff) so not every user can delete or modify sensitive data.
- Take regular backups of the `warehouse.db` database file.

---

## 8. How to Use This File

Copy the full content of this file and give it to the AI assistant that will implement the code (e.g., Claude Code or any coding assistant), and ask it to start with **Phase 1**, then move sequentially through the following phases — one phase at a time — reviewing and testing the code after each phase before moving to the next. Remember to remind it explicitly that **all user-facing text in the app must be in Arabic**.
