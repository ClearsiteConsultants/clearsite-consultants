# Plan: Missing qbo_payment_url Developer Logging and Webhook Transition Behavior

## Goal
Ensure missing qbo_payment_url conditions appear in Developer Logs for admin create, admin manual link, admin manual sync, and portal-read flows, while adding precise qbo-webhook transition-aware behavior to avoid log spam.

## Scope
- Plan only. No implementation in this phase.
- Include behavior and test planning.
- Include README documentation updates in planned work.
- Include Admin Dashboard manual sync UX planning at /admin.

## Required Logging Outcomes
1. Admin create, admin manual link, admin manual sync, and portal-read flows should log a MissingQboPaymentUrl warning when qbo_payment_url is missing.
2. qbo-webhook flow should support setting qbo_payment_url from non-null to null in the database.
3. qbo-webhook flow should log MissingQboPaymentUrl only on transition from non-null to null.
4. qbo-webhook flow should not log when qbo_payment_url is already null and remains null.
5. This transition-only webhook rule is specifically to prevent Developer Log spam.

## Admin Dashboard Manual Sync Requirement (New)
Create a manual sync button on /admin that triggers an admin-initiated full refresh of relevant QBO-derived data used by admin workflows.

Required sync coverage:
1. Client Accounts card data on /admin (including Action Needed source data freshness tied to invoice sync state).
2. Developer Logs behavior for any new errors generated during this admin-triggered QBO sync.
3. Invoice Management reference data refresh on /admin/invoices:
  - QBO Products/Services for the Create in QuickBooks tab.
  - QBO Customers for the Link Existing Invoice tab, specifically the New QBO Client flow.

Operational rules for this manual sync:
1. Button appears on Admin Dashboard UI at /admin.
2. Sync is explicit user action and tagged as admin-sync origin context.
3. Sync runs safely with clear success/error feedback in UI.
4. MissingQboPaymentUrl logging rules in this plan still apply, including qbo-webhook transition-only anti-spam behavior.

## Origin Context Model for Logging
Define a source/origin context in the plan for logging decisions.

Planned origin values:
- admin-create
- admin-link
- admin-sync
- portal-read
- qbo-webhook

Planned routing policy:
- admin-create: log missing payment URL
- admin-link: log missing payment URL
- admin-sync: log missing payment URL
- portal-read: log missing payment URL with dedupe/cooldown protection
- qbo-webhook: log only on non-null to null transition

## Implementation Plan (Ordered)
1. Extend missing payment URL log helper contract.
2. Wire missing payment URL logging where QBO state is extracted and persisted.
3. Pass origin context from each route/entrypoint.
4. Add webhook transition-aware conditional logging logic.
5. Add Admin Dashboard manual sync endpoint and UI button flow.
6. Ensure manual sync refreshes Admin Client Accounts, Invoice Management QBO Products/Services, and QBO Customers datasets.
7. Validate admin Action Needed and Developer Logs alignment.
8. Add tests for transition and anti-spam behavior plus manual sync workflow.
9. Add README documentation for logging behavior and admin manual sync behavior.

## Step Details

### 1) Extend Log Helper Contract
Planned targets:
- lib/db.ts

Planned changes:
- Add origin context input for missing payment URL logger.
- Keep existing cooldown dedupe behavior.
- Include origin metadata in log payload for troubleshooting.

### 2) Wire Logging in QBO Sync/Link Flows
Planned targets:
- lib/quickbooks-sync.ts

Planned changes:
- Add missing payment URL warning call after state extraction/persistence in:
  - syncInvoiceToQuickBooks
  - syncInvoiceByQuickBooksInvoiceId
  - linkInvoiceById
- Keep logger call non-blocking with error isolation so invoice processing is not interrupted by log write failures.

### 3) Pass Origin Context From Entry Routes
Planned targets:
- app/api/invoices/route.ts
- app/api/invoices/[id]/sync/route.ts
- app/api/webhooks/quickbooks/route.ts
- app/api/clients/me/route.ts

Planned mapping:
- Invoice create route: admin-create
- Manual link route: admin-link
- Manual sync route: admin-sync
- Portal read sync: portal-read
- Webhook sync: qbo-webhook

### 4) qbo-webhook Transition-Aware Rule (New Requirement)
Planned behavior:
- qbo-webhook updates are allowed to write qbo_payment_url to null even when DB previously had a non-null URL.
- For qbo-webhook only, emit MissingQboPaymentUrl warning when DB value transitions:
  - previous qbo_payment_url: non-null/non-empty
  - incoming qbo_payment_url: null/empty
- For qbo-webhook, do not emit warning when both previous and incoming values are null/empty.

Planned data needed per evaluation:
- Previous DB qbo_payment_url value before update.
- Incoming QBO-derived qbo_payment_url value.

Planned anti-spam rule:
- Transition-only condition for qbo-webhook plus normal dedupe/cooldown ensures no repetitive warnings for already-null state.

### 5) Action Needed and Developer Logs Alignment
Planned targets:
- app/api/admin/clients/[clientId]/action-needed/route.ts
- app/api/admin/logs/route.ts
- app/admin/developer/page.tsx

