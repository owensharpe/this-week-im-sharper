"use client";

import { usePathname } from "next/navigation";
import { WireTicker } from "./wire-ticker";

/**
 * The wire strip on interior pages.
 *
 * The front page is skipped because its own masthead already carries a wire in
 * the dateline block, where it belongs to the nameplate. Reading pages are
 * skipped too: a strip of moving text pinned above a long article competes with
 * the article, which is the one place on this site where nothing should. That
 * leaves it on the pages you arrive at and scan — indexes, the dashboard —
 * which is where a live wire actually earns its place.
 */
export function SiteWire({
  headlines,
  date,
}: {
  headlines: string[];
  date: string;
}) {
  const pathname = usePathname();

  const isFrontPage = pathname === "/";
  const isReadingPage =
    pathname.startsWith("/issues/") ||
    (pathname.startsWith("/research/") && pathname !== "/research");

  if (isFrontPage || isReadingPage) return null;

  return <WireTicker headlines={headlines} date={date} />;
}
