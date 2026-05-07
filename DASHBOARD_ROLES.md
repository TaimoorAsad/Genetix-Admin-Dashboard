# Dashboard roles and permissions

The dashboard supports four roles: **admin**, **staff**, **franchise**, and **user**. Everyone signs in with Firebase (email/password). Access is determined by either env (admin) or a Firestore document (staff, franchise, user).

## Roles

| Role      | Who uses it | Access |
|-----------|-------------|--------|
| **Admin** | Set in `ADMIN_UIDS` or `ADMIN_EMAILS` in `.env.local`, or via Firestore `dashboardRoles/{uid}` with `role: "admin"` | Full access; can manage staff permissions. |
| **Staff** | Firestore `dashboardRoles/{uid}` with `role: "staff"` and `permissions: { ... }` | Can do only what admin enables (view/edit/delete users, franchises, app data, stats). |
| **Franchise** | Firestore `dashboardRoles/{uid}` with `role: "franchise"` and `franchiseId: "<Franchises doc id>"` | Can only view (and edit) their own franchise (referral code, name, etc.). |
| **User**   | Firestore `dashboardRoles/{uid}` with `role: "user"` and `userId: "<users doc id>"` | Can only view their own profile and uploaded fingerprint images. |

## How to allow someone to log in

1. **Admin (legacy)**  
   Add their Firebase UID or email to `ADMIN_UIDS` or `ADMIN_EMAILS` in `admin-dashboard/.env.local`. No Firestore doc needed.

2. **Admin / Staff / Franchise / User (Firestore)**  
   Create a document in the **`dashboardRoles`** collection with document ID = the user’s Firebase Auth UID.

   - **Admin (optional, if not using env):**  
     `{ role: "admin" }`

   - **Staff:**  
     `{ role: "staff", email: "staff@example.com", permissions: { canViewStats: true, canViewUsers: true, canEditUsers: true, ... } }`  
     Permission keys: `canViewStats`, `canViewUsers`, `canEditUsers`, `canDeleteUsers`, `canViewFranchises`, `canEditFranchises`, `canDeleteFranchises`, `canViewAppData`, `canEditAppData`.

   - **Franchise:**  
     `{ role: "franchise", franchiseId: "<id of doc in Franchises collection>", email: "franchise@example.com" }`

   - **User:**  
     `{ role: "user", userId: "<id of doc in users collection>", email: "user@example.com" }`

The person must have a Firebase Auth account (email/password) in the same project. Create it in Firebase Console (Authentication) or via your app. Then add the `dashboardRoles` doc (or env for admin).

## Managing staff permissions (admin only)

- Go to **Dashboard → Staff permissions**.
- Toggle each permission per staff account. Changes are saved to Firestore and apply immediately.

## API for role management

- **GET /api/dashboard-roles** (admin) – List all dashboard role docs.
- **POST /api/dashboard-roles** (admin) – Create a role doc. Body: `{ role, uid? | email?, permissions? (staff), franchiseId? (franchise), userId? (user) }`.
- **GET /api/dashboard-roles/[uid]** (admin) – Get one role doc.
- **PATCH /api/dashboard-roles/[uid]** (admin) – Update role doc (e.g. staff permissions).

If a user signs in but has no `dashboardRoles` doc and is not in `ADMIN_*`, they see “You do not have access to the dashboard” and can sign out.
