import type { APIRoute } from 'astro';
import { generateOgSvg } from '@utils/og';
import sharp from 'sharp';

// Site-default OG image (non-post pages). Rendered as a real PNG because the
// major social scrapers (X/Twitter, Facebook, WhatsApp) do not support SVG
// og:image. The static route shadows the dynamic /og/[...slug].png for this
// exact path, which is fine — no blog post is ever named "default".
export const GET: APIRoute = async () => {
  const svg = generateOgSvg({
    title: "Qwara's Corner",
    description: 'Qwara 的个人主页 — 全栈开发者、开源爱好者。技术博客、项目作品集与个人介绍。',
    tags: [],
    lang: 'zh',
  });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
