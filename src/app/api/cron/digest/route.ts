/**
 * Starts the daily digest workflow on GitHub. Vercel Cron calls this once a
 * day (see vercel.json) because GitHub's own scheduler starts the job hours
 * late; a workflow_dispatch run starts within seconds.
 *
 * Needs two environment variables in the Vercel project:
 *   CRON_SECRET        Vercel sends it as a bearer token on every cron call,
 *                      so anything else hitting this URL is turned away.
 *   GH_DISPATCH_TOKEN  A fine-grained GitHub token for this repo only, with
 *                      Actions read and write.
 */

const REPO = "owensharpe/this-week-im-sharper";
const WORKFLOW = "daily-digest.yml";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return Response.json({ error: "GH_DISPATCH_TOKEN is not set" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "this-week-im-sharper-cron",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );

  if (!res.ok) {
    // GitHub's error body names the problem (bad token, missing scope) and
    // never echoes the token, so it's safe to pass through to the logs.
    const detail = (await res.text()).slice(0, 300);
    console.error(`digest dispatch failed: HTTP ${res.status} ${detail}`);
    return Response.json({ error: `GitHub returned ${res.status}`, detail }, { status: 502 });
  }

  return Response.json({ dispatched: WORKFLOW });
}
