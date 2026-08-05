# AGENTS.md — Qwara-chan.github.io

Bilingual (zh/en) portfolio & blog for Qwara (「Qwara's Corner 🐾」): **Astro 7** + **Tailwind CSS v4**, GitHub Pages deploy, dark-industrial HUD design language.

## Stack

- **Astro 7** + Content Layer API (collections in `src/content.config.ts`)
- **Tailwind CSS v4** (CSS-first, no `tailwind.config.js`; `@theme` + `@custom-variant dark` in `src/styles/global.css`)
- **No animation library** — IntersectionObserver + rAF (`ScrollFX.astro` engine + CSS transitions); GSAP was removed in 2026-07 for performance
- **KaTeX** — `remark-math` + `rehype-katex` wired via `markdown.processor: unified({...})` in `astro.config.mjs` (Astro 7 style; top-level `remarkPlugins`/`rehypePlugins` keys are deprecated); katex CSS lives in `src/styles/katex.css`, imported **only** by `PostLayout.astro` (keeps ~30KB off non-post pages)
- **Mermaid** — `Mermaid.astro` in `PostLayout`; renders `pre[data-language="mermaid"]` (Astro 7 Shiki marks language there, NOT `code.language-mermaid`) lazily via IntersectionObserver + dynamic `import('mermaid')`; re-renders on theme flip via MutationObserver; `.mermaid-figure`/`.mermaid-fallback` styled in `global.css`
- **TypeScript 6** + `@astrojs/check`; **no test framework and no linter** — `npm run check` is the only verification
- **GitHub Pages** deployment via `.github/workflows/deploy.yml`; View Transitions via `<ClientRouter />` in `BaseLayout`

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | `fetch:github` → `astro dev` (http://localhost:4321) |
| `npm run build` | `prebuild` runs `scripts/fetch-github-repos.mjs` → `astro build` to `dist/` |
| `npm run check` | `astro check` (type-check only) |
| `npm run fetch:github` | Manually refresh `src/data/projects/_github.json` from GitHub API |
| `npm run preview` | `astro preview` |

Node ≥ 22.12.0. CI runs `npm ci && npm run build` on `master` and publishes `dist/`; it also installs `fonts-noto-cjk` because build-time OG image generation needs a CJK font.

## Architecture

### Route stubs → shared page components
Every route in `src/pages/` (and the mirrored `src/pages/en/`) is a 2–5 line file delegating to a component in `src/components/pages/` (e.g. `now.astro` → `NowPage.astro`). When adding a route, create both the zh and `en/` mirror; page components resolve the locale via `getLangFromUrl(Astro.url)`.

### Content Layer API (no `src/content/`)
Collections in `src/content.config.ts`, Zod-validated:
- `blog/zh`, `blog/en` — `glob()` over `src/data/blog/{zh,en}/**/*.{md,mdx}`
- `now/zh`, `now/en` — `src/data/now/zh.mdx` / `en.mdx`
- `projects` — `file()` loader on `src/data/projects/_github.json`

Query helpers in `src/utils/posts.ts` (`getPosts`, `getProjects`, `getAllTags`, `paginate`, `getPostStaticPaths`/`getTagStaticPaths`, `getLanguageAccent`). Tag pages fetch all posts **once** in `getTagStaticPaths` — don't reintroduce the per-tag `getCollection()` N+1 pattern.

### GitHub projects auto-sync (do not hand-edit)
`scripts/fetch-github-repos.mjs` runs before every dev/build against the **unauthenticated** GitHub API (60 req/hr) and writes `src/data/projects/_github.json`. That file is gitignored; on rate-limit/network failure it **keeps the previous snapshot** (fresh clone with no snapshot falls back to `[]`). Forks and archived repos are dropped (`INCLUDE_FORKS = false`).

### i18n
- Routing (`astro.config.mjs`): default `zh` with **no** `/zh/` prefix; `en` prefixed `/en/`; fallback `en → zh`
- `src/i18n/ui.ts` — bilingual string dictionaries; `UIKey = keyof typeof ui.zh` (every key needs both variants)
- `src/i18n/utils.ts` — `getLangFromUrl`, `useTranslations`, `getLocalizedPath`, `getSwitchHref`, `formatDate`, `getWordCount`/`getReadingTime` (zh counts characters, en counts words — different WPM rates)

### OG images
`src/pages/og/[...slug].png.ts` (+ `/en/og/...`) generates post OG images at build time via `src/utils/og.ts`. This is why CI installs `fonts-noto-cjk`; new posts get a PNG automatically.

## Styling: Tailwind v4, CSS-first, golden-ratio tokens

- `src/styles/global.css`: `@import "tailwindcss"` + `@plugin "@tailwindcss/typography"` — **no `tailwind.config.js`**. `@custom-variant dark` makes `dark:` class-based (`.dark` on `<html>`).
- `@theme` φ-tokens generate utilities directly: `--spacing-phi-*` → `p-phi-*`/`gap-phi-*`, `--text-phi-*` → `text-phi-*`, `--radius-phi-*` → `rounded-phi-*`. Note: v4's `aspect-*` utilities come from the `--aspect-*` namespace, so `aspect-phi` is a hand-written class in `global.css` consuming `--ratio-phi` (the `--ratio-*` tokens themselves generate nothing).
- **Dark-industrial HUD design language** (full spec in `CLAUDE.md`): semantic colors are CSS vars in `:root`/`.dark` (`--bg`, `--bg-elev`, `--fg`, `--fg-muted`, `--border`, `--accent`, `--accent-soft`) — reference these (`bg-[var(--bg)]`, `text-muted`, `border-default`), not zinc utilities. Accent is NASA safety orange **`#e85d2a`** (dark `#f0833d`); text on accent surfaces uses `var(--on-accent)`. Square-ish `rounded-[4px]`/`radius-phi-sm` corners, not pills.
- Texture/readout utilities in plain CSS: `.halftone`, `.noise-overlay`, `.hazard-band`, `.schematic-grid`, `.corner-marks`, `.section-index`, `.readout`, plus text effects `.chroma` (red/cyan chromatic aberration) and `.phosphor` (accent glow) and the site-wide CRT screen layer (`[data-crt-layer]`, intensity via `--crt-scan`/`--crt-roll`/`--crt-vig`). Component classes in `@layer components`: `.card`, `.btn`/`.btn-primary`/`.btn-ghost`, `.tag-chip`, `.nav-link` (active/hover state is corner brackets, not underline).
- Fonts are self-hosted and subset-split; CJK woff2s are preloaded only on zh pages.

## Animation & client JS

Two layers (details in `CLAUDE.md`):
- **`ScrollFX.astro`** (mounted once in `BaseLayout`, runs on every page) — the main scroll-choreography engine, data-attribute driven (`[data-section-reveal]`, `[data-scroll-fade]`, `[data-scroll-skew]`, `[data-tilt]`, `[data-parallax]`, `[data-scroll-progress]`), IO + rAF, respects `prefers-reduced-motion`.
- **Legacy per-component reveals** — `StaggerGrid.astro` (IntersectionObserver + CSS transitions; `.is-revealed` states in `global.css` with a `<noscript>` override so content is never stuck hidden without JS). `ScrollReveal.astro` was removed in the 2026-08 review cleanup — don't reintroduce it.
- **Projects dossier** (`/projects`) — `featured` repos render as full-viewport sticky `ProjectDossier.astro` panels (150vh runway + clip-wipe), driven by `initNarrative()` in `ProjectsPage.astro`; non-featured repos degrade to a `ProjectCard` wall.
- **Boot sequence** — `BootOverlay.astro` (home only, mounted in `Hero.astro`): ~3.4s cinematic tape-load (CRT power-on → self-test type → tape load with 25fps timecode → signal lock → film-gate wipe), gated by the `hero-booting` pre-paint class, once per session via `sessionStorage['qwara:booted']`; `?boot` forces it and adds `html.boot-forced`. Failsafes: BaseLayout 7s class removal, Hero `begin()` 5.2s.
- **CRT screen layer** — `CrtLayer.astro` (mounted in `BaseLayout`, pure CSS, zero JS): scanlines + vignette + rolling band + subtle flicker over everything (`z-index: 80`); intensity via `--crt-*` vars, brighter in `.dark`; flicker/roll killed by reduced-motion.

**Client JS re-init pattern (critical):** `BaseLayout` mounts `<ClientRouter />`, so every interactive script (ScrollFX, StaggerGrid, Mermaid, SearchPage, PostLayout's reading-progress/TOC/copy/lightbox, theme) must follow:
```js
initX();
document.addEventListener('astro:after-swap', initX);
```
Each init tears down prior state via an `AbortController` (`prev?.abort()`) and disconnects its IntersectionObserver/MutationObserver before re-collecting DOM — after a swap the old nodes are gone. Theme re-applies on `after-swap` only (mutating `before-swap` touches the outgoing doc and is discarded).

**Shared-element transitions:** named elements carry `transition:name` (`qc-*` taxonomy — see CLAUDE.md) plus a `data-vt` marker. Elements inside stagger/reveal pre-states that carry `data-vt` are force-revealed during `html[data-astro-transition]` (CSS safety net + `StaggerGrid`/`ScrollFX` VT fast path that adds `.is-revealed` immediately), so morph targets always exist in the new snapshot.

Easter-egg layer: `MeowEasterEgg.astro` (`is:inline`, deferred — don't break its idle scheduling; console banner, `window.__qwara`, hidden `/secret-cat/` route, konami/paw-rain).

## Content notes

- Blog posts live in `src/data/blog/{zh,en}/` as `.md` or `.mdx`
- `/now` page content lives in `src/data/now/zh.mdx` / `en.mdx` (frontmatter `title`/`updatedDate`/`lang`)
- Frontmatter schema (Zod): `title`, `description`, `pubDate`, `updatedDate?`, `tags`, `cover?`, `draft`, `lang`. `draft: true` hides the post (filtered in `getPosts`/`getPostStaticPaths`)
- Projects are auto-fetched — **do not edit `_github.json` by hand**
- Blog slug = `post.id`; tag URLs must `encodeURIComponent(tag)`
- Blog pagination: `?page=N`, 9/page, with guards against `NaN`/`0`/overflow in `BlogIndexPage.astro`
- The 404 page is a single bilingual page: Astro does **not** honor `src/pages/<locale>/404.astro` (the i18n fallback redirects `/en/404` → `/404` instead of routing it), so `src/components/pages/NotFoundPage.astro` renders zh by default and swaps to English client-side via `location.pathname` + same-origin `document.referrer`. Keep the swap script when editing it.

## Dev server quirks

- `dist/`, `.astro/` (generated type stubs), and `src/data/projects/_github.json` are gitignored — **never commit**
- `sharp` is a devDependency but is required by Astro for production image optimization — keep it
- `trailingSlash: 'never'` and `prefetch: { prefetchAll: true }` set globally in `astro.config.mjs`
- Search is pure client-side filtering over `data-search-*` attributes — identical in dev and prod, no build-time index

## Key components

| Route | File |
|---|---|
| `/` or `/en/` | `src/pages/index.astro` |
| `/blog` or `/en/blog` | `src/pages/blog/index.astro` (paginated, `?page=N`) |
| `/blog/[...slug]` | `src/pages/blog/[...slug].astro` (uses `getStaticPaths`) |
| `/projects` or `/en/projects` | `src/pages/projects.astro` |
| `/tags/[tag]` and `/tags` | `src/pages/tags/[tag].astro`, `src/pages/tags/index.astro` |
| `/search` or `/en/search` | `src/pages/search.astro` (client-side filtering) |
| `/now` or `/en/now` | `src/pages/now.astro` (renders `NowPage.astro` from `data/now/{zh,en}.mdx`) |
| `/archive` or `/en/archive` | `src/pages/archive.astro` |
| `/friends` or `/en/friends` | `src/pages/friends.astro` |
| `/secret-cat` or `/en/secret-cat` | `src/pages/secret-cat.astro` (hidden cat easter-egg page; linked from `MeowEasterEgg.astro`) |
| `/og/[...slug].png` | `src/pages/og/[...slug].png.ts` (build-time OG images) |
| `/404` | `src/pages/404.astro` |
| `/rss.xml` / `/en/rss.xml` | `src/pages/rss.xml.ts` / `src/pages/en/rss.xml.ts` (locale-scoped RSS) |

## Conventions

- **Read `CLAUDE.md` before visual/animation work** — it holds the authoritative design-language spec (textures, tokens, ScrollFX choreography, dossier system) and the deeper gotchas behind the bullets above.
- Path aliases (in `tsconfig.json`): `@/*`, `@components/*`, `@layouts/*`, `@utils/*`, `@i18n/*`, `@styles/*`
- When adding easter egg / cat content, keep commit messages simple — e.g. "增加了更多的猫猫". No detailed descriptions of what changed.
