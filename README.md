# Debt Ledger Unified

Arabic debt ledger app for managing customers, debts, payments, balances, statements, and CSV exports.

## Run locally

npm install
npm start

Open: http://localhost:3000

## Android APK

The project includes a Capacitor Android wrapper with the application id
`com.beiny.ledger`. The web interface is bundled into the APK. For
multi-device sync, configure the deployed HTTPS service URL in
`capacitor.config.ts` before building.

After installing Android SDK Platform 36 and Build Tools 36, build a debug APK
with:

```powershell
npm install
npm run android:debug
```

The output is `android/app/build/outputs/apk/debug/app-debug.apk`.

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
APP_ACCESS_PASSWORD=a-long-unique-password-for-your-ledger

Do not expose SUPABASE_SERVICE_ROLE_KEY in browser code. It is only used by server.js.
`APP_ACCESS_PASSWORD` protects every data request and is kept only for the
current app session on each device. Use a long password you do not reuse.

## Render deploy

- Connect this GitHub repo as a Web Service.
- Build Command: npm install
- Start Command: npm start
- Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
  `APP_ACCESS_PASSWORD` in Environment.

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
