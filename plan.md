## Plan: Handle Duplicate Email Addresses (Settings, Restoration, and Registration)

Improve the email validation workflow by checking if an email address is already in use by another client or an administrator before proceeding with changes or account creation.

**Steps**

### Phase 1: Database Utility
1. **Update [lib/db.ts](lib/db.ts)**: Add a new utility function `isEmailInUse(email: string, excludeClientId?: string)` that checks both the `clients` and `users` tables for the existence of the given email address.

### Phase 2: API Route Validation
2. **Update [app/api/clients/me/route.ts](app/api/clients/me/route.ts)**:
    - Call `isEmailInUse` when the email address is being changed.
    - If the email is in use, return a `400 Bad Request` with "This email address is already in use.".
    - Ensure this check happens **before** the security alert email is sent.
3. **Update [app/api/auth/change-email/route.ts](app/api/auth/change-email/route.ts)**:
    - Add a check for email availability before performing the `UPDATE` on the `clients` table.
4. **Update [app/api/auth/register/route.ts](app/api/auth/register/route.ts)**:
    - Add a check for email availability before calling `createClient`.
    - Note: The current registration logic might already check `clients`, but it should check `users` (admins) as well to prevent overlapping accounts.

**Relevant files**
- [lib/db.ts](lib/db.ts) — Add `isEmailInUse` function.
- [app/api/clients/me/route.ts](app/api/clients/me/route.ts) — Add validation for email change.
- [app/api/auth/change-email/route.ts](app/api/auth/change-email/route.ts) — Add validation for recovery.
- [app/api/auth/register/route.ts](app/api/auth/register/route.ts) — Add validation for sign-up.

**Verification**
1. **Manual Test (Client Settings)**: Attempt to change a client's email to one already used. Verify error and no alert.
2. **Manual Test (Registration)**: Attempt to sign up with an existing client or admin email. Verify rejection.
3. **Manual Test (Recovery)**: Simulate a recovery link where the target email is already taken. Verify failure.

**Decisions**
- The error message will be generic ("This email address is already in use.") to avoid disclosing whether the email belongs to a client or an administrator.
- The check is performant as it uses indexed `email` columns in both tables.