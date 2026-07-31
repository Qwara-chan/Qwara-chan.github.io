---
title: "Building a Personal Site from Scratch: Astro 7 + Tailwind CSS v4 + Minimalist Monochrome"
description: "A complete log of building this site, covering Astro 7 Content Layer API, Tailwind CSS v4 CSS-first configuration, dependency-free scroll animations, and astro:i18n bilingual routing."
pubDate: 2026-07-31
tags: ["Astro", "Tailwind CSS", "i18n", "Frontend"]
lang: "en"
---

## Why Astro 7

Among static site frameworks, Astro stands out with its Islands Architecture--zero JavaScript by default, loading scripts only where interactivity is needed. Astro 7 brings several important updates:

- **Rust compiler**: Faster builds and stricter HTML validation
- **Vite 8**: The latest build toolchain
- **Sätteri Markdown processor**: Native Markdown pipeline, no longer depending on remark/rehype by default
- **Content Layer API stable**: A brand-new content collections system

## Content Layer API: A New Way to Manage Content

Introduced in Astro 5 and stabilized in Astro 7, the Content Layer API completely redefines how content collections are declared. The config file moved from `src/content/config.ts` to `src/content.config.ts`, using a `loader` pattern:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/data/blog/en' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
```

Key changes include:
- `id` replaces `slug` as the entry identifier
- Rendering is done via a standalone `render()` function, not `entry.render()` method
- Schema validation uses Zod 4

## Tailwind CSS v4: CSS-first Configuration

Tailwind v4 is a major upgrade. The biggest change is moving configuration from JavaScript to CSS:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Inter", sans-serif;
  --color-ink-900: #18181b;
}
```

No more `tailwind.config.js`--all customization happens in the CSS `@theme` block. In Astro projects, the recommended approach is using the `@tailwindcss/vite` plugin directly, rather than the legacy `@astrojs/tailwind` integration.

### Dark Mode Implementation

Dark mode configuration also changed in Tailwind v4. Define it via `@custom-variant` in CSS:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Combined with `localStorage` persistence and the View Transitions API, you get smooth theme switching animations.

## Animation System Design

This site's animation system is built on two layers:

### Scroll-triggered animations (zero dependencies)

For scroll-triggered entrance animations. By wrapping a generic `ScrollReveal` component, any element gains scroll entrance effects by adding the `data-scroll-reveal` attribute. The implementation toggles an `.is-revealed` class via IntersectionObserver and lets CSS transitions do the animation — no animation library needed:

```ts
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      el.classList.add('is-revealed');
      io.unobserve(el);
    }
  });
});
io.observe(el);
```

### View Transitions API

Astro's `<ClientRouter />` component provides site-wide page transitions. With custom CSS animations, page switches have smooth fade in/out effects.

### reduced-motion Support

All animations provide fallbacks via the `prefers-reduced-motion` media query:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## astro:i18n Bilingual Routing

Astro's i18n routing configuration is clean and straightforward:

```ts
export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
```

The default language has no path prefix, while the secondary language uses `/en/` prefix. Content collections are organized by language directory, and UI strings are maintained through a dictionary object.

## Client-side Search

The site is small and has few posts, so instead of pulling in a search index library, search is implemented with pure client-side filtering:

- **Zero dependencies**: At build time each post's title, description and tags are written into `data-*` attributes; the search page filters them with plain JS, no extra requests needed
- **Instant response**: Search-as-you-type, scored and ranked by title / tags / keyword matches, with no network latency
- **Same in dev and prod**: It doesn't depend on build output, so local development behaves exactly like production

For a blog of this size, this is simpler and more direct than a build-time index. Once there are enough posts to warrant real full-text search over body content, swapping in something like Pagefind is easy enough.

## Deploying to GitHub Pages

Automated deployment via GitHub Actions:

```yaml
- run: npm ci
- run: npm run build
- uses: actions/deploy-pages@v4
```

Since this is a user site (`username.github.io`), the `base` path is set to `/` with no additional prefix.

## Summary

This project demonstrates how to build a fully-featured, animation-rich, high-performance personal site with the latest tech stack. Key takeaways:

1. Astro 7's Content Layer API is the right way to manage content
2. Tailwind v4's CSS-first configuration is more intuitive and powerful
3. CSS animations + View Transitions enable smooth animation experiences
4. astro:i18n makes bilingual sites simple
5. Match the search solution to the site's scale — a small blog is fine with pure client-side filtering
