import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

const papersDirectory = path.join(process.cwd(), "content/papers");
const publicDirectory = path.join(process.cwd(), "public");

export interface PaperMeta {
  slug: string;
  title: string;
  date: string;
  /** One-paragraph summary. Shown on the index and above the viewer. */
  abstract: string;
  tags: string[];
  /**
   * Public path to the compiled PDF, e.g. "/papers/foo.pdf". Null while the
   * work is still in progress, which hides the viewer but keeps the page.
   */
  pdf: string | null;
  /** The project repo the paper came out of. Null hides the repo link. */
  repo: string | null;
  /** Free text such as "Draft" or "Revised Sep 2026". Null hides the badge. */
  status: string | null;
}

export interface Paper extends PaperMeta {
  /** The markdown body, for notes or caveats under the abstract. May be "". */
  notesHtml: string;
}

/**
 * True once a file has the frontmatter the site needs to render it.
 *
 * Same contract as issues: a half-written entry is a normal state for this
 * directory and must not break the build for every other page. The PDF is
 * deliberately not part of this, since a paper is allowed to exist before it
 * is compiled; see resolvePdf.
 */
function isPublishable(paper: {
  slug: string;
  title?: unknown;
  date?: unknown;
}): boolean {
  const missing: string[] = [];
  if (typeof paper.title !== "string" || !paper.title.trim()) missing.push("title");
  if (typeof paper.date !== "string" || !paper.date.trim()) missing.push("date");
  if (missing.length > 0) {
    console.warn(
      `[papers] skipping ${paper.slug}.md: missing ${missing.join(", ")}`
    );
    return false;
  }
  return true;
}

/**
 * The public path to a paper's PDF, or null when there isn't a usable one.
 *
 * An entry can stand on its own while the work is in progress: the landing
 * page still carries the abstract, the notes and the repo link, and only the
 * viewer is withheld. A `pdf` that is set but doesn't name a real file is a
 * typo rather than an intent, so it warns and falls back to the same state
 * instead of shipping a viewer that can only 404.
 */
function resolvePdf(slug: string, pdf: unknown): string | null {
  if (typeof pdf !== "string" || !pdf.trim()) return null;

  // statSync rather than existsSync, plus the extension check: a value still
  // pointing at the folder, like "/papers/", names a directory that exists.
  const stat = fs.statSync(
    path.join(publicDirectory, pdf.replace(/^\//, "")),
    { throwIfNoEntry: false }
  );
  if (!pdf.endsWith(".pdf") || !stat?.isFile()) {
    console.warn(
      `[papers] ${slug}.md: no PDF at public${pdf}, rendering without the viewer`
    );
    return null;
  }
  return pdf;
}

/** Every paper, newest first. Returns [] before the first one is written. */
function readPapers(): PaperMeta[] {
  if (!fs.existsSync(papersDirectory)) return [];

  return fs
    .readdirSync(papersDirectory)
    .filter((name) => name.endsWith(".md"))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, "");
      const { data } = matter(
        fs.readFileSync(path.join(papersDirectory, fileName), "utf8")
      );

      return {
        slug,
        title: data.title,
        // An unquoted YAML date parses as a Date, which has no localeCompare.
        // Normalise to the ISO day string the rest of the site expects.
        date:
          data.date instanceof Date
            ? data.date.toISOString().slice(0, 10)
            : data.date,
        abstract: data.abstract ?? "",
        tags: data.tags ?? [],
        pdf: resolvePdf(slug, data.pdf),
        repo: data.repo ?? null,
        status: data.status ?? null,
      };
    })
    .filter(isPublishable)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export function getAllPapers(): PaperMeta[] {
  return readPapers();
}

/**
 * The paper at `slug`, or null when there is no publishable one.
 *
 * Routed through readPapers rather than reading the file directly so that
 * "this paper exists" means the same thing here as it does on the index. An
 * entry the index hides for want of a PDF used to still render a full page
 * here, whose viewer then had nothing to load.
 */
export async function getPaperBySlug(slug: string): Promise<Paper | null> {
  const meta = readPapers().find((paper) => paper.slug === slug);
  if (!meta) return null;

  const { content } = matter(
    fs.readFileSync(path.join(papersDirectory, `${slug}.md`), "utf8")
  );
  // The body is optional here, unlike an issue. remark on an empty string is
  // cheap enough not to be worth branching around.
  const notesHtml = (await remark().use(html).process(content)).toString();

  return { ...meta, notesHtml };
}

/** Slugs that have a page, excluding unpublishable drafts. */
export function getAllPaperSlugs(): string[] {
  return readPapers().map((paper) => paper.slug);
}
