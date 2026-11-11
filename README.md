# Inventory Pro — Production-Ready Enterprise Inventory Management System

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/inventory-pro/inventory-pro)
[![Test Suite](https://img.shields.io/badge/tests-9%20passed-success.svg)](https://github.com/inventory-pro/inventory-pro)
[![Prisma ORM](https://img.shields.io/badge/ORM-Prisma%206-blue.svg)](https://www.prisma.io/)
[![Next.js](https://img.shields.io/badge/framework-Next.js%2014-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL%2016-336791.svg)](https://www.postgresql.org/)

**Inventory Pro** is a mission-critical, multi-tenant inventory, procurement, and point-of-sale (POS) operating system engineered for enterprise warehouses, retail chains, and supply-chain logistics.

Unlike superficial admin dashboard prototypes, Inventory Pro implements a **permanent, immutable double-entry stock ledger**, multi-warehouse balance isolation, safe atomic database transactions, barcode hardware scanning, bulk CSV data engine with formula injection defense, and rich financial reporting (FIFO / Weighted Average COGS, Gross Profit Margin, Sales Velocity).

---

## 🏗️ System Architecture & Technology Stack

```
                               ┌──────────────────────────────────────────────────────────┐
                               │                    INVENTORY PRO                         │
                               │           Next.js 14 App Router + React 18               │
                               └────────────┬─────────────────────────────┬───────────────┘
                                            │                             │
                     ┌──────────────────────┴──────┐               ┌──────┴──────────────────────┐
                     │         Frontend UI         │               │     RESTful API Gateway     │
                     │  - Tailwind CSS + Lucide    │               │  - Route Handlers (/api/v1) │
                     │  - Recharts Visualizations  │               │  - JWT Auth + RBAC Guards   │
                     │  - Barcode Scanner Modal    │               │  - Zod Input Sanitization   │
                     │  - Printable Thermal Receipt│               │  - CSV Bulk Data Engine     │
                     └─────────────────────────────┘               └──────────────┬──────────────┘
                                                                                  │
                                                                   ┌──────────────┴──────────────┐
                                                                   │    Prisma ORM Services      │
                                                                   │  - Stock Ledger Service     │
                                                                   │  - Alert & Velocity Engine  │
                                                                   │  - Financial Reporting      │
                                                                   └──────────────┬──────────────┘
                                                                                  │
                                              ┌───────────────────────────────────┴───────────────────┐
                                              ▼                                                       ▼
                               ┌─────────────────────────────┐                         ┌─────────────────────────────┐
                               │     PostgreSQL 16 Engine    │                         │       Redis 7 Cache         │
                               │  - Immutable Ledger         │                         │  - Rate Limiting            │
                               │  - Multi-tenant Isolation   │                         │  - Job Queues (BullMQ)      │
                               │  - High-precision Decimal   │                         │  - Session Storage          │
                               └─────────────────────────────┘                         └─────────────────────────────┘
```

### Core Technologies
- **Frontend Framework:** Next.js 14 (App Router, Server & Client Components, React 18, TypeScript)
- **Styling & Design System:** Tailwind CSS, Lucide React icons, Responsive Glassmorphism Enterprise Theme
- **Data Visualization:** Recharts (Area charts, bar charts, interactive pie/donut charts)
- **Database & ORM:** PostgreSQL 16 (Production) & SQLite (Local dev/testing), Prisma ORM 6
- **State Management & Validation:** TanStack React Query, React Hook Form, Zod
- **Security & Cryptography:** JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), CSV Formula Injection Neutralization
- **Containerization:** Docker & Multi-stage `Dockerfile`, Docker Compose v3.8

---

## 💎 Key Business & Engineering Features

### 1. Permanent Immutable Stock Movement Ledger
- **No Direct Balance Overwriting:** Ordinary forms cannot overwrite on-hand quantities. Every stock mutation triggers an immutable `StockMovement` row inside an atomic database transaction.
- **Audited Movement Types:** `OPENING_BALANCE`, `PURCHASE_RECEIPT`, `SALE`, `CUSTOMER_RETURN`, `SUPPLIER_RETURN`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT_INCREASE`, `ADJUSTMENT_DECREASE`, `DAMAGE_WRITE_OFF`.
- **Three-Tier Balance Formula:**
  $$\text{Available Stock} = \text{On-Hand Stock} - \text{Reserved Stock}$$
- **Negative Stock Prevention:** System blocks checkouts or transfers if available stock is insufficient (unless explicit negative inventory flag is enabled by organization admin).

### 2. Multi-Warehouse Stock Transfers
- **Two-Stage Workflow:** `DRAFT` $\rightarrow$ `DISPATCH` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `RECEIVE`.
- Dispatched inventory immediately deducts from source on-hand and moves to `inTransit`.
- Receiving warehouse confirms physical count, automatically logging discrepancy notes and increasing destination stock.

### 3. Procurement Workflow (PO vs. Receiving)
- **Purchase Order Separation:** Generating a Purchase Order marks it as `CONFIRMED` but **never** increments stock prematurely.
- **Goods Receiving Note (GRN):** Inventory is increased **only** when goods are physically received and the receipt is posted, with tracking for rejected/damaged items.

### 4. High-Performance Point of Sale (POS)
- Split tender support (Cash, Credit Card, Customer Account balance).
- Instant hardware barcode scanning (handles standard USB/Bluetooth HID wedges sending keystrokes and Enter).
- Instant camera barcode scanning viewfinder via HTML5 Canvas.
- Modal thermal receipt preview and direct one-click printing (`window.print()`).

### 5. Sales Returns & Restocking Quarantine
- Returned items are quarantined by condition: `UNOPENED`, `OPENED`, `DAMAGED`, `DEFECTIVE`.
- **Restocking Approval Gate:** Stock is **only** returned to sellable available inventory if `restockApproved: true`. Damaged goods are routed to write-offs.

### 6. Automated Inventory Intelligence Engine
- Real-time stock status computation: `OUT_OF_STOCK`, `LOW_STOCK`, `OVERSTOCK`, `HEALTHY`.
- Sales velocity analytics: calculates 30-day velocity, identifying **Hot-Selling** vs. **Slow-Moving / Dead Stock**.
- Algorithmic Restock Suggestions: Automatically calculates required replenishment orders using:
  $$\text{Suggested Order} = (\text{Max Stock} - \text{On Hand}) + (\text{Daily Velocity} \times \text{Lead Time})$$

### 7. Bulk CSV Import / Export Engine
- Standardized CSV template generation.
- **Dry-Run Validation:** Validates headers, data types, category/brand references, and detects internal duplicate SKUs without touching the database.
- **CSV Formula Injection Defense:** Strips or prefixes dangerous formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) to protect Excel/Sheets consumers.

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- Node.js 18.x or 20.x
- npm 9+
- (Optional) Docker & Docker Compose for PostgreSQL/Redis

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/inventory-pro/inventory-pro.git
cd "AI Inventory Management System"
npm install
```

### 2. Environment Configuration
Copy the template environment file:
```bash
cp .env.example .env
```
Default configuration connects to SQLite for instantaneous local zero-config testing:
```ini
DATABASE_URL="file:./dev.db"
JWT_SECRET="inventory-pro-enterprise-secure-jwt-secret-key-2026-production"
PORT=3000
```

### 3. Database Migration & Seeding
Initialize the database tables and seed sample data:
```bash
# Push schema to SQLite
npm run prisma:push

# Seed default organization, roles, permissions, locations, products, and transactions
npm run prisma:seed
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Default Credentials & RBAC Matrix

The database seeder automatically initializes the system with the following credentials:

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@inventorypro.com` | `Password123!` | Complete access to all 3 warehouses, financial reports, settings, and user management |

### Role-Based Access Control (RBAC) Matrix
| Permission | Super Admin | Company Admin | Manager | Inventory Staff | Cashier | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `inventory.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `inventory.create` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `inventory.adjust` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `stock.transfer` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `purchases.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `purchases.approve` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `sales.create` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `sales.refund` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports.view` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `users.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 🧪 Automated Test Suite

Inventory Pro includes an automated test suite verifying critical transaction safety:
- Complete ledger balance invariant equation:
  $$\text{Balance} = \text{Opening}(100) + \text{Receipt}(+50) - \text{Sale}(-20) - \text{Adjustment}(-5) = 125$$
- Available vs. on-hand reserved stock mechanics.
- Sales order cancellation stock release.
- Negative inventory rejection.
- Purchase order confirmation vs. goods receiving note (GRN).
- Partial goods receipt allocation.
- Inter-warehouse transfer dispatch and receiving lifecycle.

Run tests via:
```bash
npm test
```

Expected output:
```
✔ Stock Ledger Invariant Formula (Opening + PO - Sale - Adj)
✔ Stock Reservation and Availability Calculation
✔ Order Cancellation Releases Reserved Stock
✔ Negative Inventory Prevention Policy
✔ Purchase Order does NOT increase stock until Goods Receipt Note (GRN)
✔ Partial Purchase Order Goods Receipt
✔ Stock Transfer Lifecycle: Draft -> Dispatch (In Transit) -> Receive
✔ Stock Adjustment Audit Reason & Tracking
✔ Sales Return with Restocking Inspection Approval Gate

ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
```

---

## 🐳 Production Deployment with Docker Compose

Inventory Pro is fully containerized with multi-stage Docker builds.

### 1. Launch Multi-Container Stack
Start PostgreSQL 16, Redis 7, and the Next.js app in detached mode:
```bash
docker compose up --build -d
```

### 2. Verify Container Health
```bash
docker compose ps
```
The application will be accessible at `http://localhost:3000`.

### 3. Run Production Migration & Seeding in Container
```bash
docker compose exec app npx prisma db push --schema=prisma/schema.postgresql.prisma
docker compose exec app node scripts/seed.js
```

---

## 💾 Database Backup & Disaster Recovery

### PostgreSQL Backup (`pg_dump`)
```bash
docker compose exec -t db pg_dump -U inventory -d inventory_pro -F c -b -v -f /tmp/backup_$(date +%Y%m%d_%H%M%S).dump
docker cp inventory_pro_db:/tmp/backup_*.dump ./backups/
```

### PostgreSQL Restore (`pg_restore`)
```bash
docker cp ./backups/backup_20261111.dump inventory_pro_db:/tmp/restore.dump
docker compose exec -t db pg_restore -U inventory -d inventory_pro -c -v /tmp/restore.dump
```

---

## 📡 RESTful API Reference

All endpoints adhere to standardized JSON envelopes:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

Detailed OpenAPI 3.0 specification is available at [`docs/openapi.json`](file:///docs/openapi.json).

### Primary Endpoints
- **Authentication:** `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`
- **Products:** `GET /api/v1/products`, `POST /api/v1/products`, `GET /api/v1/products/:id`
- **Stock Balances:** `GET /api/v1/stock/balances`
- **Stock Movements Ledger:** `GET /api/v1/stock/movements`
- **Stock Adjustments:** `POST /api/v1/stock/adjustments`
- **Stock Transfers:** `POST /api/v1/stock/transfers`, `POST /api/v1/stock/transfers/:id/dispatch`, `POST /api/v1/stock/transfers/:id/receive`
- **Reorder Suggestions:** `GET /api/v1/stock/reorder-suggestions`
- **Purchases:** `POST /api/v1/purchases/orders`, `POST /api/v1/purchases/receipts`
- **POS Checkout:** `POST /api/v1/sales/checkout`
- **Sales Returns:** `POST /api/v1/sales/returns`
- **KPIs & Reports:** `GET /api/v1/reports/dashboard-kpis`, `GET /api/v1/reports/profitability`
- **CSV Data Engine:** `GET /api/v1/imports/template`, `POST /api/v1/imports/validate`, `POST /api/v1/imports/process`, `GET /api/v1/exports/products`

---

## 📄 License
Enterprise Commercial License. Proprietary and confidential. Developed for Inventory Pro.

