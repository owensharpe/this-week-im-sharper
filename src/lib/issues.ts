import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

const issuesDirectory = path.join(process.cwd(), "content/issues");

export interface IssueMeta {
  slug: string;
  title: string;
  date: string;
  subtitle: string;
  tags: string[];
  image: string | null;
  imageAlt: string | null;
  /** Position in the series, oldest issue is 1. */
  number: number;
}

export interface Issue extends IssueMeta {
  contentHtml: string;
}

/** Zero-padded for display, e.g. 3 -> "003". */
export function formatIssueNumber(n: number): string {
  return String(n).padStart(3, "0");
}

/**
 * True once a file has the frontmatter the site needs to render it.
 *
 * A draft that is still empty or half-written is a normal state for this
 * directory, and it must not be able to break the build for every other page.
 * Such a file is skipped with a warning rather than published or thrown on.
 */
function isPublishable(
  issue: { slug: string; title?: unknown; date?: unknown }
): boolean {
  const missing: string[] = [];
  if (typeof issue.title !== "string" || !issue.title.trim()) missing.push("title");
  if (typeof issue.date !== "string" || !issue.date.trim()) missing.push("date");
  if (missing.length > 0) {
    console.warn(
      `[issues] skipping ${issue.slug}.md: missing ${missing.join(", ")}`
    );
    return false;
  }
  return true;
}

/**
 * Every issue, oldest first, with its series number assigned. Numbers come from
 * chronological position rather than the file, so adding a back-dated issue
 * renumbers the ones after it automatically.
 */
function numberedIssues(): IssueMeta[] {
  const fileNames = fs.readdirSync(issuesDirectory);
  return fileNames
    .filter((name) => name.endsWith(".md"))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, "");
      const fullPath = path.join(issuesDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data } = matter(fileContents);

      return {
        slug,
        title: data.title,
        // An unquoted YAML date parses as a Date, which has no localeCompare.
        // Normalise to the ISO day string the rest of the site expects.
        date:
          data.date instanceof Date
            ? data.date.toISOString().slice(0, 10)
            : data.date,
        subtitle: data.subtitle ?? "",
        tags: data.tags ?? [],
        image: data.image ?? null,
        imageAlt: data.imageAlt ?? null,
        number: 0,
      };
    })
    .filter(isPublishable)
    .sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug))
    .map((issue, i) => ({ ...issue, number: i + 1 }));
}

export function getAllIssues(): IssueMeta[] {
  return numberedIssues().reverse();
}

export async function getIssueBySlug(slug: string): Promise<Issue> {
  const fullPath = path.join(issuesDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  const number =
    numberedIssues().find((issue) => issue.slug === slug)?.number ?? 0;

  return {
    slug,
    title: data.title,
    date: data.date,
    subtitle: data.subtitle ?? "",
    tags: data.tags ?? [],
    image: data.image ?? null,
    imageAlt: data.imageAlt ?? null,
    number,
    contentHtml,
  };
}

/** Slugs that have a page. Derived from numberedIssues so unpublishable drafts
 *  are excluded here too, rather than being handed to generateStaticParams. */
export function getAllIssueSlugs(): string[] {
  return numberedIssues().map((issue) => issue.slug);
}
