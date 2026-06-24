# StreetdocMD — Setup Guide

## Prerequisites
- Node.js 18+
- npm 10+
- Expo CLI: `npm install -g expo-cli`
- A Supabase account (free): https://supabase.com
- A Paystack account (test mode): https://paystack.com
- A Termii account: https://termii.com

---

## Step 1 — Install dependencies

```bash
cd streetdocmd
npm install
```

---

## Step 2 — Set up Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to **Settings → API** and copy:
   - Project URL
   - anon/public key
   - service_role key
3. Go to **SQL Editor** and paste + run the contents of:
   `supabase/migrations/001_initial_schema.sql`
4. Go to **Authentication → Providers** and enable **Phone** (SMS OTP)
   - Set provider to **Twilio** or use the built-in test OTPs for now

---

## Step 3 — Configure environment

```bash
cp .env.example apps/admin/.env.local
cp .env.example apps/patient/.env
cp .env.example apps/provider/.env
```

Fill in the values. At minimum you need:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

For the Expo apps, rename env vars from `NEXT_PUBLIC_` to `EXPO_PUBLIC_`.

---

## Step 4 — Create your admin user

In Supabase SQL editor:
```sql
-- After signing up via the admin login page, run this to grant admin role:
UPDATE users SET role = 'admin' WHERE phone = '+234XXXXXXXXXX';
```

---

## Step 5 — Run the admin dashboard

```bash
npm run dev:admin
# Opens at http://localhost:3000
```

Login with your admin credentials.

---

## Step 6 — Run the patient app

```bash
npm run dev:patient
# Scan the QR code with Expo Go on your Android phone
```

---

## Step 7 — Run the provider app

```bash
npm run dev:provider
```

---

## Project Structure

```
streetdocmd/
├── apps/
│   ├── admin/          # Next.js web dashboard (Vercel)
│   ├── patient/        # Expo React Native patient app
│   └── provider/       # Expo React Native provider app
├── packages/
│   └── shared/         # Types, constants, utils shared across all apps
├── supabase/
│   └── migrations/     # SQL schema — run in Supabase SQL editor
├── turbo.json          # Turborepo config
└── .env.example        # Copy this to each app's .env
```

---

## MVP Build Order (Week by Week)

| Week | Focus |
|------|-------|
| 1 | Run setup, create admin user, test patient OTP login |
| 2 | Test full booking flow (patient books → provider accepts) |
| 3 | Live GPS tracking working on real Android devices |
| 4 | Clinical notes, prescription generator, visit summary |
| 5 | Paystack payments in test mode |
| 6 | Admin verification console — approve a real provider |
| 7 | End-to-end test with real patient + provider |
| 8 | Private beta: 50 patients, 20 providers |

---

## Key Things to Know

**2-minute dispatch window**: When a patient books, a row is inserted into `dispatch_queue`.
The provider sees an Alert via Supabase Realtime. If they don't respond in 2 minutes,
you need a Supabase Edge Function or pg_cron job to expire the dispatch and try the next provider.
This is the most complex piece — build it in Week 3.

**Real-time tracking**: Provider location updates every 10 seconds via `supabase.from("providers").update(...)`.
Patient and admin screens subscribe to changes via `supabase.channel(...)`.

**RLS is on from day one**: Every table has Row Level Security. Patients can only see their own data.
Providers can only see bookings assigned to them. Admins see everything.

**Payments**: Paystack is integrated via the admin backend API route (`/api/payments/initialize`).
Never put your Paystack secret key in the mobile app. Always call it from the server.

---

## Vercel Deployment (Admin Dashboard)

```bash
cd apps/admin
vercel --prod
```

Add your environment variables in the Vercel dashboard under Settings → Environment Variables.
