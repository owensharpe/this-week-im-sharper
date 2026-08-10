"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header
      className={[
        "sticky top-0 z-40 border-b border-border backdrop-blur transition-colors duration-300",
        // Issue pages sit on the paper tint, so the header carries it too.
        pathname.startsWith("/issues/")
          ? "bg-paper/70 supports-[backdrop-filter]:bg-paper/60"
          : "bg-background/70 supports-[backdrop-filter]:bg-background/60",
      ].join(" ")}
    >
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="group flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-tight group-hover:text-brand transition-colors">
            This Week I&apos;m Sharper
          </h1>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === item.href || pathname.startsWith("/dashboard/")
                : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative px-2 py-1 text-sm font-mono uppercase tracking-wider transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {item.label}
                <span
                  aria-hidden
                  className={[
                    "absolute left-2 right-2 -bottom-0.5 h-px bg-brand transition-transform duration-300 origin-left",
                    active ? "scale-x-100" : "scale-x-0",
                  ].join(" ")}
                />
              </Link>
            );
          })}
          <div className="pl-1">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
