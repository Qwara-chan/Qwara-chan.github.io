import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://Qwara-chan.github.io',
  // 'ignore': 同时接受 /en 与 /en/（及所有无尾斜杠路由的尾斜杠变体）。
  // Astro 7 下 'never' 不再把尾斜杠 301 到无斜杠，而是直接 404（中间件也拦不到，
  // 会被内置的 trailingSlash 404 抢先）；生产 GitHub Pages 本身两种都能服务。
  trailingSlash: 'ignore',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'zh',
        locales: { zh: 'zh-CN', en: 'en' },
      },
      // trailingSlash: 'ignore' 会让 sitemap 生成尾斜杠 URL；这里还原成无斜杠，
      // 与全站 canonical / 链接的「无尾斜杠规范」保持一致。主地址与 hreflang
      // 备用地址都要还原，否则同一内容会以两种 URL 形式出现在同一份 sitemap。
      serialize(item) {
        if (item.url.endsWith('/')) item.url = item.url.slice(0, -1);
        for (const link of item.links ?? []) {
          if (link.url.endsWith('/')) link.url = link.url.slice(0, -1);
        }
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
    fallback: {
      en: 'zh',
    },
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
});
