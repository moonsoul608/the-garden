import Link from "next/link";

export default function AdminForbidden() {
  return (
    <main id="admin-main" className="admin-access-page">
      <section className="admin-access-card" aria-labelledby="forbidden-title">
        <p className="admin-status-code">403</p>
        <h1 id="forbidden-title">Garden Keeper access required</h1>
        <p>This account cannot access the admin area.</p>
        <div className="admin-access-actions">
          <Link className="admin-primary-action" href="/">
            Return to The Garden
          </Link>
        </div>
      </section>
    </main>
  );
}
