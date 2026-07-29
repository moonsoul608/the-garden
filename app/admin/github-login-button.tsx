export function GitHubLoginButton() {
  return (
    <a
      className="admin-primary-action"
      href="/auth/login/github?next=/admin"
    >
      使用 GitHub 继续
    </a>
  );
}
