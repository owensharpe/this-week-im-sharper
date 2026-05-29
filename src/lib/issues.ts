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
}

export interface Issue extends IssueMeta {
  contentHtml: string;
}

export function getAllIssues(): IssueMeta[] {
  const fileNames = fs.readdirSync(issuesDirectory);
  const issues = fileNames
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
      };
    });

  return issues.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function getIssueBySlug(slug: string): Promise<Issue> {
  const fullPath = path.join(issuesDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  return {
    slug,
    title: data.title,
    date: data.date,
    subtitle: data.subtitle ?? "",
    tags: data.tags ?? [],
    image: data.image ?? null,
    imageAlt: data.imageAlt ?? null,
    contentHtml,
  };
}

export function getAllIssueSlugs(): string[] {
  const fileNames = fs.readdirSync(issuesDirectory);
  return fileNames
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}
