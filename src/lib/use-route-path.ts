"use client";

import { usePathname } from "next/navigation";

/**
 * The current route, with the front page always spelled `"/"`.
 *
 * `usePathname()` doesn't read the address bar; it reads the canonical URL out
 * of the router payload the server sent. A build-time prerender of the front
 * page writes that as segments `["", ""]`, so the hook returns `"/"`. An ISR
 * re-render of the same page on Vercel writes it under the route's internal
 * name instead — `["", "index"]` — and the hook returns `"/index"`.
 *
 * That only bites the front page, only on the deployed site, and only after
 * the first revalidation, which is why it can't be reproduced against a local
 * `next start`. The damage isn't cosmetic: a component that renders on every
 * route *except* `"/"` will emit markup into the front page's HTML, fail to
 * hydrate against the client tree that correctly omits it, and leave the node
 * orphaned in the DOM for the life of the tab.
 *
 * Nothing downstream should have to know any of that, so the spelling is
 * normalised here, once, and callers keep comparing against `"/"`.
 */
export function useRoutePath() {
  const pathname = usePathname();
  return pathname === "/index" ? "/" : pathname;
}
