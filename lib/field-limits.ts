export const BILLING_FIELD_LIMITS = {
  billing_address_line1: 46,
  billing_address_line2: 46,
  billing_city: 50,
  billing_postal_code: 13,
  billing_state: 2, // 2-letter code
} as const;

export type BillingField = keyof typeof BILLING_FIELD_LIMITS;

export const ACCOUNT_INFO_FIELD_LIMITS = {
  company_name: 255,
  phone: 50,
  email: 255,
} as const;

export type AccountInfoField = keyof typeof ACCOUNT_INFO_FIELD_LIMITS;

export function isFieldAtLimit(field: BillingField | AccountInfoField, value: string): boolean {
  if (field in BILLING_FIELD_LIMITS) {
    return value.length >= BILLING_FIELD_LIMITS[field as BillingField];
  }
  if (field in ACCOUNT_INFO_FIELD_LIMITS) {
    return value.length >= ACCOUNT_INFO_FIELD_LIMITS[field as AccountInfoField];
  }
  return false;
}

export const INVOICE_FIELD_LIMITS = {
  qbo_doc_number: 15,
  amount_due_digits: 7, // Support up to 99,999.99 entry (7 digits including cents)
} as const;

export type InvoiceField = keyof typeof INVOICE_FIELD_LIMITS;
