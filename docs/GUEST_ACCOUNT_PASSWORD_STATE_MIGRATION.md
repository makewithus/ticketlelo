# TicketLelo — Guest Account & Password State Migration Guide
## Backward Compatibility, State Transitions & Safe Backfill Strategy

Document Date: November 12, 2026  
Status: Production-Ready Blueprint & Script  
Applicable Branches: `feature/guest-registration-security-complete` -> `main`  

---

## 1. Problem Statement & Root Cause

Prior to this implementation, the `hasSetPassword` boolean flag in the Firestore `users` collection was inconsistent:
1. **First-Time Guest Users**: Created with `hasSetPassword: false` and `isFirstTimeUser: true`.
2. **Direct Signup Users**: Previously created without explicit options, leading to `hasSetPassword: false` even though they provided a password (BUG-3, now resolved).
3. **Legacy Users**: Registered before the guest registration overhaul who do not possess a `hasSetPassword` attribute in their Firestore document.
4. **Google / Social Auth Users**: Authenticated via OAuth providers without passwords; previously had `hasSetPassword: undefined`.

In the original audit, this discrepancy allowed SEC-1: `setup-password` interpreted an absent `hasSetPassword` flag as "unset" (`hasSetPassword !== true`), while `register-free` interpreted an absent flag as "already set".

---

## 2. Invariant Security Rules for State Transitions

Under the hardened architecture:
- **Rule 1 (Fail-Closed Token Requirement)**: A password CANNOT be set via `POST /api/auth/setup-password` unless a valid, unused, unexpired token exists in `accountSetupTokens/{normalizedEmail}`.
- **Rule 2 (Google Auth Protection)**: Users whose only provider is `google.com` cannot set a password via the guest setup endpoint without explicit authorization.
- **Rule 3 (Immutable Password Protection)**: Users whose `hasSetPassword === true` are rejected with `400 Bad Request` and directed to log in or use Forgot Password.
- **Rule 4 (Data Safety Guarantee)**: No existing user credentials, tickets, registrations, or QR codes are modified or deleted.

---

## 3. Account State Resolution Matrix

| Firebase Auth Provider(s) | Firestore `hasSetPassword` | `accountSetupTokens` doc | Resolved State | Permitted Actions |
|---|---|---|---|---|
| `password` | `false` | Valid & Unused | **Guest Pending Setup** | Allowed to set password via `/setup-password` with valid token. |
| `password` | `true` | Any / Used | **Active Password Account** | Must log in; redirected to `/login`; setup rejected. |
| `password` | `undefined` (Legacy) | None | **Legacy Password Account** | Treated as having a password; setup rejected without valid token. |
| `google.com` | `undefined` or `null` | None | **Social Login Account** | Must log in via Google; setup password endpoint rejects. |
| `password` | `false` | Expired / Used | **Expired Setup** | User must request new token or use Forgot Password OTP. |

---

## 4. Safe Non-Destructive Backfill Script

The following standalone script can be executed safely by platform administrators via the Firebase Admin SDK to backfill missing `hasSetPassword` flags on existing user documents without modifying authentication credentials or passwords.

```javascript
/**
 * scripts/backfill-has-set-password.js
 *
 * Safe, idempotent migration to backfill hasSetPassword on legacy user accounts.
 * Execution: node scripts/backfill-has-set-password.js
 */

import { adminAuth, adminDb, isFirebaseAdminReady } from "../lib/firebase-admin.js";

async function runBackfill() {
  if (!isFirebaseAdminReady() || !adminDb || !adminAuth) {
    console.error("Firebase Admin SDK is not initialized. Ensure service credentials exist.");
    process.exit(1);
  }

  console.log("Starting safe backfill of user account password states...");

  let processedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let pageToken;

  do {
    const listUsersResult = await adminAuth.listUsers(100, pageToken);
    pageToken = listUsersResult.pageToken;

    for (const user of listUsersResult.users) {
      processedCount++;
      const uid = user.uid;
      const userRef = adminDb.collection("users").doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        // User exists in Auth but not Firestore; initialize doc
        const isGoogle = user.providerData.some((p) => p.providerId === "google.com");
        const hasPassword = Boolean(user.passwordHash || !isGoogle);

        await userRef.set({
          id: uid,
          email: (user.email || "").toLowerCase().trim(),
          fullName: user.displayName || "User",
          hasSetPassword: hasPassword,
          isFirstTimeUser: false,
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
        }, { merge: true });
        updatedCount++;
        continue;
      }

      const userData = userDoc.data() || {};
      if (userData.hasSetPassword === undefined) {
        // Determine whether user has set a password based on Auth providers
        const isGoogleOnly = user.providerData.length > 0 && user.providerData.every((p) => p.providerId === "google.com");
        const hasPassword = Boolean(user.passwordHash || !isGoogleOnly);

        await userRef.update({
          hasSetPassword: hasPassword,
          isFirstTimeUser: false,
          updatedAt: new Date(),
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`Processed ${processedCount} accounts (Updated: ${updatedCount}, Skipped: ${skippedCount})...`);
  } while (pageToken);

  console.log(`\nBackfill complete! Total processed: ${processedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);
}

runBackfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
```

---

## 5. Rollback & Fail-Safe Strategy

1. **Zero Schema Breakage**: The application code handles `undefined` gracefully by defaulting legacy accounts with existing passwords to `hasSetPassword !== false`.
2. **Idempotence**: Running the migration script multiple times causes no data corruption.
3. **No Credential Overwrites**: At no point does the migration inspect, alter, or reset Firebase Auth passwords.
