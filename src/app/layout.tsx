import type { Metadata } from "next";
import { Bodoni_Moda, Libre_Caslon_Text, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SiteWire } from "@/components/site-wire";
import { Newsprint } from "@/components/newsprint";
import { getLatestDigest } from "@/lib/digests";
import "./globals.css";

/** Enough to fill the strip without making one loop take all afternoon. */
const WIRE_HEADLINES = 12;

// Display face: headlines and section heads only. Bodoni's hairlines are too
// fragile for body text, especially on the dark background.
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  display: "swap",
});

// Reading face: everything else. Not a variable font, so weights and styles are
// listed explicitly. Real italics matter here — issues use emphasis in the
// prose, and a faux-obliqued Caslon looks wrong.
const libreCaslon = Libre_Caslon_Text({
  variable: "--font-libre-caslon",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "This Week I'm Sharper",
  description:
    "Some thoughts, comments, and opinions on finance and world events. Markets, policies, and the things that matter!"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read once here rather than per page: the wire is the same on all of them,
  // and this keeps SiteWire a presentational shell that only picks the route.
  const digest = getLatestDigest();

  return (
    <html
      lang="en"
      className={`${libreCaslon.variable} ${bodoni.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Newsprint />
          <Header />
          <SiteWire
            headlines={
              digest?.clusters
                .slice(0, WIRE_HEADLINES)
                .map((cluster) => cluster.headline) ?? []
            }
            date={
              digest
                ? new Date(`${digest.date}T00:00:00`).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  )
                : ""
            }
          />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
