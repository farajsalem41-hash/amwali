# Amwali (أموالي)

Amwali is a Libyan SaaS platform that helps merchants organize payment requests, bank
transfers, transfer proofs and partial payments in one place.

Amwali is **not** a bank and **not** a payment gateway. It never holds or moves funds.
The V1 flow is: the merchant adds their own bank/wallet accounts → the customer opens a
public payment link and uploads a transfer proof → the merchant reviews and confirms it.

## Features

- **Auth**: phone + password registration, OTP verification, login, password reset, change password.
- **Merchant profile**: business data, logo upload, social links, bank/wallet payment accounts.
- **Payment requests**: amounts with discounts, public non-guessable link, QR code, expiry,
  partial payments, status history, cancel/expire.
- **Proofs**: customer uploads a transfer proof on the public page; merchant approves or rejects.
  OCR-style extraction is only a hint — merchant confirmation is final.
- **Customers**: directory with totals (requests, paid, remaining) and recalculation.
- **Invoices** (company accounts): line items, discounts, linked payment request, PDF-ready data.
- **Orders & delivery** (online seller accounts): items, delivery fee, courier assignment,
  delivery status workflow and a public courier link.
- **Organization**: branches, employees with roles/permissions, products/services, couriers.
- **Reports**: daily/weekly/monthly/custom summaries, per-branch and per-employee breakdowns,
  Excel and PDF export (Arabic font embedded).
- **Notifications**, **support tickets**, **subscriptions & plans** with usage limits.
- **Admin panel**: platform overview, merchants, subscription requests, tickets, audit logs, backups.
- **Security**: merchant data isolation, RBAC permissions, audit log for sensitive actions,
  rate limiting, public pages that never leak internal data.

## Account types

| Type            | Extra capabilities                          |
| --------------- | ------------------------------------------- |
| `store`         | branches, employees, products                |
| `company`       | invoices, products, branches, employees      |
| `freelancer`    | core payment requests only                   |
| `online_seller` | orders, delivery, couriers, products         |

## Stack

- **Backend**: Node.js + TypeScript + Express + MongoDB (Mongoose), JWT auth, Vitest tests.
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Router + Axios, full RTL Arabic, mobile-first.

## Project structure

```
amwali/
  backend/
    src/
      config/         constants, env, database
      models/         23 Mongoose models
      middleware/     auth, RBAC, error handler, rate limit, upload
      validators/     request body validation
      services/       audit, notification, customer, paymentRequest, proof, report, export, backup
      controllers/    16 controllers
      routes/         11 routers mounted under /api
      utils/          money, tokens, qr, helpers
    tests/            7 suites, 52 tests
    assets/fonts/     Amiri (Arabic PDF export)
  frontend/
    src/
      components/     design system, layout, CrudPage, ItemsEditor
      lib/            api client, auth context, hooks, formatting
      pages/          landing, auth, dashboard, public, admin
  scripts/            seed_demo.py (local QA data)
```

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in real values. Never commit `.env`.

| Variable        | Description                                |
| --------------- | ------------------------------------------ |
| `PORT`          | API port (default 5000)                    |
| `MONGODB_URI`   | MongoDB connection string                  |
| `JWT_SECRET`    | Long random secret for access tokens       |
| `JWT_EXPIRES_IN`| Token lifetime, e.g. `7d`                  |
| `NODE_ENV`      | `development` / `production`               |
| `APP_URL`       | Public base URL used in payment links      |
| `UPLOAD_DIR`    | Upload storage directory                   |
| `SEED_ADMIN_PHONE` / `SEED_ADMIN_PASSWORD` | Super admin bootstrap |

Frontend: `VITE_API_BASE` (optional) overrides the API base URL.

## Local development

```bash
# 1. MongoDB must be running (default: mongodb://127.0.0.1:27017/amwali)

# 2. Backend
cd backend
npm install
cp .env.example .env     # then edit .env
npm run seed             # plans + super admin
npm run dev              # http://localhost:5000

# 3. Frontend
cd ../frontend
npm install
npm run dev              # http://localhost:5173

# 4. Optional demo data for QA
python3 scripts/seed_demo.py
```

## Tests and build

```bash
cd backend  && npm test && npx tsc --noEmit
cd frontend && npm run build
```

## Security notes

- All financial calculations happen on the backend only; `remaining` can never go below zero
  and `paid` can never exceed the final amount.
- Payment records are immutable once created.
- Public tokens are long random strings; expired or disabled links are rejected.
- Public pages expose only what the customer or courier needs — never employees, other
  customers, internal notes or audit logs.
- Sensitive operations are written to the audit log with actor, action and metadata.

## License

Proprietary — all rights reserved.
