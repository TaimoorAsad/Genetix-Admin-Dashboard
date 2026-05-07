# Scalability Admin Dashboard

Next.js admin website to manage the Scalability mobile app: users, franchises, and app data (App link, YouTube playlist). The mobile app is **not modified**; this dashboard lives in a separate folder and talks to the same Firebase project.

## Features

- **Dashboard** – Overview with total users and franchises
- **Users** – List, view, edit (name, email, elite status, referral counts), and delete users
- **Franchises** – List, add, and delete franchises
- **App Data** – Edit `appData/AppLink` (app link) and `appData/Youtube` (Client Playlist)

## Setup

1. **Install dependencies**

   ```bash
   cd admin-dashboard
   npm install
   ```

2. **Environment variables**

   Copy `env.example` to `.env.local` (e.g. `copy env.example .env.local` on Windows, or `cp env.example .env.local` on Mac/Linux).

   The Firebase web config in `env.example` is already filled in. You still need to add:

   - **`FIREBASE_SERVICE_ACCOUNT_JSON`** (required for API routes):  
     Firebase Console → Project settings → **Service accounts** → **Generate new private key**.  
     Open the downloaded JSON, minify it to one line, and paste it as the value (no quotes around the JSON).
   - **`ADMIN_EMAILS`** or **`ADMIN_UIDS`** (required for who can sign in):  
     Set `ADMIN_EMAILS=your@email.com` (the email of a user in Firebase Authentication).  
     Or use `ADMIN_UIDS` with that user’s UID from Authentication → Users.

   Without these two, login may work but dashboard data (users, franchises, app data) will not load, and you’ll get “Unauthorized” on API calls.

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with an admin email/password. You’ll be redirected to the dashboard.

## Security

- Keep `.env.local` and your service account JSON **out of version control**.
- Only users whose UID or email is in `ADMIN_UIDS` or `ADMIN_EMAILS` can use the dashboard and APIs.
- All mutating API routes require a valid Firebase ID token and admin check.

## Project structure

- `src/app/api/` – API routes (auth verify, users, franchises, app-data, stats) using Firebase Admin SDK.
- `src/app/dashboard/` – Dashboard layout and pages (overview, users, franchises, app data).
- `src/app/login/` – Login page (Firebase Auth email/password).
- `src/contexts/AuthContext.tsx` – Client auth state and ID token for API calls.
- `src/lib/firebase-admin.ts` – Server-side Firebase Admin init and admin verification.
- `src/lib/firebase-client.ts` – Client Firebase config for login.

The Flutter app in the parent folder is unchanged; this admin site only uses the same Firebase project.

## Deploy on Vercel

1. **Push this folder** to its own repo (e.g. `Scalability-admin-dashboard`) or ensure Vercel is pointed at the repo and **Root Directory** is `admin-dashboard` if the repo contains other code.

2. **Environment variables** – In the Vercel project → **Settings → Environment Variables**, add every variable from `env.example`:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` – paste the **entire** service account JSON as one line (no line breaks).
   - `ADMIN_EMAILS` and/or `ADMIN_UIDS`

   Apply them to **Production**, and optionally Preview if you use branch deploys.

3. **Redeploy** after saving env vars. The `npm warn deprecated` messages during install are from dependencies and do not fail the build. If the build fails, check the error in the Vercel build logs and that all required env vars are set.
