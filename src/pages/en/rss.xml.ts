import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '@utils/posts';

export async function GET(context: APIContext) {
  const posts = await getPosts('en');
  return rss({
    title: 'Qwara - Blog',
    description: 'Technical notes, learnings and project logs',
    site: context.site!,
    trailingSlash: false,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/en/blog/${post.id}`,
      categories: post.data.tags,
    })),
  });
}
