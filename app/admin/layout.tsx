import type { Metadata } from "next";

import "./admin.css";

export const metadata: Metadata = {
  title: "Garden Keeper",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="admin-root">
      <a className="admin-skip-link" href="#admin-main">
        Skip to admin content
      </a>
      {children}
    </div>
  );
}
