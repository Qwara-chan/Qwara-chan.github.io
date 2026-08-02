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
 * Generate an OG image SVG (1200x630) for a blog post — dark industrial
 * HUD style: schematic grid, corner brackets, warning-yellow accent.
 * Converted to PNG at build time via sharp in the route endpoint.
 * `pubDate` is optional: when omitted (site-default image) no date is drawn.
 */
export function generateOgSvg(opts: {
  title: string;
  description: string;
  pubDate?: Date;
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
    .map((line, i) => `<text x="80" y="${titleStartY + i * titleLineHeight}" font-family="${fontStack}" font-size="${titleFontSize}" font-weight="700" fill="#f4f4f2">${escapeXml(line)}</text>`)
    .join('\n  ');

  const descStartY = titleStartY + titleLines.length * titleLineHeight + 24;
  const descEls = descLines
    .map((line, i) => `<text x="80" y="${descStartY + i * 36}" font-family="${fontStack}" font-size="26" fill="#b5b5ae">${escapeXml(line)}</text>`)
    .join('\n  ');

  const dateEl = pubDate
    ? `<text x="80" y="505" font-family="monospace" font-size="20" fill="#6e6e68">${escapeXml(formatDate(pubDate, lang))}</text>`
    : '';

  // Schematic grid pattern (60px)
  const vLines = Array.from({ length: 21 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="630"/>`).join('');
  const hLines = Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="1200" y2="${i * 60}"/>`).join('');

  // Tag pills (warning-yellow tint)
  let tagX = 80;
  const tagEls = tags.slice(0, 4)
    .map((tag) => {
      const w = Math.min(tag.length * 11 + 28, 200);
      if (tagX + w > 1120) return '';
      const el = `<g><rect x="${tagX}" y="538" width="${w}" height="34" rx="4" fill="rgba(241,198,68,0.10)" stroke="#f1c644" stroke-width="1"/><text x="${tagX + 14}" y="560" font-family="monospace" font-size="15" fill="#f1c644">#${escapeXml(tag)}</text></g>`;
      tagX += w + 12;
      return el;
    })
    .join('\n  ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10100e"/>
      <stop offset="100%" stop-color="#1e1e1a"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f1c644" stop-opacity="0.10"/>
      <stop offset="50%" stop-color="#f1c644" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="700" height="630" fill="url(#glow)"/>
  <g opacity="0.05" stroke="#f4f4f2" stroke-width="1">${vLines}${hLines}</g>
  <g stroke="#f1c644" stroke-width="3" fill="none" opacity="0.7">
    <path d="M40 40 h28 M40 40 v28 M1160 40 h-28 M1160 40 v28 M40 590 v-28 M40 590 h28 M1160 590 v-28 M1160 590 h-28"/>
  </g>
  <text x="80" y="120" font-family="monospace" font-size="22" fill="#f1c644" letter-spacing="4" font-weight="700">QWARA-001</text>
  <text x="280" y="120" font-family="monospace" font-size="18" fill="#8f8f88" letter-spacing="2">// SYS.ONLINE</text>
  ${titleEls}
  ${descEls}
  ${dateEl}
  ${tagEls}
</svg>`;
}
