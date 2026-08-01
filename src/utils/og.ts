import { formatDate } from '@i18n/utils';
import type { Lang } from '@i18n/ui';

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]!));
}

/** Hard-wrap by character count (works for both CJK and Latin). */
function wrapChars(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < text.length && lines.length < maxLines; i += maxChars) {
    lines.push(text.slice(i, i + maxChars));
  }
  if (text.length > maxLines * maxChars && lines.length === maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + '…';
  }
  return lines;
}

/**
 * Generate an OG image SVG (1200x630) for a blog post.
 * Converted to PNG at build time via sharp in the route endpoint.
 */
export function generateOgSvg(opts: {
  title: string;
  description: string;
  pubDate: Date;
  tags: string[];
  lang: Lang;
}): string {
  const { title, description, pubDate, tags, lang } = opts;
  const isZh = lang === 'zh';
  const fontStack = "'PingFang SC','Microsoft YaHei','Noto Sans CJK SC','HarmonyOS Sans SC',sans-serif";

  const titleChars = isZh ? 16 : 30;
  const titleLines = wrapChars(title, titleChars, 2);
  const descLines = wrapChars(description, isZh ? 28 : 52, 2);

  const titleFontSize = isZh ? 54 : 56;
  const titleStartY = 270;
  const titleLineHeight = titleFontSize + 18;
  const titleEls = titleLines
    .map((line, i) => `<text x="80" y="${titleStartY + i * titleLineHeight}" font-family="${fontStack}" font-size="${titleFontSize}" font-weight="700" fill="#f4f4f5">${escapeXml(line)}</text>`)
    .join('\n  ');

  const descStartY = titleStartY + titleLines.length * titleLineHeight + 24;
  const descEls = descLines
    .map((line, i) => `<text x="80" y="${descStartY + i * 36}" font-family="${fontStack}" font-size="26" fill="#a1a1aa">${escapeXml(line)}</text>`)
    .join('\n  ');

  const dateStr = formatDate(pubDate, lang);

  // Subtle grid pattern
  const vLines = Array.from({ length: 21 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="630"/>`).join('');
  const hLines = Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="1200" y2="${i * 60}"/>`).join('');

  // Tag pills
  let tagX = 80;
  const tagEls = tags.slice(0, 4)
    .map((tag) => {
      const w = Math.min(tag.length * 11 + 28, 200);
      if (tagX + w > 1120) return '';
      const el = `<g><rect x="${tagX}" y="538" width="${w}" height="34" rx="17" fill="rgba(99,102,241,0.12)" stroke="#6366f1" stroke-width="1"/><text x="${tagX + 14}" y="560" font-family="monospace" font-size="15" fill="#818cf8">#${escapeXml(tag)}</text></g>`;
      tagX += w + 12;
      return el;
    })
    .join('\n  ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#09090b"/>
      <stop offset="100%" stop-color="#18181b"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.12"/>
      <stop offset="50%" stop-color="#6366f1" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="700" height="630" fill="url(#glow)"/>
  <g opacity="0.04" stroke="#f4f4f5" stroke-width="1">${vLines}${hLines}</g>
  <circle cx="1050" cy="100" r="200" fill="#6366f1" opacity="0.06"/>
  <rect x="80" y="80" width="5" height="60" rx="2.5" fill="#6366f1"/>
  <text x="100" y="120" font-family="monospace" font-size="22" fill="#818cf8" letter-spacing="4" font-weight="700">QWARA</text>
  ${titleEls}
  ${descEls}
  <text x="80" y="505" font-family="monospace" font-size="20" fill="#71717a">${escapeXml(dateStr)}</text>
  ${tagEls}
</svg>`;
}
