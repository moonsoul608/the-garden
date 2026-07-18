import Link from "next/link";
import { forbidden, redirect } from "next/navigation";

import {
  AuthenticationRequiredError,
  GardenKeeperRequiredError,
  requireGardenKeeper,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    await requireGardenKeeper();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/auth/login/github?next=/admin");
    }

    if (error instanceof GardenKeeperRequiredError) {
      forbidden();
    }

    throw error;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <header className="admin-brand">
          <Link href="/admin">The Garden</Link>
          <span>Garden Keeper</span>
        </header>

        <nav className="admin-navigation" aria-label="Admin navigation">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/content">Content</Link>
          <Link href="/admin/review">Review queue</Link>
          <Link href="/admin/lifecycle">Lifecycle</Link>
          <Link href="/admin/media">Media</Link>
        </nav>

        <div className="admin-identity">
          <span>Signed in</span>
          <strong>Garden Keeper</strong>
        </div>
      </aside>

      {children}
    </div>
  );
}
