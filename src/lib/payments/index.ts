// Barrel + provider wiring. Anywhere else in the app that needs payment
// functionality imports from here — never from `./square` directly. Swapping
// providers means changing the one line below + adding a new impl file;
// route handlers and UI don't move.

import { squareProvider } from "./square";
import type { PaymentProvider } from "./types";

export const paymentProvider: PaymentProvider = squareProvider;

export * from "./types";
export { TIERS, TIER_KEYS, isTierKey, resolveTierAmount } from "./tiers";
export type { TierKey, TierConfig } from "./tiers";
export {
  createPayment,
  getPaymentById,
  getPaymentByReferenceCode,
  getPaymentByProviderOrderId,
  getPaymentByProviderPaymentId,
  getPaymentsForInquiry,
  updatePayment,
  listPayments,
  countPaymentsByStatus,
  logWebhookEvent,
  markWebhookLogResult,
  setAgentInquiryTier
} from "./db";
export type { CreatePaymentInput, ListPaymentsOptions, PaymentWithInquiryName } from "./db";
export {
  sendPaymentLinkEmail,
  sendAlternatePaymentEmail,
  sendPaymentReceivedNotification
} from "./emails";
