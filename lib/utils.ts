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