Planned verification goals:
- Action Needed issues continue to surface missing links.
- Developer Logs include corresponding MissingQboPaymentUrl warnings according to origin and webhook transition rules.

### 6) Admin Dashboard Manual Sync UX + Endpoint (New Requirement)
Planned targets:
- app/admin/page.tsx
- app/api/admin/* (new or existing admin sync route to orchestrate full dashboard-relevant refresh)
- lib/quickbooks-sync.ts
- app/admin/invoices/page.tsx (for post-sync refetch triggers and UI consistency)

Planned behavior:
- Add a Manual Sync button on /admin.
- Button triggers an admin-only sync route that orchestrates:
  - Invoice sync refresh for data that powers /admin Client Accounts and Action Needed context.
  - QBO Products/Services refresh for Create in QuickBooks tab.
  - QBO Customers refresh for Link Existing Invoice tab (New QBO Client flow).
- Return structured summary payload for UI messaging:
  - counts updated
  - warnings/errors encountered
  - whether new Developer Logs were created

Planned logging behavior during this flow:
- Manual sync action is tagged as admin-sync origin.
- New sync-generated errors are persisted to Developer Logs when applicable.
- qbo-webhook transition-only rule remains limited to webhook-origin events.

### 7) Data Freshness Integration Across Admin Surfaces
Planned targets:
- app/admin/page.tsx
- app/admin/invoices/page.tsx

Planned verification goals:
- After manual sync completes, /admin Client Accounts view reflects refreshed state.
- Invoice Management refreshes QBO Products/Services and QBO Customers without requiring full page reload.
- Any new sync issues are visible in Developer Logs according to plan rules.

### 8) Test Plan (Automated + Manual)
Planned targets:
- tests/app/api/* relevant invoice/sync/webhook route tests
- tests/lib/* relevant quickbooks sync and logging tests
- tests/app/admin/* or component-level tests for /admin manual sync button behavior (where test harness exists)

Planned must-cover scenarios:
1. admin-create with missing URL logs warning.
2. admin-link with missing URL logs warning.
3. admin-sync with missing URL logs warning.
4. portal-read with missing URL logs warning (subject to cooldown dedupe).
5. qbo-webhook non-null to null transition logs warning.
6. qbo-webhook null to null does not log warning.
7. qbo-webhook non-null to non-null does not log missing URL warning.
8. Cooldown dedupe suppresses duplicates for repeat events within window.
9. Logging failure does not break invoice operations.
10. /admin manual sync button triggers admin-only sync endpoint and returns visible success/failure status.
11. Manual sync refreshes datasets for Client Accounts card, QBO Products/Services, and QBO Customers.
12. Manual sync-created new errors appear in Developer Logs.

Manual verification checklist (planned):
- Validate Action Needed popup behavior on admin page.
- Validate Developer Logs display for expected warning entries.
- Validate webhook-driven repeated syncs do not spam logs when URL already null.
- Validate Manual Sync button exists and is usable on /admin.
- Validate Manual Sync updates Client Accounts data on /admin.
- Validate /admin/invoices Create in QuickBooks tab product/service list is refreshed.
- Validate /admin/invoices Link Existing Invoice tab New QBO Client customer list is refreshed.

### 9) README Documentation Update (New Requirement)
Planned target:
- README.md

Planned additions:
- A section describing MissingQboPaymentUrl logging behavior by origin.
- Explicit webhook transition rule:
  - qbo-webhook can set non-null qbo_payment_url to null in DB.
  - Log warning only when transition is non-null to null.
  - Do not log when already null to avoid spam.
- A section describing Admin Dashboard Manual Sync behavior:
  - where button is located (/admin)
  - what datasets it refreshes (Client Accounts sync-backed data, QBO Products/Services, QBO Customers)
  - how sync outcomes/errors are surfaced in Developer Logs
- Brief troubleshooting notes on how to interpret Developer Log warnings for missing payment links.

## Risk and Regression Considerations
1. Over-logging risk if origin is not passed consistently from all entrypoints.
2. Under-logging risk if transition detection does not compare previous DB value correctly.
3. Behavior drift risk if webhook and non-webhook flows share update helpers without explicit origin rules.
4. Portal-read frequency could still generate noise without cooldown protection.

## Acceptance Criteria
1. Missing qbo_payment_url warnings are visible in Developer Logs for admin-create, admin-link, admin-sync, and portal-read when applicable.
2. qbo-webhook can persist non-null to null qbo_payment_url changes.
3. qbo-webhook logs warning only for non-null to null transition.
4. qbo-webhook does not log when value remains null.
5. /admin has a manual sync button planned that triggers an admin-initiated sync flow.
6. Manual sync flow is planned to refresh Client Accounts sync-backed data, QBO Products/Services, and QBO Customers data used by Invoice Management tabs.
7. New errors generated during manual sync are planned to appear in Developer Logs under admin-sync context.
8. README documents the full behavior, including webhook transition anti-spam logic and admin manual sync behavior.
9. No implementation has started in this phase.

## Delivery Notes
- This file is planning output only.
- Implementation should begin only after explicit approval.
