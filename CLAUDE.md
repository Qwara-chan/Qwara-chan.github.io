# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal portfolio & blog for Qwara (「Qwara's Corner 🐾」) — a bilingual (中文/English) static site built with **Astro 7** + **Tailwind CSS v4**, deployed to GitHub Pages. Minimalist monochrome design with golden-ratio (φ) proportions and a pervasive cat easter-egg layer.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Fetches GitHub repos, then `astro dev` (http://localhost:4321) |
| `npm run build` | `prebuild` fetches GitHub repos → `astro build` to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run check` | `astro check` — type-check only; there is **no test framework and no linter** |

Node ≥ 22.12.0. The deploy workflow (`.github/workflows/deploy.yml`) runs `npm ci && npm run build` on `master` and publishes `dist/`.

## Architecture

### Route stubs delegate to shared page components
Every route in `src/pages/` is a 2–5 line file that imports a component from `src/components/pages/` (e.g. `src/pages/blog/index.astro` → `BlogIndexPage.astro`, `src/pages/now.astro` → `NowPage.astro`). English routes live in a **mirrored `src/pages/en/` directory** — the routing is `/...` (zh, no prefix) and `/en/...` (see i18n below). When adding a route, create both the zh and the `en/` mirror; the page component itself handles `lang` via `getLangFromUrl(Astro.url)`.

### Content Layer API (no `src/content/`)
Collections are defined in `src/content.config.ts` with Zod schemas using `glob()` and `file()` loaders:
- `blog/zh` and `blog/en` — markdown/mdx posts in `src/data/blog/{zh,en}/`
- `now/zh` and `now/en` — `src/data/now/zh.mdx` / `en.mdx`
- `projects` — loaded from `src/data/projects/_github.json`

Shared query helpers live in `src/utils/posts.ts` (`getPosts`, `getProjects`, `getAllTags`, `paginate`, and the `getStaticPaths` builders `getPostStaticPaths` / `getTagStaticPaths`). Tag pages load posts in a **single collection fetch** (avoid the N+1 `getCollection()`-per-tag pattern — the grouped map is already built in `getTagStaticPaths`).

### GitHub projects auto-sync (do not hand-edit)
`scripts/fetch-github-repos.mjs` runs before every dev/build, hits the **unauthenticated** GitHub API (60 req/hr), and writes `src/data/projects/_github.json`. That file is gitignored and regenerated at build time. On failure (rate limit/network) it **keeps the previous snapshot** rather than wiping the projects page — but on a fresh clone with no snapshot it falls back to `[]`. Forks are dropped (`INCLUDE_FORKS = false`).

### i18n
- `src/i18n/ui.ts` — the bilingual string dictionaries, `zh` and `en`, with `UIKey = keyof typeof ui.zh` (all UI copy must have both variants).
- `src/i18n/utils.ts` — `getLangFromUrl`, `useTranslations`, `getLocalizedPath`, `getSwitchHref` (used by the lang switcher), `formatDate`, `getWordCount` / `getReadingTime` (zh counts characters, en counts words — different WPM rates).
- Routing (in `astro.config.mjs`): default locale `zh` with **no prefix**; `en` prefixed `/en/`; fallback `en → zh`.

### Client-side scripts: re-init on View Transitions
`BaseLayout.astro` mounts `<ClientRouter />`; every interactive script on the site (ScrollReveal, StaggerGrid, Mermaid, SearchPage, PostLayout's reading-progress/TOC/copy/lightbox, the theme script) does the same thing:
```js
initX();
document.addEventListener('astro:after-swap', initX);
```
Each init tears down prior state with an `AbortController` (`prev?.abort()`) and disconnects `IntersectionObserver`s / `MutationObserver`s before re-collecting DOM — because after a swap the old DOM nodes are gone and listeners would otherwise leak. **Follow this exact pattern** when adding client JS. Theme is re-applied on `after-swap` only (mutating `before-swap` touches the outgoing document and is discarded).

### Styling: Tailwind v4, CSS-first, golden-ratio tokens
- `src/styles/global.css` imports Tailwind v4 (`@import "tailwindcss"` + `@plugin "@tailwindcss/typography"`) — **no `tailwind.config.js`**.
- The `@theme` block defines φ-based tokens which generate utilities directly: `--spacing-phi-*` → `p-phi-*`/`gap-phi-*`/`mb-phi-*`, `--text-phi-*` → `text-phi-*`, `--radius-phi-*` → `rounded-phi-*`, plus `--ratio-phi` → `aspect-phi`.
- Semantic colors are CSS custom properties in `:root` / `.dark` (`--bg`, `--bg-elev`, `--fg`, `--fg-muted`, `--border`, `--accent`, `--accent-soft`). **Reference these vars** (`bg-[var(--bg)]`, `text-muted`, `border-default`, `text-[var(--accent)]`) rather than zinc utilities directly, so both themes stay consistent. Accent: indigo `#6366f1` / `#818cf8` dark.
- Reusable component classes live in `@layer components`: `.card`, `.card-hover`, `.btn` / `.btn-primary` / `.btn-ghost`, `.tag-chip`, `.section-eyebrow`, `.container-px`, `.container-mx`, `.golden-section`, `.aspect-phi`.
- Dark mode is class-based: `.dark` on `<html>`; Tailwind `@custom-variant dark` makes `dark:` work with the class. An inline boot script reads localStorage before paint; a `dark` re-apply script handles `after-swap`.

