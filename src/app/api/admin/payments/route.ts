import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import {
  listPayments,
  type InquiryPaymentType,
  type PaymentStatus
} from "@/lib/payments";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set<PaymentStatus>([
  "pending",
  "paid",
  "failed",
  "refunded",
  "cancelled"
]);

const ALLOWED_TYPES = new Set<InquiryPaymentType>(["buyer_lead", "agent_feature"]);

/**
 * GET /api/admin/payments
 *
 * Owner-only. Query params: status?, inquiry_type?, limit?, offset?.
 * Returns payments sorted newest-first, with the linked inquiry's submitter
 * name COALESCEd across both inquiry tables.
 */
export async function GET(req: Request) {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const typeParam = url.searchParams.get("inquiry_type");
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const status = statusParam && ALLOWED_STATUSES.has(statusParam as PaymentStatus)
    ? (statusParam as PaymentStatus)
    : undefined;
  const inquiry_type =
    typeParam && ALLOWED_TYPES.has(typeParam as InquiryPaymentType)
      ? (typeParam as InquiryPaymentType)
      : undefined;

  const payments = await listPayments({
    status,
    inquiry_type,
    limit: Math.min(Math.max(limit, 1), 500),
    offset: Math.max(offset, 0)
  });

  return NextResponse.json({ ok: true, payments });
}
