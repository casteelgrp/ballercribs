import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import {
  getAgentInquiryById,
  getRentalInquiryById,
  updateAgentInquiryStatus,
  updateRentalInquiryStatus
} from "@/lib/db";
import {
  getPaymentById,
  sendPaymentReceivedNotification,
  updatePayment,
  type PaymentMethod
} from "@/lib/payments";

export const runtime = "nodejs";

const ALTERNATE_METHODS: ReadonlySet<PaymentMethod> = new Set([
  "zelle",
  "wire",
  "check",
  "cash"
]);

/**
 * POST /api/admin/payments/[id]/mark-paid
 *
 * Owner-only. Used for the alternate-payment path (Zelle/wire/check/cash)
 * once the admin has confirmed funds landed. Refuses to act on a payment
 * that's already paid/refunded/cancelled to prevent accidental double-marks.
 * Side effects mirror the webhook success path: flips the linked inquiry to
 * 'won' and notifies the owner by email.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: {
    payment_method?: unknown;
    received_date?: unknown;
    notes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const method = body.payment_method;
  if (typeof method !== "string" || !ALTERNATE_METHODS.has(method as PaymentMethod)) {
    return NextResponse.json(
      { error: "payment_method must be one of: zelle, wire, check, cash." },
      { status: 400 }
    );
  }

  let paidAt: Date | undefined;
  if (body.received_date !== undefined && body.received_date !== null && body.received_date !== "") {
    if (typeof body.received_date !== "string") {
      return NextResponse.json({ error: "received_date must be an ISO date string." }, { status: 400 });
    }
    const parsed = new Date(body.received_date);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "received_date is not a valid date." }, { status: 400 });
    }
    paidAt = parsed;
  }

  const existing = await getPaymentById(id);
  if (!existing) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot mark-paid a payment in status '${existing.status}'.` },
      { status: 409 }
    );
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  const updated = await updatePayment(id, {
    status: "paid",
    payment_method: method as PaymentMethod,
    paid_at: paidAt ?? new Date(),
    metadata_merge: {
      mark_paid: {
        method,
        received_date: paidAt?.toISOString() ?? null,
        notes: notes || null,
        at: new Date().toISOString()
      }
    }
  });
  if (!updated) {
    return NextResponse.json({ error: "Mark-paid failed." }, { status: 500 });
  }

  // Side effects: flip inquiry to 'won' and email the owner. These are
  // best-effort — we don't roll back the payment if either fails. Logs
  // will show the reason and the admin can re-trigger manually.
  let inquiryLabel = `${updated.inquiry_type} #${updated.inquiry_id}`;
  let payerName: string | null = null;
  let payerEmail: string | null = null;
  if (updated.inquiry_type === "agent_feature") {
    const inq = await getAgentInquiryById(updated.inquiry_id);
    if (inq) {
      inquiryLabel = `${inq.name} — ${inq.brokerage ?? inq.city_state ?? "agent inquiry"}`;
      payerName = inq.name;
      payerEmail = inq.email;
      await updateAgentInquiryStatus(inq.id, "won", null).catch((e) => {
        console.error("[mark-paid] failed to flip inquiry to won", e);
      });
    }
  } else if (updated.inquiry_type === "rental") {
    const inq = await getRentalInquiryById(updated.inquiry_id);
    if (inq) {
      inquiryLabel = `${inq.name} — ${inq.destination}`;
      payerName = inq.name;
      payerEmail = inq.email;
      await updateRentalInquiryStatus(inq.id, "won", null).catch((e) => {
        console.error("[mark-paid] failed to flip rental inquiry to won", e);
      });
    }
  }
  await sendPaymentReceivedNotification({
    payment: updated,
    payerName,
    payerEmail,
    inquiryLabel
  }).catch((e) => {
    console.error("[mark-paid] owner notify failed", e);
  });

  return NextResponse.json({ ok: true, payment: updated });
}
