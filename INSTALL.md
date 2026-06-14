# Quick Start — Local Setup

## Prerequisites
- Node.js 18+
- PostgreSQL 16 running locally

## Step 1 — Backend

```bash
cd splitwise-app/backend

# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env
# Edit DATABASE_URL to point to your local Postgres

# Apply the database migration (already generated — just needs to run)
npx prisma migrate deploy

# Seed the USD→INR exchange rate
npm run db:seed

# Start the dev server
npm run dev
# → http://localhost:3001
```

## Step 2 — Frontend

```bash
cd splitwise-app/frontend

# Install dependencies
npm install

# Start the dev server (Vite proxies /api to localhost:3001)
npm run dev
# → http://localhost:5173
```

## Step 3 — Import the CSV

1. Register an account at http://localhost:5173/login
2. Create a group named "Flat C-42"
3. Go to the Import CSV tab
4. Upload `expenses_export.csv`
5. Review the anomaly report

## Deployment

- Backend → Render: use `backend/render.yaml`
- Frontend → Vercel: connect the repo, set `VITE_API_URL` to your Render URL
