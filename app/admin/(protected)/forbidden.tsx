import Link from "next/link";

export default function AdminForbidden() {
  return (
    <main id="admin-main" className="admin-access-page">
      <section className="admin-access-card" aria-labelledby="forbidden-title">
        <p className="admin-status-code">403</p>
        <h1 id="forbidden-title">需要 Garden Keeper 权限</h1>
        <p>当前账号无法访问管理区域。</p>
        <div className="admin-access-actions">
          <Link className="admin-primary-action" href="/">
            返回 The Garden
          </Link>
        </div>
      </section>
    </main>
  );
}
