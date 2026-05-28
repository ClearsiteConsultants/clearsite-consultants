import { describe, expect, it } from "vitest";
import { buildMissingPaymentUrlContactHref } from "@/lib/portal-contact";

describe("buildMissingPaymentUrlContactHref", () => {
  it("includes missing-link context params in Contact Support href", () => {
    const href = buildMissingPaymentUrlContactHref("inv_123", "1005");

    expect(href).toBe("/?contactContext=missing-qbo-payment-url&invoiceId=inv_123&qboDocNumber=1005#contact");
  });

  it("omits qboDocNumber when it is not present", () => {
    const href = buildMissingPaymentUrlContactHref("inv_123", null);

    expect(href).toBe("/?contactContext=missing-qbo-payment-url&invoiceId=inv_123#contact");
  });
});