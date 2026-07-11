import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <p className="footer-mark">The Garden</p>
      <p>Tended by Xianhong.</p>
      <nav className="footer-links" aria-label="Footer">
        <a href="#garden-guide-toggle">Garden Guide</a>
        <Link href="/garden-index">Garden Index</Link>
        <Link href="/search">Search the Garden</Link>
        <span aria-disabled="true">Leave a note</span>
      </nav>
      <p className="unavailable-note">This path is still being prepared.</p>
    </footer>
  );
}
