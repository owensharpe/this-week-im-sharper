import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="group">
          <h1 className="text-lg font-semibold tracking-tight group-hover:opacity-80 transition-opacity">
            This Week I&apos;m Sharper
          </h1>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/archive"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Archive
          </Link>
          <Link
            href="/about"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
