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
        date: data.date,
        subtitle: data.subtitle ?? "",
        tags: data.tags ?? [],
        image: data.image ?? null,
        imageAlt: data.imageAlt ?? null,
        number: 0,
      };
    })
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

export function getAllIssueSlugs(): string[] {
  const fileNames = fs.readdirSync(issuesDirectory);
  return fileNames
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}
