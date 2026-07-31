import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '@i18n/ui';

export type Post = CollectionEntry<'blog/zh'> | CollectionEntry<'blog/en'>;
export type Project = CollectionEntry<'projects'>;

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
    return tb - ta;
  });
}

export async function getAllTags(lang: Lang): Promise<{ tag: string; count: number }[]> {
  const posts = await getPosts(lang);
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

export async function getPostsByTag(tag: string, lang: Lang): Promise<Post[]> {
  const posts = await getPosts(lang);
  return posts.filter((p) =>
    p.data.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
  );
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
  return posts
    .filter((p) => !p.data.draft)
    .map((post) => ({ params: { slug: post.id }, props: { post } }));
}
