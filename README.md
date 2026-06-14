# SplitWise — Shared Expenses App

A full-stack shared expenses application built for the Spreetail assignment.

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Node.js + TypeScript + Express |
| Database | PostgreSQL (via Prisma ORM) |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Auth | JWT + bcrypt |
| CSV Parsing | csv-parse |
| Deployment | Railway (backend + DB) + Vercel (frontend) |

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run db:seed      # seeds USD→INR exchange rate
npm run dev          # starts on http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # starts on http://localhost:5173
```

## Environment Variables

### Backend `.env`
```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/splitwise_db"
JWT_SECRET="your_long_random_secret"
JWT_EXPIRES_IN="7d"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

## Project Structure

```
splitwise-app/
├── backend/
│   └── src/
│       ├── config/          # env, prisma client
│       ├── middleware/       # auth, error handler, validator
│       ├── modules/
│       │   ├── auth/         # register, login, JWT
│       │   ├── groups/       # group CRUD + time-bound membership
│       │   ├── expenses/     # expense CRUD + split calculator
│       │   ├── balances/     # read-only balance computation
│       │   ├── settlements/  # debt payment recording
│       │   └── import/       # CSV import pipeline (parser→validator→resolver→report)
│       ├── prisma/           # schema.prisma + seed
│       └── utils/            # rounding, currency, dates, names
└── frontend/
    └── src/
        ├── api/             # typed axios API clients
        ├── hooks/           # useAuth context
        ├── pages/           # Login, Groups, Expenses, Balances, Settlements, Import
        ├── components/      # reusable UI + layout
        └── types/           # shared TypeScript types
```

## Import Feature

Upload `expenses_export.csv` via the Import tab inside any group.
The importer detects 16 anomaly types, applies documented policies, and generates a full report.
Error-severity anomalies are held as PENDING and shown to the user for review.
See `SCOPE.md` for the full anomaly catalogue.

## AI Used

Kiro (Amazon) — see `AI_USAGE.md` for details.
