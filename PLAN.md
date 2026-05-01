## Plan: Account Fields + Logged-In Header Menu

Replace Contact Name with required First Name + Last Name in sign-up, add a shared /account-settings experience for both roles, move password-change UI there, and add a logged-in initials avatar dropdown in the homepage header with role-aware navigation and logout. Sequence starts with schema-safe data changes, then API/UI updates, then auth/header integration and verification.

**Steps**
1. Phase 1: Data model update for client names (blocking)
1. Manually populate first_name and last_name for existing client rows before running migration.
1. Add first_name and last_name to clients schema in both bootstrap scripts and enforce required constraints for new inserts.
1. Remove contact_name from clients schema in this rollout and remove all read/write references in runtime code.
1. Phase 2: Registration contract update (depends on Phase 1)
1. Update Create Account form state and UI to replace Contact Name with required First Name and Last Name, preserving existing required behavior and validation messaging.
1. Update register API payload parsing/validation to require first_name and last_name (as requested, no legacy payload acceptance).
1. Update DB insert helper signature and INSERT statement to persist first_name/last_name only; remove contact_name compatibility code.
1. Phase 3: Client/admin data surfaces using new fields (depends on Phase 2)
1. Update admin clients API response and PUT RETURNING columns to include first_name and last_name.
1. Update admin clients UI types and table rendering to display combined first/last name (with safe fallback when either is missing).
1. Update client profile API to include first_name/last_name so account settings and initials rendering have stable source data.
1. Phase 4: Shared account settings route + password migration (depends on Phases 2-3)
1. Create /account-settings page as a client component protected by session; if unauthenticated route to /login.
1. Move existing password-change UI/UX from portal into /account-settings, preserving prompt/confirmation/policy/rate-limit UX and messages where possible.
1. Remove the password section from portal page and replace with a link/button to /account-settings.
1. Update change-password API to support both client and admin self-service changes using user_type + parsed session id (client:ID/user:ID), including current-password verification against the correct table and update of the correct password_hash column.
1. Add or refactor DB helpers for admin user password retrieval/update, and reuse a single parse-user-id pattern used elsewhere in APIs.
1. Phase 5: Homepage header logged-in avatar dropdown (parallel with Phase 4 page build once role/session contract is clear)
1. Update Header component to read session state and render logged-out vs logged-in controls on desktop and mobile nav.
1. Add a circular initials trigger on the right side when authenticated; initials sourced from first_name+last_name when available, else session name/email fallback.
1. Implement dropdown menu actions:
1. Client role: Go to Client Portal.
1. Admin role: Go to Admin Dashboard.
1. Both roles: Go to Account Settings.
1. Both roles: Log out using existing signOut redirect pattern.
1. Keep existing homepage section links unchanged and ensure dropdown/menu closes correctly with current outside-click behavior.
1. Phase 6: Type/doc consistency and rollout safety (depends on all prior phases)
1. Update any README/auth docs mentioning contact_name-only registration payload to first_name/last_name.
1. Audit remaining contact_name references and remove them entirely from application code and SQL queries.
1. Validate no schema drift regressions in bootstrap scripts by keeping ALTER TABLE idempotent pattern used in repo memory.

**Relevant files**
- d:/ClearsiteConsultants/clearsite-consultants/app/login/page.tsx — replace sign-up fields/state/payload in handleSignUp.
- d:/ClearsiteConsultants/clearsite-consultants/app/api/auth/register/route.ts — require and persist first_name/last_name.
- d:/ClearsiteConsultants/clearsite-consultants/lib/db.ts — update createClient signature/insert; add helpers for admin self password change; adjust profile selectors.
- d:/ClearsiteConsultants/clearsite-consultants/scripts/bootstrap-db.mjs — add clients first_name/last_name columns, enforce required constraints, and drop contact_name.
- d:/ClearsiteConsultants/clearsite-consultants/scripts/bootstrap-local.sql — add clients first_name/last_name columns, enforce required constraints, and drop contact_name.
- d:/ClearsiteConsultants/clearsite-consultants/app/api/admin/clients/route.ts — return first_name/last_name in GET and PUT response.
- d:/ClearsiteConsultants/clearsite-consultants/app/admin/clients/page.tsx — use first_name/last_name in client type and table output.
- d:/ClearsiteConsultants/clearsite-consultants/app/api/clients/me/route.ts — include first_name/last_name for authenticated client profile.
- d:/ClearsiteConsultants/clearsite-consultants/app/portal/page.tsx — remove embedded password form, add account settings navigation.
- d:/ClearsiteConsultants/clearsite-consultants/app/account-settings/page.tsx — new shared account settings UI for clients/admins.
- d:/ClearsiteConsultants/clearsite-consultants/app/api/auth/change-password/route.ts — make endpoint role-aware and session-id-prefix safe.
- d:/ClearsiteConsultants/clearsite-consultants/components/Header.tsx — add logged-in initials avatar + role-based dropdown + logout.
- d:/ClearsiteConsultants/clearsite-consultants/lib/utils.ts — optional initials helper extraction if reused by header/account settings.
- d:/ClearsiteConsultants/clearsite-consultants/app/api/auth/[...nextauth]/route.ts — reference session shape/user_type conventions (likely no direct change).

**Verification**
1. Run project checks (lint/typecheck/build commands used by repo) and resolve any typing regressions from new name fields and account settings route.
1. Manual sign-up test: Create Account rejects missing first or last name; successful submission creates client and signs in.
1. DB verification: new client row has first_name and last_name populated; clients table no longer contains contact_name; no bootstrap rerun failures.
1. Homepage logged-out state: header still shows Client Portal link; no avatar.
1. Homepage logged-in client state: initials avatar appears; dropdown shows Client Portal, Account Settings, Log out; navigation works.
1. Homepage logged-in admin state: initials avatar appears; dropdown shows Admin Dashboard, Account Settings, Log out; navigation works.
1. Account settings client flow: current password prompt + policy validation + successful change path + failure/rate-limit behavior still works.
1. Account settings admin flow: self-service password change updates users table password hash and allows re-login with new password.
1. Regression checks: portal and admin dashboards still enforce role redirects; logout still returns to homepage.

**Decisions**
- Use one shared route at /account-settings for both roles.
- Registration switches immediately to first_name/last_name only (no legacy contact_name payload acceptance).
- Initials source priority: first_name+last_name, then session.name/company, then email fallback.
- Included scope: homepage Header authenticated menu, account settings relocation, role-aware self-password change, and contact_name column removal.
- Excluded scope: redesign of admin dashboard pages beyond linking.

**Further Considerations**
1. Recommended safety follow-up: create a reversible SQL rollback script that re-adds contact_name only for emergency recovery.
2. Recommended hardening follow-up: add NextAuth type augmentation for session.user.id and session.user.user_type to reduce repetitive casts.
3. Recommended QA follow-up: add API-level tests for register payload validation and role-specific change-password behavior.