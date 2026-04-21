// Copy sent to the agent when they opt for Zelle/wire instead of Square.
// Keep this file editable without touching the email-send code — the owner
// will personalize the Zelle address and wire details here pre-launch.
//
// Template placeholders — the email template replaces these at send time:
//   [AMOUNT]          → "1,500.00"
//   [REFERENCE_CODE]  → "BC-2026-001234"

export const ALTERNATE_PAYMENT_INSTRUCTIONS = `To pay via Zelle:
  Send to: 805-404-5821
  Amount: $[AMOUNT]
  Reference: [REFERENCE_CODE]  ← include this in the memo

To pay via wire transfer, reply to this email and we'll send routing details.

Once you've sent payment, reply to this email so we can confirm receipt.
Feature campaign kicks off within 24 hours of confirmed payment.`;
