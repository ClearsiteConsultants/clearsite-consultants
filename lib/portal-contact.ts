export function buildMissingPaymentUrlContactHref(invoiceId: string, qboDocNumber: string | null) {
  const params = new URLSearchParams({
    contactContext: "missing-qbo-payment-url",
    invoiceId,
  });

  if (qboDocNumber && qboDocNumber.trim()) {
    params.set("qboDocNumber", qboDocNumber.trim());
  }

  return `/?${params.toString()}#contact`;
}