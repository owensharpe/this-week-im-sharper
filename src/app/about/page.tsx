import { Separator } from "@/components/ui/separator";
import { EMAIL, GITHUB_URL, LINKEDIN_URL } from "@/lib/links";

export const metadata = {
  title: "About - This Week I'm Sharper",
};

/** Solid, so it carries the same visual weight as the LinkedIn mark. */
function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

/** Lucide has no brand icons, so the LinkedIn mark is inlined. */
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const CONTACT_LINKS = [
  { label: EMAIL, href: `mailto:${EMAIL}`, Icon: MailIcon },
  { label: "LinkedIn", href: LINKEDIN_URL, Icon: LinkedInIcon },
  { label: "GitHub", href: GITHUB_URL, Icon: GitHubIcon },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-fade-up">
      <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3">
        About
      </p>
      <h2 className="text-3xl font-bold tracking-tight mb-2">
        A Brief Overview
      </h2>
      <p className="text-muted-foreground mb-8">
        A short explanation of the newsletter, its goals, and how to reach me.
      </p>
      <Separator className="mb-10" />

      <div className="space-y-6 text-foreground/90 leading-relaxed">
        <h3 className="text-xs font-mono uppercase tracking-[0.3em] text-brand pt-6 pb-1">
          What This Is
        </h3>
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

        <h3 className="text-xs font-mono uppercase tracking-[0.3em] text-brand pt-6 pb-1">
          Who Writes This
        </h3>

        <p>
          Owen Sharpe. I&apos;m currently a Data Science and Mathematics major at Northeastern University. 
          I&apos;m interested in how markets, policy, and human behavior intersect, and explaining those 
          intersections without resorting to jargon or hand-waving.
        </p>

        <h3 className="text-xs font-mono uppercase tracking-[0.3em] text-brand pt-6 pb-1">
          Get in touch
        </h3>

        <p>
          Have a question, correction, or strong opinion about anything I write?
          I&apos;d love to hear from you. Reach out via email or find me on
          social media.
        </p>

        <h3 className="text-xs font-mono uppercase tracking-[0.3em] text-brand pt-6 pb-1">
          Find me
        </h3>

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
      </div>
    </div>
  );
}
