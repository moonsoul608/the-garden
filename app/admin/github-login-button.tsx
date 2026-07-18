export function GitHubLoginButton() {
  return (
    <a
      className="admin-primary-action"
      href="/auth/login/github?next=/admin"
    >
      Continue with GitHub
    </a>
  );
}
