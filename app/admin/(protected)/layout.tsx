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

        <nav className="admin-navigation" aria-label="管理导航">
          <Link href="/admin">工作台</Link>
          <Link href="/admin/home">首页精选</Link>
          <Link href="/admin/content">内容管理</Link>
          <Link href="/admin/review">审核队列</Link>
          <Link href="/admin/lifecycle">生命周期管理</Link>
          <Link href="/admin/media">媒体库</Link>
          <Link href="/admin/notes">访客留言</Link>
        </nav>

        <div className="admin-identity">
          <span>已登录</span>
          <strong>Garden Keeper</strong>
        </div>
      </aside>

      {children}
    </div>
  );
}
