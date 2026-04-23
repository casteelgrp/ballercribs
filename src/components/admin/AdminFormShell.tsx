/**
 * Minimal shared wrappers for admin form pages. Kept deliberately
 * opinion-free: the shell is the outer container we've converged on
 * (`max-w-5xl` + horizontal padding + top/bottom padding), the card is
 * the bordered white panel that surrounds actual form fields. Pages
 * render their own title + subtitle + back-link inside the shell —
 * different admin pages have slightly different header shapes, and
 * encoding that into props would grow the API without buying much.
 *
 * Usage:
 *   <AdminFormShell>
 *     <h2 className="font-display text-2xl mb-1">New listing</h2>
 *     <p className="text-sm text-black/60 mb-6">…</p>
 *     <AdminFormCard>
 *       <SomeForm />
 *     </AdminFormCard>
 *   </AdminFormShell>
 */
export function AdminFormShell({ children }: { children: React.ReactNode }) {
  return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">{children}</div>;
}

export function AdminFormCard({ children }: { children: React.ReactNode }) {
  return <div className="border border-black/10 bg-white p-6">{children}</div>;
}
