### 2026-05-23T17:54:56.0195159-06:00: Next-invoice-due reversal fix
**By:** Livingston (via Copilot)
**What:** Updated `updateInvoiceStatusByQuickBooksInvoiceId` to branch by status: paid updates retain COALESCE behavior, while non-paid updates force `paid_at = NULL` and normalize `amount_paid` to zero/default payload value so paid->unpaid reversals clear stale payment markers.
**Why:** Reviewer-found high-severity bug where COALESCE preserved stale paid_at during status reversal, excluding reversed invoices from earliest-unpaid computation and breaking `next_invoice_due` accuracy.
