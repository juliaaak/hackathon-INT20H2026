# INT20H — Instant Wellness Kits: Sales Tax Calculator

## The Problem

A drone delivery startup in New York State launched a service called **Instant Wellness Kits** — compact packages delivered by drone to any location in NY in 20–30 minutes. The app was built fast, the marketing worked, and orders flooded in.

One thing was forgotten: **sales tax**.

New York State requires collecting composite sales tax on retail sales. The tax rate is not uniform — it depends on the exact delivery location (county, city, special district). The company has 48 hours to fix this.

This admin tool solves the problem: given GPS coordinates of a delivery, it determines the correct composite sales tax rate and calculates the total amount owed.

---

## How It Works

### Tax Calculation Pipeline
```
GPS coordinates (lat, lon)
        ↓
Check if within New York State bounding box
        ↓
Match coordinates against known jurisdiction bounding boxes
        ↓
Return composite tax rate for that jurisdiction
        ↓
tax_amount = subtotal × composite_tax_rate
total_amount = subtotal + tax_amount
```

### Input
```
latitude, longitude   — GPS delivery coordinates
subtotal              — price of the wellness kit (before tax)
timestamp             — when the order was placed
```

### Output
```
composite_tax_rate    — e.g. 0.08875 (8.875%)
tax_amount            — e.g. $10.65
total_amount          — e.g. $130.65
breakdown:
  state_rate          — 4.000% (uniform across NY)
  county_rate         — varies by county
  city_rate           — 0.375% in NYC, 0% elsewhere
  special_rate        — additional district rates
tax_region            — jurisdiction name (e.g. "New York City (Manhattan)")
```

### Example
```
Input:  lat=40.7128, lon=-74.0060, subtotal=$120.00
→ Jurisdiction: New York City (Manhattan)
→ state: 4.000% + county: 4.500% + city: 0.375% = 8.875%
→ tax_amount: $10.65
→ total_amount: $130.65
```

### Tax Rate Sources
Rates are based on official **NY State Department of Taxation and Finance** data (2024). Key jurisdictions covered:

| Jurisdiction | Rate |
|---|---|
| New York City (all 5 boroughs) | 8.875% |
| Nassau County | 8.625% |
| Suffolk County | 8.625% |
| Westchester / Rockland | 8.375% |
| Erie County (Buffalo) | 8.750% |
| Monroe County (Rochester) | 8.000% |
| Onondaga County (Syracuse) | 8.000% |
| Albany County | 8.000% |
| Most other NY counties | 8.000% |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + TypeScript + Express |
| Database | SQLite via sql.js (pure JS, no native compilation) |
| Frontend | React + TypeScript + Vite |
| Auth | Token-based session auth |

> **Why sql.js instead of better-sqlite3?** better-sqlite3 requires native compilation (node-gyp) which fails on Node.js v25. sql.js is a pure JavaScript SQLite port — same functionality, zero build issues.

> **Why coordinate-based jurisdiction lookup instead of ZIP codes?** External geocoding APIs (US Census) have latency and reliability issues for bulk imports. Bounding box matching is instant, offline, and accurate enough for NY State jurisdictions.

---

## Project Structure
```
INT20H/
├── README.md
├── INT20H_backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts      # Express app entry point
│       ├── db.ts         # SQLite database layer
│       ├── tax.ts        # Tax calculation logic
│       ├── auth.ts       # Token-based auth
│       └── orders.ts     # Orders API routes
└── INT20H_frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts
        └── components/
            ├── Login.tsx
            ├── ImportCSV.tsx
            ├── CreateOrder.tsx
            └── OrdersTable.tsx
```

---

## Setup & Running Locally

### Prerequisites
- Node.js v18+
- npm

### Backend
```bash
cd INT20H_backend
cp .env.example .env
npm install
npm run dev
# Runs on http://localhost:3001
```

### Frontend
```bash
cd INT20H_frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

### Test Credentials
```
Password: admin123
```

---

## API Reference

All endpoints except `/api/login` require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/login` | `{ password }` → `{ token }` |
| POST | `/api/logout` | Invalidate session |
| GET | `/api/orders` | List orders (pagination + filters) |
| POST | `/api/orders` | Create order manually |
| POST | `/api/orders/import` | Import CSV file |
| DELETE | `/api/orders` | Clear all orders |

### GET /api/orders params
- `page`, `limit` — pagination
- `state` — filter by state (NY or "New York")
- `min_total`, `max_total` — filter by total amount

### CSV Format
```
id,longitude,latitude,timestamp,subtotal
1,-73.935242,40.730610,2025-11-04 10:17:04,120.0
```

---

## Assumptions

1. **Coordinate-based jurisdiction lookup** — bounding boxes per county/borough. Accurate enough for NY State; a production system would use a proper geocoding service with ZIP+4 precision.
2. **Orders outside NY are rejected** — the company's drone license covers NY State only.
3. **Tax rates are hardcoded** — from official NY State Dept of Taxation data (2024). Rates change rarely; a production system would pull from Avalara or TaxJar.
4. **IDs from CSV are preserved** — original order IDs are kept in the database.
5. **sql.js used instead of better-sqlite3** — due to Node.js v25 compatibility issues with native modules on Windows.