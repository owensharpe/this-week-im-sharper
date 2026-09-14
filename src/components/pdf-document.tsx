"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Resolved through the bundler rather than hardcoded, so the worker can never
// drift out of version lockstep with the pdfjs-dist that react-pdf imports —
// a mismatch there fails at runtime with an unhelpful message.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/** US Letter, used for page placeholders until the real ratio is known. */
const FALLBACK_ASPECT = 11 / 8.5;

/**
 * Render a page only once it is within 1.5 viewports of the scroll position.
 * A 20-page paper rasterised all at once is tens of megabytes of canvas, which
 * is what makes naive PDF embeds crawl on phones.
 */
const RENDER_MARGIN = "150% 0px";

/**
 * A band across the middle of the viewport. Whichever page overlaps it is the
 * one the reader is looking at, which drives the page counter.
 */
const CURRENT_PAGE_MARGIN = "-45% 0px -45% 0px";

export default function PdfDocument({
  file,
  onPageChange,
  onNumPages,
}: {
  file: string;
  onPageChange?: (page: number) => void;
  onNumPages?: (numPages: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [aspect, setAspect] = useState(FALLBACK_ASPECT);
  const [rendered, setRendered] = useState<Set<number>>(() => new Set([1]));
  const [failed, setFailed] = useState(false);

  // Pages are rasterised at the container's pixel width, so the width has to be
  // measured rather than guessed, and re-measured when the window resizes.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoad = useCallback(
    async (pdf: PDFDocumentProxy) => {
      setNumPages(pdf.numPages);
      onNumPages?.(pdf.numPages);
      // Page 1's ratio sizes every placeholder. Papers are uniform in page size,
      // and being wrong on a stray landscape figure page only means the scroll
      // position shifts slightly as that page renders.
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      setAspect(viewport.height / viewport.width);
    },
    [onNumPages]
  );

  useEffect(() => {
    if (!numPages || !containerRef.current) return;
    const placeholders =
      containerRef.current.querySelectorAll<HTMLElement>("[data-page]");

    const renderObserver = new IntersectionObserver(
      (entries) => {
        const entering = entries.filter((entry) => entry.isIntersecting);
        if (entering.length === 0) return;
        const pages = entering.map((entry) =>
          Number((entry.target as HTMLElement).dataset.page)
        );
        setRendered((prev) => new Set([...prev, ...pages]));
        // Rendered pages stay mounted, so there is nothing left to watch for.
        entering.forEach((entry) => renderObserver.unobserve(entry.target));
      },
      { rootMargin: RENDER_MARGIN }
    );

    const pageObserver = new IntersectionObserver(
      (entries) => {
        const current = entries.find((entry) => entry.isIntersecting);
        if (current) {
          onPageChange?.(Number((current.target as HTMLElement).dataset.page));
        }
      },
      { rootMargin: CURRENT_PAGE_MARGIN }
    );

    placeholders.forEach((element) => {
      renderObserver.observe(element);
      pageObserver.observe(element);
    });
    return () => {
      renderObserver.disconnect();
      pageObserver.disconnect();
    };
  }, [numPages, onPageChange]);

  if (failed) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          The inline viewer couldn&apos;t load this paper.{" "}
          <a
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-4"
          >
            Open the PDF directly
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <Document
        file={file}
        onLoadSuccess={onDocumentLoad}
        onLoadError={() => setFailed(true)}
        externalLinkTarget="_blank"
        loading={<PageSkeleton aspect={aspect} />}
        error={null}
        // Announced by the surrounding figure instead; the canvas stack itself
        // is noise to a screen reader, which should be handed the PDF link.
        aria-hidden
      >
        <div className="space-y-4">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
            <div
              key={page}
              data-page={page}
              className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-border/60"
              style={{ height: width ? width * aspect : undefined }}
            >
              {width > 0 && rendered.has(page) && (
                <Page
                  pageNumber={page}
                  width={width}
                  loading={null}
                  // Keeps text selectable and findable with the browser's own
                  // find-in-page, which a plain image of a page would lose.
                  renderTextLayer
                  renderAnnotationLayer
                />
              )}
            </div>
          ))}
        </div>
      </Document>
    </div>
  );
}

function PageSkeleton({ aspect }: { aspect: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg bg-muted/40 ring-1 ring-border/60"
      style={{ aspectRatio: `1 / ${aspect}` }}
    />
  );
}
