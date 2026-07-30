import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '@utils/posts';

export async function GET(context: APIContext) {
  const posts = await getPosts('zh');
  return rss({
    title: 'Qwara - 博客',
    description: '技术笔记、学习心得与项目记录',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
    })),
  });
}