### KaTeX & Mermaid
- **KaTeX**: `remark-math` + `rehype-katex` wired through `markdown.processor: unified({...})` in `astro.config.mjs` (Astro 7 style — top-level `remarkPlugins`/`rehypePlugins` config keys are deprecated). `$...$` / `$$...$$` work in `.md` and `.mdx`. The KaTeX CSS is imported **only** in `PostLayout.astro` (`src/styles/katex.css`) to keep it off non-post pages.
- **Mermaid**: `Mermaid.astro` (included by `PostLayout`) renders fenced ` ```mermaid ` blocks lazily — Astro 7's Shiki marks the language on `pre[data-language="mermaid"]`, **not** `code.language-mermaid`. It lazy-loads `mermaid` via dynamic `import()`, renders under `securityLevel: 'strict'`, falls back to a `.mermaid-fallback` `<pre>` on error, and re-renders on theme flip via a `MutationObserver`. Wrappers get `.mermaid-figure` class (styled in `global.css`).

### Animation system
No animation library (GSAP was removed in 2026-07 for performance). Scroll-reveal is IntersectionObserver + CSS transitions:
- `ScrollReveal.astro` → `[data-animate]` + per-element `--reveal-*` CSS vars.
- `StaggerGrid.astro` → `[data-stagger-grid]` with `--stagger-delay` per item.
- Hidden pre-states and the `.is-revealed` transitions live in `global.css`, with `prefers-reduced-motion` and a `<noscript>` override (content must never be stuck hidden without JS).

## Conventions & gotchas

- **Content frontmatter** (blog, Zod-validated): `title`, `description`, `pubDate`, `tags`, `cover?`, `draft`, `lang`; `/now` uses `title`, `updatedDate`, `lang`. Mark a post `draft: true` to hide it — drafts are filtered in `getPosts`/`getPostStaticPaths`.
- **`dist/`, `.astro/`, and `src/data/projects/_github.json` are gitignored** — never commit them. `.astro/` holds generated type stubs.
- `sharp` is a devDependency but is required by Astro for production image optimization — keep it.
- Search (`SearchPage.astro`) is pure client-side filtering over `data-search-*` attributes with rAF-coalesced scoring — it works identically in dev and prod; no index build step.
- Blog pagination is `?page=N` (9/page) with guards against `NaN`/`0`/overflow in `BlogIndexPage.astro`.
- Blog posts use `post.id` as the slug; tag URLs must `encodeURIComponent(tag)`.
- Path aliases (in `tsconfig.json`): `@/*`, `@components/*`, `@layouts/*`, `@utils/*`, `@i18n/*`, `@styles/*`.
- Fonts are self-hosted and subset-split (HarmonyOS Sans SC Latin/CJK, JetBrains Mono) with `unicode-range`; CJK woff2s are preloaded only for zh pages.
- The cat easter-egg layer is `MeowEasterEgg.astro` (idle-time boot, console banner, `window.__qwara`, `data-meow-rev`, hidden `/secret-cat/` route, konami/paw-rain). It is `is:inline` and deferred — don't break its idle scheduling. When adding cat/easter-egg content, keep commit messages simple (e.g. "增加了更多的猫猫") with no detailed description.
