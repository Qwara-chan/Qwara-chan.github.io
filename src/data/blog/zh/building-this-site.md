---
title: "从零搭建个人主页：Astro 7 + Tailwind CSS v4 + 极简黑白风格"
description: "记录本站点的完整搭建过程，涵盖 Astro 7 Content Layer API、Tailwind CSS v4 CSS-first 配置、GSAP 滚动动效系统、astro:i18n 双语路由等关键技术实践。"
pubDate: 2026-07-31
tags: ["Astro", "Tailwind CSS", "GSAP", "i18n", "前端工程"]
lang: "zh"
---

## 为什么选择 Astro 7

在众多静态站点框架中，Astro 凭借其"群岛架构"（Islands Architecture）脱颖而出——默认零 JavaScript，仅在需要交互的组件中加载脚本。Astro 7 带来了多项重要更新：

- **Rust 编译器**：更快的构建速度，更严格的 HTML 校验
- **Vite 8**：最新的构建工具链
- **Sätteri Markdown 处理器**：原生 Markdown 管线，不再默认依赖 remark/rehype
- **Content Layer API 稳定**：全新的内容集合系统

## Content Layer API：全新的内容管理

Astro 5 引入、Astro 7 稳定的 Content Layer API 彻底重构了内容集合的定义方式。配置文件从 `src/content/config.ts` 迁移到 `src/content.config.ts`，并使用 `loader` 模式：

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/data/blog/zh' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
```

关键变化包括：
- 使用 `id` 替代 `slug` 作为条目标识符
- 渲染通过独立的 `render()` 函数完成，而非 `entry.render()` 方法
- Schema 使用 Zod 4 进行类型校验

## Tailwind CSS v4：CSS-first 配置

Tailwind v4 是一次重大升级。最大的变化是配置方式从 JavaScript 转向 CSS：

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Inter", sans-serif;
  --color-ink-900: #18181b;
}
```

不再需要 `tailwind.config.js`，所有自定义都在 CSS 的 `@theme` 块中完成。在 Astro 项目中，推荐使用 `@tailwindcss/vite` 插件直接接入 Vite，而非旧的 `@astrojs/tailwind` 集成。

### 暗色模式实现

Tailwind v4 中暗色模式的配置也发生了变化。通过 `@custom-variant` 在 CSS 中定义：

```css
@custom-variant dark (&:where(.dark, .dark *));
```

配合 `localStorage` 持久化和 View Transitions API，可以实现流畅的主题切换动画。

## 动效系统设计

本站的动效系统基于两层架构：

### GSAP ScrollTrigger

用于滚动触发的入场动画。通过封装通用的 `ScrollReveal` 组件，任何元素只需添加 `data-scroll-reveal` 属性即可获得滚动入场效果：

```ts
gsap.to(el, {
  opacity: 1,
  y: 0,
  duration: 0.7,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: el,
    start: 'top 85%',
    toggleActions: 'play none none none',
  },
});
```

### View Transitions API

Astro 的 `<ClientRouter />` 组件提供全站页面过渡。配合 CSS 自定义动画，页面切换时会有平滑的淡入淡出效果。

### reduced-motion 适配

所有动效都通过 `prefers-reduced-motion` 媒体查询提供降级方案：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## astro:i18n 双语路由

Astro 的 i18n 路由配置简洁明了：

```ts
export default defineConfig({
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
```

默认语言（中文）不带路径前缀，英文路径以 `/en/` 开头。内容集合按语言分目录管理，UI 文案通过字典对象统一维护。

## 客户端搜索

站点规模不大，文章也不多，所以搜索没有引入额外的索引库，而是用纯客户端过滤实现：

- **零依赖**：构建时把每篇文章的标题、描述、标签写进 `data-*` 属性，搜索页直接用原生 JS 过滤，无需额外请求
- **即时响应**：输入即搜，按标题 / 标签 / 全文关键词加权打分并排序，没有网络延迟
- **dev 与生产一致**：不依赖构建产物，本地开发和线上行为完全相同

对于这种体量的博客，这比引入构建时索引更简单直接。等文章多到需要真正的正文全文检索时，再换成 Pagefind 之类的方案也不迟。

## 部署到 GitHub Pages

通过 GitHub Actions 自动部署：

```yaml
- run: npm ci
- run: npm run build
- uses: actions/deploy-pages@v4
```

由于是用户站点（`username.github.io`），`base` 路径设为 `/`，无需额外前缀。

## 总结

这个项目展示了如何用最新技术栈构建一个功能完整、动效丰富、性能优秀的个人主页。关键收获：

1. Astro 7 的 Content Layer API 是内容管理的正确方式
2. Tailwind v4 的 CSS-first 配置更直观、更强大
3. GSAP + View Transitions 可以实现流畅的动效体验
4. astro:i18n 让双语站点变得简单
5. 搜索方案要匹配站点体量——小规模博客用纯客户端过滤就够了
