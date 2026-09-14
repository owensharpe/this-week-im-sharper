import { Separator } from "@/components/ui/separator";
import { GitHubIcon, LinkedInIcon, MailIcon } from "@/components/icons";
import { EMAIL, GITHUB_URL, LINKEDIN_URL } from "@/lib/links";

export const metadata = {
  title: "About - This Week I'm Sharper",
};

const CONTACT_LINKS = [
  { label: EMAIL, href: `mailto:${EMAIL}`, Icon: MailIcon },
  { label: "LinkedIn", href: LINKEDIN_URL, Icon: LinkedInIcon },
  { label: "GitHub", href: GITHUB_URL, Icon: GitHubIcon },
];

/**
 * Section headings become sideheads in their own left column, which is how a
 * feature spread carries this much width: the block spans the full measure
 * while the prose inside it keeps a column it can be read in. Setting these
 * paragraphs across the whole width instead would run them to around 140
 * characters a line, well past where running text stays comfortable.
 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <h3 className="text-xs font-mono uppercase tracking-[0.3em] text-brand lg:pt-1">
        {title}
      </h3>
      <div className="max-w-2xl space-y-6 text-foreground/90 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-up">
      <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3">
        About
      </p>
      <h2 className="font-heading text-3xl font-bold tracking-tight mb-2">
        A Brief Overview
      </h2>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        A short explanation of the newsletter, its goals, and how to reach me.
      </p>
      <Separator className="mb-10" />

      <div className="space-y-12">
      <Section title="What This Is">
        <p>
          <strong>This Week I&apos;m Sharper</strong>
          {" "}is a recurring newsletter written by Owen Sharpe covering finance,
          markets, and world events. The clear goal here is to explain what
          happened this week in a way that&apos;s clear, honest, and enjoyable
          for the reader. The amount of articles will fluctuate depending on my free time 
          (i.e., some weeks there may be multiple articles, and other weeks there might not be any).
        </p>

        <p>
          Too much financial writing assumes you already know everything or
          assumes you know nothing. This newsletter tries to land somewhere in
          the middle. I&apos;d like it to be rigorous enough to be useful and
          accessible enough to be readable.
        </p>

        <p>
          Each issue covers the major market moves, policy developments, and
          economic data of the week, along with whatever else seems interesting
          or important. Think of it as your briefing from a friend who
          reads too much.
        </p>
      </Section>

      <Section title="Who Writes This">
        <p>
          Owen Sharpe. I&apos;m currently a Data Science and Mathematics major at Northeastern University.
          I&apos;m interested in how markets, policy, and human behavior intersect, and explaining those
          intersections without resorting to jargon or hand-waving.
        </p>
      </Section>

      <Section title="Get in touch">
        <p>
          Have a question, correction, or strong opinion about anything I write?
          I&apos;d love to hear from you. Reach out via email or find me on
          social media.
        </p>
      </Section>

      <Section title="Find me">
        <ul className="space-y-3">
          {CONTACT_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  link.href.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                className="group inline-flex items-center gap-3"
              >
                <link.Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand"
                />
                <span className="font-mono text-brand group-hover:underline underline-offset-4">
                  {link.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Section>
      </div>
    </div>
  );
}
