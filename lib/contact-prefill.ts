export type ContactFieldValues = {
  name: string;
  email: string;
  business_name: string;
  message: string;
};

export type ContactTouchedState = {
  name: boolean;
  email: boolean;
  business_name: boolean;
  message: boolean;
};

export type ClientContactProfile = {
  email?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export function buildMissingPaymentUrlMessage(params: {
  contactContext: string | null;
  invoiceId: string | null;
  qboDocNumber: string | null;
}) {
  const { contactContext, invoiceId, qboDocNumber } = params;
  if (contactContext !== "missing-qbo-payment-url") return null;

  const docOrFallback = qboDocNumber?.trim() || invoiceId?.trim();
  if (!docOrFallback) return null;

  return `The QuickBooks Online payment link ("qbo_payment_url") for invoice ${docOrFallback} does not exist. Contact customer support for assistance.\n\n`;
}

export function applyMessagePrefill(
  values: ContactFieldValues,
  touched: ContactTouchedState,
  message: string | null
) {
  if (!message) return values;
  if (touched.message || values.message.trim().length > 0) return values;

  return {
    ...values,
    message,
  };
}

export function applyClientProfilePrefill(
  values: ContactFieldValues,
  touched: ContactTouchedState,
  profile: ClientContactProfile
) {
  const firstName = profile.first_name?.trim() || "";
  const lastName = profile.last_name?.trim() || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const email = profile.email?.trim() || "";
  const businessName = profile.company_name?.trim() || "";

  return {
    ...values,
    name: !touched.name && values.name.trim().length === 0 && fullName ? fullName : values.name,
    email: !touched.email && values.email.trim().length === 0 && email ? email : values.email,
    business_name:
      !touched.business_name && values.business_name.trim().length === 0 && businessName
        ? businessName
        : values.business_name,
  };
}