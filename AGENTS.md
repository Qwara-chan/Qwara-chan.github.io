# AGENTS.md — Qwara-chan.github.io

## Stack

- **Astro 7** + Content Layer API (collections in `src/content.config.ts`)
- **Tailwind CSS v4** (CSS-first, no `tailwind.config.js`; `@theme` in `src/styles/global.css`)
- **GSAP 3** + **motion** for animations
- **TypeScript 6** + `@astrojs/check` for type checking
- **Pagefind 1.5** for search indexing
- **GitHub Pages** deployment via `.github/workflows/deploy.yml`

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Fetches GitHub repos → `pagefind --site dist \|\| true` → `astro dev` |
| `npm run build` | `astro build` then `pagefind --site dist` |
| `npm run check` | `astro check` (type-check) |
| `npm run fetch:github` | Refreshes `src/data/projects/_github.json` from GitHub API |
| `npm run preview` | `astro preview` |

Build order matters: `prebuild` runs `fetch-github-repos.mjs`, then `build` does `astro build && pagefind --site dist`.

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
- Projects are auto-fetched from GitHub API at build time to `src/data/projects/_github.json`; **do not edit by hand**
- Frontmatter schema: `title`, `description`, `pubDate`, `tags`, `cover`, `draft`, `lang` (Zod-validated)
- No `src/content/` directory — Astro 7 Content Layer with `glob()` and `file()` loaders

## Dev server quirks

- `npm run dev` will error silently on `pagefind --site dist` if `dist/` doesn't exist (the `|| true` catches it)
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
| `/search` or `/en/search` | `src/pages/search.astro` (client-side JS, no Pagefind in dev) |
| `/rss.xml` | `src/pages/rss.xml.ts` (zh-only RSS) |

## Design tokens

Golden ratio (φ ≈ 1.618) throughout: spacing (`--space-phi-*`), radii, aspect ratios, typography scale. Theme colors set via CSS custom properties in `:root` / `.dark`. Accent: indigo (`#6366f1`).

## Commit style

When adding easter egg / cat content, keep commit messages simple — e.g. "增加了更多的猫猫". No detailed descriptions of what changed.
