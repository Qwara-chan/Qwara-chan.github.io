# Qwara's Corner 🐾

A personal portfolio & blog built with Astro 7, featuring minimalist monochrome design with golden ratio proportions and a touch of feline whimsy.

![Astro](https://img.shields.io/badge/Astro-7.1.6-BC52EE?logo=astro&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3.3-06B6D4?logo=tailwindcss&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-3.15.0-88CE02?logo=greensock&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### Core
- **Astro 7 + Content Layer API** — Modern content collections with Zod 4 validation
- **Tailwind CSS v4** — CSS-first configuration, Oxide engine, `@theme` tokens
- **Bilingual (中文 / English)** — `astro:i18n` routing with `/en/` prefix
- **Markdown + MDX** — Blog posts with syntax highlighting & reading time
- **RSS Feed & Sitemap** — Auto-generated `/rss.xml` and `/sitemap-index.xml`

### Design
- **Golden Ratio (φ ≈ 1.618)** — Typography scale, section spacing, grid proportions, aspect ratios
- **Monochrome palette** — Zinc-based grays with restrained indigo accent
- **View Transitions** — Smooth page transitions via `<ClientRouter />`
- **Dark / Light mode** — Persisted in localStorage, re-applied across navigations
- **Mobile-first** — Responsive layout with full-screen mobile menu

### Motion
- **GSAP ScrollTrigger** — Scroll-reveal animations, skill bar fills, parallax
- **Staggered entrances** — Cards fade in with φ-based delays
- **Hero timeline** — Staggered name/title/subtitle entrance
- **reduced-motion** — Respects `prefers-reduced-motion` media query

## 🛠 Tech Stack

| Category | Tech |
|---|---|
| Framework | [Astro 7.1.6](https://astro.build) |
| Styling | [Tailwind CSS 4.3.3](https://tailwindcss.com) + `@tailwindcss/vite` |
| Animation | [GSAP 3.15.0](https://gsap.com) |
| Content | Astro Content Layer API + MDX |
| Search | Client-side filtering (zero-dependency) |
| Deployment | GitHub Pages |

## 📁 Project Structure

```
├── astro.config.mjs          # Astro config + i18n + integrations
├── public/                   # Static assets (favicon, OG image, avatar)
├── scripts/
│   └── fetch-github-repos.mjs  # Build-time GitHub repos fetch
├── src/
│   ├── components/
│   │   ├── animations/       # ScrollReveal, StaggerGrid, Parallax
│   │   ├── Navbar.astro      # Fixed nav with theme/lang toggle
│   │   ├── Footer.astro      # Social links + colophon
│   │   ├── Hero.astro        # Homepage hero with GSAP entrance
│   │   ├── About.astro       # About section with avatar
│   │   ├── Skills.astro      # Skill bars (scroll-triggered)
│   │   ├── Timeline.astro    # Learning journey
│   │   ├── BlogCard.astro   # Blog post card
│   │   ├── ProjectCard.astro # GitHub project card
│   │   └── MeowEasterEgg.astro
│   ├── content.config.ts     # Content Layer collections
│   ├── data/
│   │   ├── blog/zh/          # Chinese MDX blog posts
│   │   ├── blog/en/          # English MDX blog posts
│   │   └── projects/         # GitHub repos (auto-fetched)
│   ├── i18n/
│   │   ├── ui.ts             # Bilingual UI strings
│   │   └── utils.ts          # Translation helpers
│   ├── layouts/
│   │   ├── BaseLayout.astro  # HTML shell + meta + View Transitions
│   │   └── PostLayout.astro  # Blog post with TOC + reading progress
│   ├── pages/                # Routes (index, blog, projects, tags, search, 404)
│   ├── styles/
│   │   └── global.css        # Tailwind v4 import + theme + components
│   └── utils/
│       └── posts.ts          # Content query helpers
└── .github/workflows/
    └── deploy.yml            # GitHub Actions → Pages
```

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 22.12.0

### Development
```bash
npm install
npm run dev
```
Visit `http://localhost:4321/`

### Build
```bash
npm run build
npm run preview
```

### Key Scripts
| Command | Description |
|---|---|
| `npm run dev` | Start dev server (fetches GitHub repos first) |
| `npm run build` | Build the site |
| `npm run preview` | Preview production build |
| `npm run check` | Astro type check |
| `npm run fetch:github` | Manually refresh GitHub repos |

## 🎨 Customization

### Adding Blog Posts
Create `.md` or `.mdx` in `src/data/blog/zh/` or `src/data/blog/en/`:

```yaml
---
title: "My Post"
description: "A short description"
pubDate: 2026-07-31
tags: ["astro", "tutorial"]
lang: "zh"
---
```

### GitHub Projects
Projects auto-sync from your GitHub at build time. No manual editing needed.

### Theme Colors
Edit `@theme` block in `src/styles/global.css`:

```css
@theme {
  --color-accent: #6366f1;        /* Primary accent */
  --color-accent-light: #818cf8;  /* Dark mode accent */
  --color-accent-dark: #4f46e5;   /* Gradient end */
}
```

### Golden Ratio Tokens
```css
--phi: 1.618;
--space-phi-1: 1.618rem;
--space-phi-2: 2.618rem;
--space-phi-3: 4.236rem;
--ratio-phi: 1.618 / 1;
```

## 📄 License

MIT

---

<div align="center">

built with 🐾 and vibe coding

</div>
