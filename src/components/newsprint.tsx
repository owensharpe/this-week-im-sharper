"use client";

import { useEffect, useRef } from "react";

/**
 * The halftone screen behind every page, and the light that moves over it.
 *
 * Three layers share one dot grid: a faint base that is always there, a
 * brighter copy revealed only in a soft circle around the cursor, and (inside
 * the masthead, rendered separately) a denser patch. All of them are fixed to
 * the viewport, so the grids stay registered with each other rather than
 * drifting apart and interfering.
 *
 * Deliberately a printing texture rather than the particle field this effect
 * usually turns into, since the rest of the site is a newspaper.
 *
 * Nothing here runs without a real pointer, so phones get the flat screen and
 * no listeners at all.
 */
export function Newsprint() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    // Pointer events fire far faster than the screen repaints, and each one
    // only writes two custom properties, so they are coalesced into one write
    // per frame rather than thrashing style recalc.
    const flush = () => {
      frame = 0;
      if (!pending) return;
      element.style.setProperty("--mx", `${pending.x}px`);
      element.style.setProperty("--my", `${pending.y}px`);
    };

    // The layer is fixed to the viewport, so client coordinates are already in
    // its space and no measuring is needed as the page scrolls.
    const onMove = (event: PointerEvent) => {
      pending = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pending = null;
      element.style.removeProperty("--mx");
      element.style.removeProperty("--my");
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="newsprint-page">
      <div className="newsprint-page-base" />
      <div className="newsprint-lit" />
    </div>
  );
}
