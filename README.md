# Debt Ledger Unified

Arabic debt ledger app for managing customers, debts, payments, balances, statements, and CSV exports.

## Run locally

npm install
npm start

Open: http://localhost:3000

## Android APK

The project includes a Capacitor Android wrapper with the application id
`com.beiny.ledger`. The APK connects directly to Supabase over HTTPS, so the
same signed-in account syncs across devices without a separate web server.

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
5. Copy the Project URL and Publishable key into `config.js`.
6. Run `supabase-schema.sql` in SQL Editor. It enables Row Level Security so
   each signed-in user can access only their own customers and transactions.

The publishable key is safe to include in the app. Do not put a Supabase
secret/service-role key in frontend JavaScript.

## Sign in

On first launch, create an account with your email and a password of at least
8 characters. Confirm the email message from Supabase, then sign in on each
device with the same account to sync the ledger.

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
