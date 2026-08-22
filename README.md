# Debt Ledger Unified

Arabic debt ledger app for managing customers, debts, payments, balances, statements, and CSV exports.

## Run locally

npm install
npm start

Open: http://localhost:3000

## Supabase setup

The app now stores data in Supabase instead of local SQLite, so data will not disappear when Render restarts.

1. Create a free project at https://supabase.com
2. Open SQL Editor in Supabase.
3. Copy and run everything from supabase-schema.sql.
4. Go to Project Settings -> API.
5. Copy Project URL and service_role secret key.
6. Add these environment variables on Render or locally:

SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret_key

Do not expose SUPABASE_SERVICE_ROLE_KEY in browser code. It is only used by server.js.

## Render deploy

- Connect this GitHub repo as a Web Service.
- Build Command: npm install
- Start Command: npm start
- Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Environment.

## Features

- Add, edit, and delete customers.
- Register debts and payments.
- Choose payment methods: cash transfer, cash payment, Instapay, or other.
- Write transaction reasons manually.
- Automatic running balance per customer.
- Customer statement page.
- Daily and total reports.
- CSV export for customers and ledger.
- Supabase database storage.
- Responsive layout for phone and desktop.
