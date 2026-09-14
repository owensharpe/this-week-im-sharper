"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Download, ExternalLink } from "lucide-react";

// react-pdf reaches for DOMMatrix and canvas at import time, neither of which
// exists in the Node pass that prerenders this site, so it can only be pulled
// in on the client. That is also why this wrapper exists at all: `ssr: false`
// is not allowed in a server component.
const PdfDocument = dynamic(() => import("./pdf-document"), {
  ssr: false,
  loading: () => (
    <div className="w-full animate-pulse rounded-lg bg-muted/40 ring-1 ring-border/60 aspect-[8.5/11]" />
  ),
});

export function PaperViewer({ file, title }: { file: string; title: string }) {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);

  // Both are handed to an effect dependency list inside PdfDocument, so they
  // have to keep their identity across renders or the observers get rebuilt.
  const onPageChange = useCallback((next: number) => setPage(next), []);
  const onNumPages = useCallback((next: number) => setNumPages(next), []);

  return (
    <figure className="m-0">
      {/* 4rem clears the site header, which is itself sticky at z-40. */}
      <figcaption className="sticky top-16 z-30 mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/80 px-3 py-2 backdrop-blur">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground tabular-nums">
          {numPages > 0 ? `Page ${page} / ${numPages}` : "Loading paper"}
        </span>
        <span className="flex items-center gap-1">
          <a
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-brand"
          >
            <ExternalLink aria-hidden className="size-3.5" />
            Open
          </a>
          <a
            href={file}
            download
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-brand"
          >
            <Download aria-hidden className="size-3.5" />
            PDF
          </a>
        </span>
      </figcaption>

      <PdfDocument
        file={file}
        onPageChange={onPageChange}
        onNumPages={onNumPages}
      />

      {/* The rendered pages are canvas and hidden from assistive tech, so the
          accessible path to the paper is this link rather than the viewer. */}
      <figcaption className="sr-only">
        <a href={file}>{title} (PDF)</a>
      </figcaption>
    </figure>
  );
}
