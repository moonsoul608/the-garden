import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <p className="footer-mark">The Garden</p>
      <p>Tended by Xianhong.</p>
      <nav className="footer-links" aria-label="Footer">
        <a href="#garden-guide-toggle">Garden Guide</a>
        <Link href="/garden-index">Garden Index</Link>
        <Link href="/leave-a-note">Leave a note</Link>
      </nav>
      <p className="unavailable-note">Notes are private and never appear as public comments.</p>
    </footer>
  );
}
