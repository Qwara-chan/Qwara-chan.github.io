#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const GITHUB_USER = 'Qwara-chan';
const OUTPUT_DIR = 'src/data/projects';
const OUTPUT_FILE = join(OUTPUT_DIR, '_github.json');
const REQUEST_TIMEOUT_MS = 10_000;
// Unauthenticated API allows 60 req/hr; a few pages is plenty for a personal profile.
const MAX_PAGES = 3;

const API = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`;

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

async function fetchRepos() {
  // Follow the Link header so profiles with >100 repos aren't silently truncated.
  const all = [];
  let url = API;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'qwara-portfolio-build',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} ${res.statusText}`);
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
  // (Archived repos are also hidden.) Flip INCLUDE_FORKS if you want to show forks too.
  const INCLUDE_FORKS = false;
  const visible = repos.filter((r) => !r.archived && (INCLUDE_FORKS || !r.fork));

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
  // GitHub API is unauthenticated (60 req/hr). On rate-limit or network failure,
  // keep the previous snapshot instead of wiping the portfolio to an empty list.
  if (existsSync(OUTPUT_FILE)) {
    console.warn(`[fetch-github-repos] Keeping existing ${OUTPUT_FILE} to avoid an empty projects page.`);
  } else {
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    writeFileSync(OUTPUT_FILE, '[]\n', 'utf8');
  }
  process.exit(0);
});