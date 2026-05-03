import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates that a URL is an HTTPS QuickBooks / Intuit payment link.
 * Accepted domains: *.intuit.com, app.qbo.intuit.com, quickbooks.intuit.com.
 */
export const QBO_PAYMENT_URL_PATTERN =
  /^https:\/\/((?:[a-z0-9-]+\.)*intuit\.com|app\.qbo\.intuit\.com|quickbooks\.intuit\.com)(\/[^\s]*)?$/i;

export function isValidQboPaymentUrl(url: string): boolean {
  return QBO_PAYMENT_URL_PATTERN.test(url);
}

export function sanitizeCurrencyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCurrencyFromDigits(digits: string): string {
  if (!digits) return "";

  const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
  const padded = normalizedDigits.padStart(3, "0");
  const dollars = padded.slice(0, -2);
  const cents = padded.slice(-2);

  return `${Number(dollars).toLocaleString("en-US")}.${cents}`;
}

export function currencyDigitsToNumber(digits: string): number {
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}
