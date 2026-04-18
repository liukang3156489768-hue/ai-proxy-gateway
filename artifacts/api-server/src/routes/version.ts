import { Router, type IRouter } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const router: IRouter = Router();

const GITHUB_OWNER = "liukang3156489768-hue";
const GITHUB_REPO = "ai-proxy-gateway";
const GITHUB_BRANCH = "main";

function getLocalVersion(): string {
  try {
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(moduleDir, "..", "..", "package.json"),
      join(moduleDir, "..", "package.json"),
      join(process.cwd(), "package.json"),
    ];
    for (const p of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(p, "utf-8")) as { version?: string };
        if (pkg.version) return pkg.version;
      } catch {
        /* try next */
      }
    }
  } catch {
    /* fall through */
  }
  return "unknown";
}

router.get("/version", (_req, res) => {
  res.json({
    current: getLocalVersion(),
    repo: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
  });
});

router.get("/version/check", async (_req, res) => {
  const current = getLocalVersion();
  try {
    // Fetch the latest commit on main from the GitHub API
    const commitResp = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`,
      { headers: { "User-Agent": "ai-proxy-gateway", Accept: "application/vnd.github+json" } }
    );

    // Try to read the remote package.json on the same branch for the canonical version
    const pkgResp = await fetch(
      `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/package.json`,
      { headers: { "User-Agent": "ai-proxy-gateway" } }
    );

    if (!commitResp.ok) {
      res.status(502).json({
        ok: false,
        current,
        message: `GitHub API returned ${commitResp.status}`,
      });
      return;
    }

    const commit = await commitResp.json() as {
      sha: string;
      commit: { message: string; author: { date: string } };
      html_url: string;
    };

    let remoteVersion = "unknown";
    if (pkgResp.ok) {
      try {
        const remotePkg = await pkgResp.json() as { version?: string };
        if (remotePkg.version) remoteVersion = remotePkg.version;
      } catch { /* ignore */ }
    }

    const hasUpdate = remoteVersion !== "unknown" && remoteVersion !== current;

    res.json({
      ok: true,
      current,
      latest: remoteVersion,
      hasUpdate,
      latestCommit: {
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        message: commit.commit.message.split("\n")[0],
        date: commit.commit.author.date,
        url: commit.html_url,
      },
      repoUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      current,
      message: err instanceof Error ? err.message : "Failed to check updates",
    });
  }
});

export default router;
