#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const GITHUB_USER = 'Qwara-chan';
const OUTPUT_DIR = 'src/data/projects';
const OUTPUT_FILE = join(OUTPUT_DIR, '_github.json');
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PAGES = 3; // 100 repos per page; a few pages covers a personal profile.

const API = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`;

// Use a token when available (CI provides GITHUB_TOKEN automatically).
// Unauthenticated calls are limited to 60 req/hr on a shared IP — the
// Actions runner is notorious for hitting that, so passing the token
// bumps the quota to ~1000 req/hr per repo and makes the sync reliable.
// A stale/revoked token is retried anonymously on 401 (see fetchRepos).
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

function normalizeLangColor(lang) {
  const map = {
    TypeScript: 'blue',
    JavaScript: 'yellow',
    Python: 'emerald',
    Go: 'cyan',
    Rust: 'orange',
    Astro: 'orange',
    HTML: 'red',
    CSS: 'pink',
    Shell: 'green',
    Vue: 'emerald',
    Svelte: 'orange',
    C: 'zinc',
    'C++': 'zinc',
    Java: 'red',
  };
  return lang ? (map[lang] ?? 'zinc') : 'zinc';
}

async function fetchPage(url, useToken) {
  // Keep fetch's default `redirect: 'follow'`: it strips Authorization on
  // cross-origin redirects, which is what we want — never send the token to any
  // host but api.github.com. Pagination URLs stay same-origin, so auth survives.
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'qwara-portfolio-build',
      ...(useToken && TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

async function fetchRepos() {
  // Follow the Link header so profiles with >100 repos aren't silently truncated.
  const all = [];
  let url = API;
  let useToken = !!TOKEN;
  for (let page = 0; page < MAX_PAGES; page++) {
    let res;
    try {
      res = await fetchPage(url, useToken);
    } catch (err) {
      // A stale/revoked token turns a working anonymous fetch into a 401.
      // Retry anonymously instead of silently keeping stale or empty data.
      if (useToken && err.status === 401) {
        console.warn('[fetch-github-repos] Token rejected (401), retrying anonymously.');
        useToken = false;
        res = await fetchPage(url, false);
      } else {
        throw err;
      }
    }
    all.push(...(await res.json()));
    const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '');
    if (!next) break;
    url = next[1];
  }
  return all;
}

async function main() {
  console.log(`[fetch-github-repos] Fetching ${GITHUB_USER}'s public repos...`);
  const repos = await fetchRepos();

  // Portfolio shows original work. Forks are someone else's project, so we drop them.
  // (Archived repos are also hidden; private repos are guarded out as a safety net
  // even though the user-list endpoint only returns public ones.) Flip INCLUDE_FORKS to show forks.
  const INCLUDE_FORKS = false;
  const visible = repos.filter((r) => !r.private && !r.archived && (INCLUDE_FORKS || !r.fork));

  const projects = visible.map((r) => ({
    id: `github-${r.name}`,
    title: r.name,
    description: r.description || 'No description provided.',
    repo: r.html_url,
    url: r.homepage || r.html_url,
    language: r.language,
    languageColor: normalizeLangColor(r.language),
    stars: r.stargazers_count,
    forks: r.forks_count,
    topics: r.topics ?? [],
    fork: r.fork,
    pushedAt: r.pushed_at,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    featured: r.stargazers_count >= 1, // forks were already dropped above
    source: 'github',
  }));

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  // Atomic write: write to a temp file then rename, so a crash mid-write can
  // never leave a truncated JSON that the failure path would keep as a "snapshot".
  const tmpFile = `${OUTPUT_FILE}.tmp`;
  writeFileSync(tmpFile, JSON.stringify(projects, null, 2) + '\n', 'utf8');
  renameSync(tmpFile, OUTPUT_FILE);
  console.log(`[fetch-github-repos] Wrote ${projects.length} repos to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('[fetch-github-repos] Failed:', err.message);
  rmSync(`${OUTPUT_FILE}.tmp`, { force: true });
  // On rate-limit, network, or auth failure, keep the previous snapshot
  // instead of wiping the portfolio to an empty list.
  if (existsSync(OUTPUT_FILE)) {
    console.warn(`[fetch-github-repos] Keeping existing ${OUTPUT_FILE} to avoid an empty projects page.`);
    process.exit(0);
  }
  // Fresh checkouts (CI is always one — _github.json is gitignored) have no
  // snapshot to keep. Shipping an empty projects page while the deploy stays
  // green is worse than failing loudly, so abort the build under CI instead
  // of writing `[]`. Offline local dev keeps the old convenience fallback.
  if (process.env.CI) {
    console.error('[fetch-github-repos] No snapshot to keep and the GitHub API fetch failed; aborting the build.');
    process.exit(1);
  }
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  writeFileSync(OUTPUT_FILE, '[]\n', 'utf8');
  process.exit(0);
});