import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "About - This Week I'm Sharper",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h2 className="text-3xl font-bold tracking-tight mb-2">About</h2>
      <p className="text-muted-foreground mb-8">
        What this is, why it exists, and who writes it.
      </p>
      <Separator className="mb-10" />

      <div className="space-y-6 text-foreground/90 leading-relaxed">
        <p>
          "<strong>This Week I&apos;m Sharper</strong>" is a weekly newsletter written by Owen Sharpe
          covering finance, markets, and world events. The clear goal here is to explain
          what happened this week in a way that&apos;s clear, honest, and enjoyable for the reader.
        </p>

        <p>
          Too much financial writing assumes you already know everything or
          assumes you know nothing. This newsletter tries to land somewhere in
          the middle. I'd like it to be rigorous enough to be useful and accessible enough to be
          readable.
        </p>

        <p>
          Each issue covers the major market moves, policy developments, and
          economic data of the week, along with whatever else seems interesting
          or important. Think of it as your weekly briefing from a friend who
          reads too much.
        </p>

        <h3 className="text-xl font-bold tracking-tight pt-4">Who writes this?</h3>

        <p>
          Owen Sharpe. I&apos;m interested in how markets, policy, and human
          behavior intersect — and in explaining those intersections without
          resorting to jargon or hand-waving.
        </p>

        <h3 className="text-xl font-bold tracking-tight pt-4">Get in touch</h3>

        <p>
          Have a question, correction, or strong opinion about monetary policy?
          I&apos;d love to hear from you. Reach out via email or find me on social
          media.
        </p>
        
        <h3 className="text-xl font-bold tracking-tight pt-4">Find me</h3>

        <p>
          Email: sharpe.o@northeastern.edu
        </p>
      </div>
    </div>
  );
}
