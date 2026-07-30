import { defaultLang, type Lang, type UIKey, ui } from './ui';

export function getLangFromUrl(url: URL): Lang {
  const [, langSegment] = url.pathname.split('/');
  if (langSegment === 'en') return 'en';
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return ui[lang][key] ?? ui[defaultLang][key] ?? key;
  };
}

export function getLocalizedPath(path: string, lang: Lang): string {
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  if (lang === defaultLang) {
    return cleanPath ? `/${cleanPath}` : '/';
  }
  return cleanPath ? `/${lang}/${cleanPath}` : `/${lang}`;
}

export function getSwitchHref(url: URL, targetLang: Lang): string {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'en') {
    segments.shift();
  }
  const rest = segments.join('/');
  return getLocalizedPath(rest, targetLang) + (url.search || '') + (url.hash || '');
}

export function formatDate(date: Date, lang: Lang): string {
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function getReadingTime(content: string, lang: Lang): number {
  // Strip frontmatter, fenced code blocks, inline code, and common markdown syntax
  // so the word/char count reflects prose rather than source noise.
  let text = content
    .replace(/^---[\s\S]*?---/, '')   // YAML frontmatter
    .replace(/```[\s\S]*?```/g, '')     // fenced code blocks
    .replace(/`[^`]*`/g, '')            // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[#*_>~|-]/g, ' ');         // markdown punctuation

  const wordsPerMinute = lang === 'zh' ? 300 : 200;
  const words = lang === 'zh'
    ? text.replace(/\s+/g, '').length
    : text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
