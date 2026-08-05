import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '@i18n/ui';

export type Post = CollectionEntry<'blog/zh'> | CollectionEntry<'blog/en'>;
export type Project = CollectionEntry<'projects'>;

/**
 * GitHub `languageColor` key → the site's monochrome language-accent token.
 * Mirrors the neutral "language dots" palette in global.css so the language
 * accent (used for dossier edges, progress bars, corner marks) stays theme-agnostic
 * and consistent with the rest of the industrial design language.
 */
const languageAccentByKey: Record<string, string> = {
  blue: 'var(--color-lang-ts)',
  yellow: 'var(--color-lang-js)',
  emerald: 'var(--color-lang-css)',
  cyan: 'var(--color-lang-html)',
  orange: 'var(--color-lang-js)',
  red: 'var(--color-lang-other)',
  pink: 'var(--color-lang-css)',
  green: 'var(--color-lang-ts)',
  zinc: 'var(--color-lang-other)',
};

export function getLanguageAccent(colorKey?: string): string {
  return languageAccentByKey[colorKey ?? 'zinc'] ?? 'var(--color-lang-other)';
}

/**
 * Deterministic NOTE #NN badge number from a post title. Shared by BlogCard
 * and PostLayout so the badge keeps the same identity (and view-transition
 * name) across pages.
 */
export function noteHash(title: string): string {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) | 0;
  return String(Math.abs(h) % 100).padStart(2, '0');
}

/**
 * Sanitize a string for use as a CSS `view-transition-name` custom-ident:
 * spaces and other identifier-illegal characters silently drop the
 * declaration. Both sides of a morph must pass the tag through the same
 * helper (CJK letters are valid identifiers and are kept as-is).
 *
 * \u975E\u6CD5\u5B57\u7B26\u90FD\u88AB\u6298\u53E0\u6210 '-'\uFF0C\u4E0D\u540C\u539F\u59CB\u6807\u7B7E\u53EF\u80FD\u6E05\u6D17\u6210\u540C\u4E00 ident\uFF08\u5982 'C++' \u4E0E 'C--'
 * \u90FD \u2192 'C--'\uFF09\uFF0C\u540C\u9875\u4E24\u4E2A\u540C\u540D view-transition-name \u4F1A\u88AB\u6D4F\u89C8\u5668\u53CC\u53CC\u4E22\u5F03\uFF0C\u6807\u7B7E morph
 * \u9759\u9ED8\u5931\u6548\u3002\u51E1\u88AB\u66FF\u6362\u8FC7\u5B57\u7B26\u7684\u6807\u7B7E\uFF0C\u9644\u52A0\u539F\u6807\u7B7E\u7684\u77ED\u54C8\u5E0C\u6D88\u6B67\u2014\u2014\u4E24\u7AEF morph \u90FD\u7ECF\u8FC7\u672C
 * \u51FD\u6570\uFF0C\u751F\u6210\u7684\u540D\u5B57\u4FDD\u6301\u4E00\u81F4\u3002
 */
export function vtTag(tag: string): string {
  const base = tag.replace(/[^\w\u0080-\uFFFF-]/g, '-');
  return base === tag ? base : `${base}-${tagHash(tag)}`;
}

function tagHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export async function getPosts(lang: Lang): Promise<Post[]> {
  const posts = await getCollection(lang === 'en' ? 'blog/en' : 'blog/zh');
  return posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/**
 * Load all projects (auto-synced from GitHub).
 * NOTE: `lang` is currently unused because the projects collection has no
 * language dimension - it is kept in the signature for future per-locale filtering.
 */
export async function getProjects(_lang: Lang): Promise<Project[]> {
  const projects = await getCollection('projects');
  return projects.sort((a, b) => {
    if (a.data.featured !== b.data.featured) return a.data.featured ? -1 : 1;
    const ta = new Date(a.data.pushedAt ?? a.data.updatedAt ?? 0).getTime();
    const tb = new Date(b.data.pushedAt ?? b.data.updatedAt ?? 0).getTime();
    // An unparseable date yields NaN; fall back to 0 so the comparator stays stable.
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
}

export async function getAllTags(posts: Post[]): Promise<{ tag: string; count: number }[]> {
  const tagMap = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }
  return [...tagMap.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function paginate<T>(items: T[], pageSize: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages.length ? pages : [[]];
}

/**
 * Build getStaticPaths() entries for /tags/[tag] from a single collection
 * load. The previous implementation called getPostsByTag() per tag, which
 * triggered one getCollection() per tag (~N+1 fetches at build time).
 */
export async function getTagStaticPaths(lang: Lang) {
  const posts = await getPosts(lang);
  const grouped = new Map<string, Post[]>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const list = grouped.get(tag);
      if (list) list.push(post);
      else grouped.set(tag, [post]);
    }
  }
  return [...grouped.entries()].map(([tag, posts]) => ({
    params: { tag },
    props: { tag, posts },
  }));
}

/**
 * Build getStaticPaths() for /blog/[...slug]. Both the zh and en routes
 * were identical except for the collection name; this keeps the dispatch
 * logic in one place.
 */
export async function getPostStaticPaths(lang: Lang) {
  const posts = await getCollection(lang === 'en' ? 'blog/en' : 'blog/zh');
  const sorted = posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  return sorted.map((post, i) => ({
    params: { slug: post.id },
    props: {
      post,
      prevPost: sorted[i + 1] ?? null,
      nextPost: sorted[i - 1] ?? null,
    },
  }));
}
