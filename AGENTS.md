# AGENTS.md — Qwara-chan.github.io

## Stack

- **Astro 7** + Content Layer API (collections in `src/content.config.ts`)
- **Tailwind CSS v4** (CSS-first, no `tailwind.config.js`; `@theme` in `src/styles/global.css`)
- **No animation library** — CSS transitions/keyframes + IntersectionObserver (`ScrollReveal.astro`, `StaggerGrid.astro`, `Skills.astro`, `Hero.astro`); GSAP was removed in 2026-07 for performance
- **KaTeX** — `remark-math` + `rehype-katex` wired via `markdown.processor: unified({...})` in `astro.config.mjs` (Astro 7 style; `remarkPlugins`/`rehypePlugins` top-level keys are deprecated); katex CSS lives in `src/styles/katex.css`, imported **only** by `PostLayout.astro` (keeps ~30KB out of the global CSS on non-post pages)
- **Mermaid** — `Mermaid.astro` in `PostLayout`; renders `pre[data-language="mermaid"]` (Astro 7 Shiki marks language there, NOT `code.language-mermaid`) lazily via IntersectionObserver + dynamic `import('mermaid')`; re-renders on theme flip via MutationObserver; styles in `global.css` (`.mermaid-figure`, `.mermaid-fallback`)
- **TypeScript 6** + `@astrojs/check` for type checking
- **Client-side search** (zero-dependency filtering in `SearchPage.astro`; no search index library)
- **GitHub Pages** deployment via `.github/workflows/deploy.yml`

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Fetches GitHub repos → `astro dev` |
| `npm run build` | `astro build` |
| `npm run check` | `astro check` (type-check) |
| `npm run fetch:github` | Refreshes `src/data/projects/_github.json` from GitHub API |
| `npm run preview` | `astro preview` |

Build order matters: `prebuild` runs `fetch-github-repos.mjs`, then `build` runs `astro build`.

**No test framework or linter** is configured.

## Path aliases

All in `tsconfig.json`: `@/*`, `@components/*`, `@layouts/*`, `@utils/*`, `@i18n/*`, `@styles/*`.

## i18n routing

- Default locale: `zh` — routes have **no** `/zh/` prefix (e.g. `/blog/...`)
- English routes: prefixed with `/en/` (e.g. `/en/blog/...`)
- Fallback: `en → zh`

Content collections: `'blog/zh'` and `'blog/en'` (separate loader per locale).

## Content notes

- Blog posts live in `src/data/blog/{zh,en}/` as `.md` or `.mdx`
- `/now` page content lives in `src/data/now/{zh,en}.mdx` (collections `'now/zh'`, `'now/en'`; frontmatter `title`/`updatedDate`/`lang`)
- Projects are auto-fetched from GitHub API at build time to `src/data/projects/_github.json`; **do not edit by hand**
- Frontmatter schema: `title`, `description`, `pubDate`, `updatedDate?`, `tags`, `cover?`, `draft`, `lang` (Zod-validated in `src/content.config.ts`)
- No `src/content/` directory — Astro 7 Content Layer with `glob()` and `file()` loaders

## Dev server quirks

- Search is pure client-side filtering over `data-*` attributes — it works identically in dev and production, no build-time index needed
- `trailingSlash: 'never'` and `prefetch: { prefetchAll: true }` are set globally in `astro.config.mjs`
- `.astro/` directory is generated at build time; contains type stubs — **do not commit** (in `.gitignore`)
- `sharp` is a devDependency (required by Astro for image optimization in production)

## Key components

| Route | File |
|---|---|
| `/` or `/en/` | `src/pages/index.astro` |
| `/blog` or `/en/blog` | `src/pages/blog/index.astro` (paginated, `?page=N`) |
| `/blog/[...slug]` | `src/pages/blog/[...slug].astro` (uses `getStaticPaths`) |
| `/projects` or `/en/projects` | `src/pages/projects.astro` |
| `/tags/[tag]` | `src/pages/tags/[tag].astro` |
| `/search` or `/en/search` | `src/pages/search.astro` (client-side filtering, works in dev and prod) |
| `/now` or `/en/now` | `src/pages/now.astro` (renders `src/components/pages/NowPage.astro` from `data/now/{zh,en}.mdx`) |
| `/archive` or `/en/archive` | `src/pages/archive.astro` |
| `/friends` or `/en/friends` | `src/pages/friends.astro` |
| `/secret-cat` or `/en/secret-cat` | `src/pages/secret-cat.astro` (hidden cat easter-egg page; linked from `MeowEasterEgg.astro`) |
| `/404` | `src/pages/404.astro` |
| `/rss.xml` | `src/pages/rss.xml.ts` (zh-only RSS) |
| `/en/rss.xml` | `src/pages/en/rss.xml.ts` (en-only RSS) |

Route stubs in `src/pages/` (and mirrored `src/pages/en/`) are 2–5 line files delegating to shared components in `src/components/pages/`. Page-specific animation components live in `src/components/animations/` (`ScrollReveal.astro`, `StaggerGrid.astro`).

## Design tokens

Golden ratio (φ ≈ 1.618) throughout: spacing (`--space-phi-*`), radii, aspect ratios, typography scale. Theme colors set via CSS custom properties in `:root` / `.dark`. Accent: indigo (`#6366f1`).

## Commit style

When adding easter egg / cat content, keep commit messages simple — e.g. "增加了更多的猫猫". No detailed descriptions of what changed.
