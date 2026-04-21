import { NextResponse } from "next/server";
import {
  deleteInquiry,
  updateInquiryLastContacted,
  updateInquiryNotes,
  updateInquiryStatus
} from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth";
import type { InquiryStatus } from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED_STATUSES: ReadonlySet<InquiryStatus> = new Set([
  "new",
  "working",
  "won",
  "dead"
]);

/**
 * PATCH /api/admin/inquiries/[id] — update pipeline fields on a buyer inquiry.
 * Accepts any combination of { status, notes, last_contacted_at }. Authenticated
 * users only (requireUser, not requireOwner) since every admin working inquiries
 * needs to push them through the pipeline.
 *
 * `last_contacted_at` accepts either an ISO string (set to that time), null
 * (not supported here — leave the field alone instead), or the literal string
 * "now" to stamp NOW() server-side. Missing key = not modified.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: { status?: unknown; notes?: unknown; last_contacted_at?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Pipeline sequence: apply whichever fields the caller sent, in order. Each
  // helper re-fetches with the user JOIN so we always return the latest row.
  let latest = null;

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !ALLOWED_STATUSES.has(body.status as InquiryStatus)) {
      return NextResponse.json(
        { error: "status must be one of: new, working, won, dead." },
        { status: 400 }
      );
    }
    latest = await updateInquiryStatus(id, body.status as InquiryStatus, user.id);
    if (!latest) {
      return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    }
  }

  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return NextResponse.json({ error: "notes must be a string or null." }, { status: 400 });
    }
    latest = await updateInquiryNotes(id, body.notes as string | null);
    if (!latest) {
      return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    }
  }

  if (body.last_contacted_at !== undefined) {
    const raw = body.last_contacted_at;
    let when: Date | undefined;
    if (raw === "now") {
      when = undefined; // the helper stamps NOW() when undefined
    } else if (typeof raw === "string") {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid last_contacted_at." }, { status: 400 });
      }
      when = d;
    } else {
      return NextResponse.json(
        { error: "last_contacted_at must be an ISO string or 'now'." },
        { status: 400 }
      );
    }
    latest = await updateInquiryLastContacted(id, when);
    if (!latest) {
      return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    }
  }

  if (!latest) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, inquiry: latest });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const ok = await deleteInquiry(id);
  if (!ok) {
    return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
