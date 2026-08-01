import type { APIRoute, GetStaticPaths } from 'astro';
import { getPosts } from '@utils/posts';
import { generateOgSvg } from '@utils/og';
import sharp from 'sharp';

export const getStaticPaths = (async () => {
  const posts = await getPosts('zh');
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { post } = props;
  const svg = generateOgSvg({
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.pubDate,
    tags: post.data.tags,
    lang: 'zh',
  });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
