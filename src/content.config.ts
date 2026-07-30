import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
  draft: z.boolean().default(false),
  lang: z.enum(['zh', 'en']).default('zh'),
});

const blogZh = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/data/blog/zh' }),
  schema: blogSchema,
});

const blogEn = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/data/blog/en' }),
  schema: blogSchema,
});

const projectsSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  repo: z.string().regex(/^https?:\/\//).optional(),
  url: z.string().regex(/^https?:\/\//).optional(),
  language: z.string().nullable().optional(),
  languageColor: z.string().optional(),
  stars: z.number().default(0),
  forks: z.number().default(0),
  topics: z.array(z.string()).default([]),
  fork: z.boolean().default(false),
  pushedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional(),
  featured: z.boolean().default(false),
  source: z.string().default('github'),
});

const projects = defineCollection({
  loader: file('./src/data/projects/_github.json'),
  schema: projectsSchema,
});

export const collections = { 'blog/zh': blogZh, 'blog/en': blogEn, projects };