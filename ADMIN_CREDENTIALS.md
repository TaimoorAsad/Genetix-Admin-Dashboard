# Admin Credentials

## Default Admin Account

**Email:** `admin@genetix.app`  
**Password:** `GenetixAdmin2024!`

## How to Set Up

1. **Create Firebase Auth User:**
   - Go to [Firebase Console](https://console.firebase.google.com/) → Project **genetix-2e513**
   - Navigate to **Authentication** → **Users**
   - Click **Add user**
   - Email: `admin@genetix.app`
   - Password: `GenetixAdmin2024!`
   - Click **Add user**

2. **Verify Admin Access:**
   - The email `admin@genetix.app` is already added to `ADMIN_EMAILS` in `.env.local`
   - After creating the Firebase Auth user, you can log in to the dashboard with these credentials

3. **Login:**
   - Go to the dashboard login page
   - Enter email: `admin@genetix.app`
   - Enter password: `GenetixAdmin2024!`
   - Click **Sign in**

## Security Notes

- **Change the password** after first login if needed (via Firebase Console → Authentication → Users → Edit)
- The admin email is configured in `.env.local` under `ADMIN_EMAILS`
- You can add more admin emails by comma-separating them: `ADMIN_EMAILS=admin@genetix.app,another@admin.com`

## Alternative: Using Existing App User

If you want to use an existing user from your app as admin:

1. Find their email in Firestore `users` collection
2. Create a Firebase Auth account with that email (if it doesn't exist)
3. Add their email to `ADMIN_EMAILS` in `.env.local` (or their UID to `ADMIN_UIDS`)
4. They can log in with their email/password (or phone number if they have one in Firestore)

## Logging in with the same account as the app

### Sign in with Google (recommended if you use Google in the app)

1. On the dashboard login page, click **Sign in with Google**.
2. Choose the **same Google account** you use in the mobile app.
3. You will be logged in with the same Firebase account (same UID) as in the app.

**Requirement:** Google sign-in must be enabled in Firebase Console → Authentication → Sign-in method → Google → Enable.

### Sign in with phone (OTP) — for app users who only use phone, no password

If you sign in to the **app with just your phone number and OTP** (no password):

1. On the dashboard login page, find **Sign in with phone (OTP)**.
2. Enter the **same phone number** you use in the app (e.g. `+923001234567`), including country code with `+`.
3. Complete the reCAPTCHA and click **Send OTP**.
4. Enter the **6-digit code** you receive by SMS and click **Verify and sign in**.

You will be logged in with the same Firebase account (same UID) as in the app. No password is needed.

**Requirement:** Phone sign-in must be enabled in Firebase Console → Authentication → Sign-in method → Phone → Enable. Your site domain must be in Authorized domains.

### Sign in with email + password

- Enter the same **email** you use in the app and your **password**. Click **Sign in with Email**.
- If you signed up in the app with **phone only** and prefer not to use OTP on the web, an admin can set a password for your account (or use **Forgot password** with the email on file), then you can use email + password.

## Troubleshooting: "auth/internal-error" (Google or sign-in fails)

If you see **Firebase: Error (auth/internal-error)** when using **Sign in with Google** (or sign-in fails with no clear reason):

1. **Enable Google sign-in**
   - Firebase Console → **Authentication** → **Sign-in method** → **Google** → **Enable** and save.

2. **Add your site to Authorized domains**
   - Firebase Console → **Authentication** → **Settings** (or the **Authorized domains** tab).
   - Add:
     - `localhost` — for development (e.g. `http://localhost:3000`)
     - Your production domain (e.g. `your-dashboard.vercel.app`) when you deploy.
   - Without this, Firebase blocks the request and can return `auth/internal-error`.

3. **Check browser**
   - Allow popups for the login page if using popup sign-in.
   - Try in an incognito/private window if extensions might be blocking.

After updating Authorized domains and enabling Google, try signing in again.

## Troubleshooting: "auth/unauthorized-domain"

If you see **Firebase: Error (auth/unauthorized-domain)** when signing in (e.g. on https://scalability-admin-dashboard-rtns.vercel.app):

1. **Add the hostname only** (no `https://`, no path, no trailing slash):
   - Go to [Firebase Console](https://console.firebase.google.com/) → your **project** (the same one as your app).
   - **Authentication** → **Settings** (or **Authorized domains**).
   - Click **Add domain** and enter exactly: **`scalability-admin-dashboard-rtns.vercel.app`**
   - Save.

2. **Check the project**  
   Make sure you added the domain in the **same Firebase project** that your dashboard uses (check `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in Vercel env vars).

3. **Wait and retry**  
   Changes can take a minute. Try again in a new tab or incognito window.

4. **Domain already listed but still getting the error?**  
   The dashboard on Vercel might be using a **different Firebase project** than the one where you added the domain. In [Vercel](https://vercel.com) → your project → **Settings** → **Environment Variables**, ensure:
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is the **same** as the project where you added the domain (e.g. `genetix-2e513`).
   - All other `NEXT_PUBLIC_FIREBASE_*` vars (API key, auth domain, etc.) are from that same project.
   Then **redeploy** the app (Deployments → … → Redeploy) so the new env is used.

## Troubleshooting: "auth/invalid-app-credential" (Phone OTP)

If you see **Firebase: Error (auth/invalid-app-credential)** when using **Sign in with phone (OTP)**:

Firebase does **not** allow phone authentication on **localhost**. Use one of these:

1. **Use 127.0.0.1 for local dev**
   - In Firebase Console → **Authentication** → **Settings** → **Authorized domains**, add **`127.0.0.1`**.
   - Open your app at **http://127.0.0.1:3000** (or your dev port), **not** http://localhost:3000.
   - Try Send OTP again.

2. **Use your deployed site**
   - Deploy the dashboard (e.g. Vercel, Netlify).
   - Add the deployed domain (e.g. `your-app.vercel.app`) to **Authorized domains**.
   - Use phone OTP on that URL.

Also ensure **Phone** sign-in is enabled: Authentication → Sign-in method → **Phone** → Enable.

## Can you remove the “human check” (reCAPTCHA) for phone sign-in?

**Production: No.** Firebase requires a human/device verification (reCAPTCHA on web, Play Integrity on Android) for phone auth to prevent abuse (e.g. SMS bombing). There is no supported way to remove it for real users.

**Testing only (website):** You can skip the reCAPTCHA step in development by:

1. In `.env.local`, add:  
   `NEXT_PUBLIC_PHONE_AUTH_DISABLE_RECAPTCHA_FOR_TESTING=true`
2. In Firebase Console → **Authentication** → **Sign-in method** → **Phone** → open **Phone numbers for testing**.
3. Add a **test phone number** (e.g. `+1 650-555-3434`) and a **test verification code** (e.g. `123456`).
4. Restart the dev server and open the login page. The reCAPTCHA will be bypassed, but sign-in will **only** succeed for those test numbers with the code you set—real phone numbers will not receive SMS and cannot complete sign-in when this flag is on.

**Important:** Do **not** set `NEXT_PUBLIC_PHONE_AUTH_DISABLE_RECAPTCHA_FOR_TESTING=true` in production. Remove it or set it to `false` for deployed builds.

**Android app:** Verification (e.g. Play Integrity) is also required by Firebase for phone auth. For automated tests, use Firebase’s testing APIs (e.g. test phone numbers and, where documented, test-only configuration). You cannot remove the check for real users in the app.

## App content (Testimonials, Points & Usage, About Us)

The dashboard can manage content shown in the app's **Testimonials**, **Points & Usage**, and **About Us** tabs. Use the sidebar: **Testimonials**, **Points & Usage**, **About Us**. Each page lets you add blocks of type **Text**, **Image (URL)**, or **Video (YouTube or link)**. The app reads from Firestore collection **`appContent`** (fields: `section`, `type`, `content`, `order`).

**Firestore index:** The first time you (or the app) query `appContent` by `section` with `orderBy('order')`, Firestore may return an error with a **link to create a composite index**. Open that link in the Firebase Console and click **Create**. The index is on collection `appContent`, fields `section` (Ascending) and `order` (Ascending).
