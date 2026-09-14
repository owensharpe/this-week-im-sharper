import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deliberately not `output: "export"`. Every page here is still statically
  // generated at build time, but a plain export additionally refuses to build
  // a dynamic route that yields no paths, so an empty content/papers would
  // fail the whole site's build. Vercel doesn't need the export, and dropping
  // it also lets notFound() behave the same in dev as in production.
  //
  // `images.unoptimized` went with it. It was only there because a static
  // export can't run the image optimizer, and leaving it on meant every issue
  // thumbnail shipped its full-size original — 1.7MB of 3600x2400 JPEG to fill
  // a 160x112 box on the front page. IssueImage already passes proper `sizes`,
  // so the optimizer has everything it needs to serve a matched variant.
};

export default nextConfig;
