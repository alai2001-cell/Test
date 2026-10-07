import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Limitless Daily",
  description: "Daily pendant transcripts and summaries",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">● Limitless Daily</Link>
          <form action="/search" className="topsearch">
            <input name="q" type="search" placeholder="Search everything you've said…" />
          </form>
          <nav>
            <Link href="/">Days</Link>
            <Link href="/settings">Settings</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
