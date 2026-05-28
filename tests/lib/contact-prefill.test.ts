import { describe, expect, it } from "vitest";
import {
  applyClientProfilePrefill,
  applyMessagePrefill,
  buildMissingPaymentUrlMessage,
  type ContactFieldValues,
  type ContactTouchedState,
} from "@/lib/contact-prefill";

function emptyValues(): ContactFieldValues {
  return {
    name: "",
    email: "",
    business_name: "",
    message: "",
  };
}

function untouched(): ContactTouchedState {
  return {
    name: false,
    email: false,
    business_name: false,
    message: false,
  };
}

describe("buildMissingPaymentUrlMessage", () => {
  it("builds the missing-link template with a blank line after it", () => {
    const message = buildMissingPaymentUrlMessage({
      contactContext: "missing-qbo-payment-url",
      invoiceId: "inv_123",
      qboDocNumber: "1005",
    });

    expect(message).toBe(
      "The QuickBooks Online payment link (\"qbo_payment_url\") for invoice 1005 does not exist. Contact customer support for assistance.\n\n"
    );
  });
});

describe("applyMessagePrefill", () => {
  it("applies message prefill when untouched and empty", () => {
    const result = applyMessagePrefill(emptyValues(), untouched(), "prefilled\n\n");

    expect(result.message).toBe("prefilled\n\n");
  });

  it("does not override typed message", () => {
    const values = { ...emptyValues(), message: "I already typed this." };
    const result = applyMessagePrefill(values, { ...untouched(), message: true }, "prefilled\n\n");

    expect(result.message).toBe("I already typed this.");
  });
});

describe("applyClientProfilePrefill", () => {
  it("prefills name, email, and business name from client profile when fields are empty", () => {
    const result = applyClientProfilePrefill(emptyValues(), untouched(), {
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      company_name: "Acme Corp",
    });

    expect(result.name).toBe("Jane Doe");
    expect(result.email).toBe("jane@example.com");
    expect(result.business_name).toBe("Acme Corp");
  });

  it("does not override touched or already-filled fields", () => {
    const values = {
      name: "Existing Name",
      email: "existing@example.com",
      business_name: "Existing Co",
      message: "",
    };

    const result = applyClientProfilePrefill(values, { ...untouched(), name: true, email: true, business_name: true }, {
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      company_name: "Acme Corp",
    });

    expect(result.name).toBe("Existing Name");
    expect(result.email).toBe("existing@example.com");
    expect(result.business_name).toBe("Existing Co");
  });
});