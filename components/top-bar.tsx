import Link from "next/link";
import { GardenGuide } from "./garden-guide";

export function TopBar() {
  return (
    <header className="top-bar">
      <Link className="site-mark" href="/">The Garden</Link>
      <div className="top-actions">
        <Link className="search-link" href="/search" aria-label="Search the Garden">
          <span aria-hidden="true">⌕</span>
        </Link>
        <GardenGuide />
      </div>
    </header>
  );
}
