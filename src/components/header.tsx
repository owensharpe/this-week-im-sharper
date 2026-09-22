"use client";

import Link from "next/link";
import { useRoutePath } from "@/lib/use-route-path";
import { ThemeToggle } from "./theme-toggle";

/** `prefix` marks a section with child routes, which keep the tab underlined. */
const NAV = [
  { href: "/dashboard", label: "Dashboard", prefix: true },
  { href: "/research", label: "Research", prefix: true },
  { href: "/archive", label: "Archive", prefix: false },
  { href: "/about", label: "About", prefix: false },
];

export function Header() {
  // Normalised, not raw: the front page can report itself as "/index" on the
  // deployed site, which otherwise hands the running head to a nameplate that
  // hasn't scrolled away yet. See useRoutePath.
  const pathname = useRoutePath();

  return (
    <header className="sticky top-0 z-40 border-b border-border">
      {/* The tint and the blur sit on their own layer behind the content rather
          than on the header itself. Chrome renders ::selection noticeably
          darker inside a backdrop-filtered compositing layer, which turned the
          nav's brand-navy highlight almost black while the same selection
          elsewhere on the page came out correctly. Keeping the text out of the
          filtered layer fixes that without giving up the blur. */}
      <div
        aria-hidden
        className={[
          "absolute inset-0 -z-10 backdrop-blur transition-colors duration-300",
          // Issue pages sit on the paper tint, so the header carries it too.
          pathname.startsWith("/issues/")
            ? "bg-paper/70 supports-[backdrop-filter]:bg-paper/60"
            : "bg-background/70 supports-[backdrop-filter]:bg-background/60",
        ].join(" ")}
      />
      {/* Four mono nav items plus the wordmark need about 600px to share a
          line, so on phones the nav drops to its own row: it is the only
          w-full child, which forces the wrap. `order` then rearranges the three
          children per breakpoint — wordmark / toggle / nav stacked on a phone,
          wordmark / nav / toggle across one line above that. Laid out this way
          rather than with elements hidden per breakpoint, so each of them only
          ever mounts once. */}
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* On the front page this is the same words as the nameplate directly
            below it, so it stays out of the way until the nameplate has
            scrolled off — a paper carries its nameplate on page one and its
            running head on the interior pages, never both at once. Everywhere
            else it is simply always there. */}
        <Link
          href="/"
          className={[
            "group order-1 mr-auto flex items-baseline gap-2",
            pathname === "/" ? "running-head" : "",
          ].join(" ")}
        >
          <h1 className="text-base sm:text-lg font-semibold tracking-tight leading-tight whitespace-nowrap group-hover:text-brand transition-colors">
            This Week I&apos;m Sharper
          </h1>
        </Link>
        {/* Negative margin on mobile pulls the first item's padding back so the
            nav row aligns with the wordmark above it. */}
        <nav className="order-3 sm:order-2 w-full sm:w-auto -mx-1.5 sm:mx-0 flex items-center gap-0 sm:gap-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.prefix && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative px-1.5 sm:px-2 py-1 text-[11px] sm:text-sm font-mono uppercase tracking-wide sm:tracking-wider transition-colors",
                  // Hover goes to brand, matching every other link on the site.
                  // The current page stays plain foreground: it already has the
                  // brand rule under it, and colouring it too would leave "you
                  // are here" and "you could go here" looking the same.
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-brand",
                ].join(" ")}
              >
                {item.label}
                <span
                  aria-hidden
                  className={[
                    "absolute left-1.5 right-1.5 sm:left-2 sm:right-2 -bottom-0.5 h-px bg-brand transition-transform duration-300 origin-left",
                    active ? "scale-x-100" : "scale-x-0",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>
        <div className="order-2 sm:order-3 sm:pl-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
