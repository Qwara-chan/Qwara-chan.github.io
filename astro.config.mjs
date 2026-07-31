import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://Qwara-chan.github.io',
  trailingSlash: 'never',
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
