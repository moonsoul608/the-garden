import Link from "next/link";

import { GitHubLoginButton } from "../github-login-button";

export default function AdminUnauthorized() {
  return (
    <main id="admin-main" className="admin-access-page">
      <section className="admin-access-card" aria-labelledby="login-title">
        <p className="admin-status-code">401</p>
        <h1 id="login-title">Keeper sign in required</h1>
        <p>Sign in with GitHub to continue to the Garden Keeper area.</p>
        <div className="admin-access-actions">
          <GitHubLoginButton />
          <Link href="/">Return to The Garden</Link>
        </div>
      </section>
    </main>
  );
}
