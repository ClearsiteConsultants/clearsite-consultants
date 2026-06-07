export const BILLING_FIELD_LIMITS = {
  billing_address_line1: 46,
  billing_address_line2: 46,
  billing_city: 50,
  billing_postal_code: 13,
  billing_state: 2, // 2-letter code
} as const;

export type BillingField = keyof typeof BILLING_FIELD_LIMITS;

export function isFieldAtLimit(field: BillingField, value: string): boolean {
  return value.length >= BILLING_FIELD_LIMITS[field];
}
