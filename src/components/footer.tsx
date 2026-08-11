import Link from "next/link";
import { EMAIL, GITHUB_REPO_URL, LINKEDIN_URL } from "@/lib/links";

const FOOTER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
];

const EXTERNAL = [
  { href: GITHUB_REPO_URL, label: "GitHub" },
  { href: LINKEDIN_URL, label: "LinkedIn" },
  { href: `mailto:${EMAIL}`, label: "Contact" },
];

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-4xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-semibold tracking-tight">
            This Week I&apos;m Sharper
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
            A weekly briefing on finance, markets, and the policy decisions
            shaping them.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 sm:justify-end">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {EXTERNAL.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={
                link.href.startsWith("http") ? "noopener noreferrer" : undefined
              }
              className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="border-t border-border/60">
        <div className="max-w-4xl mx-auto px-4 py-4 text-xs text-muted-foreground font-mono">
          &copy; {new Date().getFullYear()} Owen Sharpe
        </div>
      </div>
    </footer>
  );
}
