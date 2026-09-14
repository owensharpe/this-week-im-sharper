"use client";

import { useEffect, useRef, useState } from "react";

export interface Figure {
  value: number;
  label: string;
}

/** Long enough to read as counting, short enough not to make anyone wait. */
const DURATION_MS = 900;

/** Decelerating, so the number settles on its final value rather than snapping. */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * The colophon: real figures from the pipeline, counting up the first time they
 * come into view.
 *
 * Every number here is measured rather than decorative, which is the point of
 * showing them at all. They render at their true value in the HTML and only
 * animate afterwards, so the page is honest with JavaScript off and to a
 * crawler, and reduced motion simply leaves them there.
 */
export function ColophonFigures({ figures }: { figures: Figure[] }) {
  const ref = useRef<HTMLDListElement>(null);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        // Once only. These shouldn't re-roll every time they scroll back past.
        observer.disconnect();

        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / DURATION_MS, 1);
          setProgress(easeOut(t));
          frame = t < 1 ? requestAnimationFrame(step) : 0;
        };
        setProgress(0);
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <dl
      ref={ref}
      className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 sm:gap-x-4"
    >
      {figures.map((figure) => (
        <div key={figure.label}>
          <dt className="font-heading text-2xl font-bold tabular-nums sm:text-3xl">
            {Math.round(figure.value * progress).toLocaleString("en-US")}
          </dt>
          <dd className="mt-0.5 font-mono text-[10px] uppercase leading-tight tracking-[0.15em] text-muted-foreground">
            {figure.label}
          </dd>
        </div>
      ))}
    </dl>
  );
}
