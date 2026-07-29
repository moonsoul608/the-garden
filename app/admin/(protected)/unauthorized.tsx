import Link from "next/link";

import { GitHubLoginButton } from "../github-login-button";

export default function AdminUnauthorized() {
  return (
    <main id="admin-main" className="admin-access-page">
      <section className="admin-access-card" aria-labelledby="login-title">
        <p className="admin-status-code">401</p>
        <h1 id="login-title">需要登录</h1>
        <p>请使用 GitHub 登录后继续访问 Garden Keeper 区域。</p>
        <div className="admin-access-actions">
          <GitHubLoginButton />
          <Link href="/">返回 The Garden</Link>
        </div>
      </section>
    </main>
  );
}
