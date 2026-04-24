import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchAdmin } from "@/lib/search";

export const runtime = "nodejs";

/**
 * GET /api/admin/search?q=<query>&limit=<n>
 *
 * Authed admin search — returns AdminSearchResults grouped by kind.
 * No status filter; admins need to find half-written drafts. The
 * dropdown UI calls this with limit=5; the full-results page calls
 * with limit=25. Hard cap at 50 to keep any single response bounded.
 */
export async function GET(req: Request) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limitRaw = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(50, Math.floor(limitRaw))
      : 5;

  try {
    const results = await searchAdmin(q, { limit });
    return NextResponse.json(results);
  } catch (err) {
    console.error("[admin-search] failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
