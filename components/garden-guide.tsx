"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { regions, utilities } from "@/lib/regions";

export function GardenGuide() {
  const pathname = usePathname();
  const [currentPathname, setCurrentPathname] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isCurrent = (href: string) => currentPathname !== null && (href === "/" ? currentPathname === "/" : currentPathname === href || currentPathname.startsWith(`${href}/`));

  useEffect(() => setCurrentPathname(pathname), [pathname]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      if (window.location.hash === "#garden-guide-toggle") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      window.requestAnimationFrame(() => summaryRef.current?.focus());
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#garden-guide-toggle") setOpen(true);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  function closeGuide() {
    setOpen(false);
    if (window.location.hash === "#garden-guide-toggle") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    window.requestAnimationFrame(() => summaryRef.current?.focus());
  }

  return (
    <details
      className="guide"
      id="garden-guide"
      open={open}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        setOpen(nextOpen);
        if (nextOpen) window.requestAnimationFrame(() => closeRef.current?.focus());
        if (!nextOpen && window.location.hash === "#garden-guide-toggle") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }}
    >
      <summary ref={summaryRef} id="garden-guide-toggle" className="button button-primary" aria-expanded={open} aria-controls="garden-guide-panel">Garden Guide</summary>
      <div className="guide-panel" id="garden-guide-panel" aria-labelledby="garden-guide-title">
        <div className="guide-heading">
          <div><p className="eyebrow">Find a path</p><h2 id="garden-guide-title">Garden Guide</h2></div>
          <button ref={closeRef} className="guide-close" type="button" onClick={closeGuide} aria-label="Close Garden Guide"><span aria-hidden="true">×</span></button>
        </div>
        <nav aria-label="Garden regions">
          <p className="guide-label">Regions</p>
          <ul className="guide-list">
            {regions.map((region) => (
              <li key={region.name}>
                <Link className="guide-link" href={region.href} aria-current={isCurrent(region.href) ? "page" : undefined}>
                  <span>{region.name}</span>
                  {isCurrent(region.href) && <span className="current-marker">You are here.</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Garden utilities">
          <p className="guide-label">Utilities</p>
          <ul className="guide-list">
            {utilities.map((utility) => <li key={utility.name}><Link className="guide-link" href={utility.href}>{utility.name}</Link></li>)}
          </ul>
        </nav>
      </div>
    </details>
  );
}
