import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ProfileForm } from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage({
  searchParams
}: {
  searchParams: Promise<{ force?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const { force } = await searchParams;
  const isForced = force === "1" || user.must_change_password;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {!isForced && (
        <section className="mb-12">
          <h2 className="font-display text-2xl mb-6">Profile</h2>
          <ProfileForm initialName={user.name} initialEmail={user.email} />
        </section>
      )}

      <section>
        <h2 className="font-display text-2xl mb-6">Change password</h2>
        <ChangePasswordForm force={isForced} />
      </section>
    </div>
  );
}
