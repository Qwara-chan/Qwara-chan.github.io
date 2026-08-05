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
 * Generate an OG image SVG (1200x630) for a blog post — QWARA RESEARCH ARCHIVE
 * style: cream archival paper, blueprint grid, orange accents, VHS tri-colour
 * bar, heavy display type. Converted to PNG at build time via sharp in the
 * route endpoint. `pubDate` is optional: when omitted (site-default image) no
 * date is drawn.
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
  // 档案纸 / 墨 / 橙（OG 渲染经 sharp，字体依赖 CI 的 fonts-noto-cjk + DejaVu）
  const PAPER = '#f6f1e5';
  const INK = '#1c1b18';
  const INK_MUTED = '#4a463f';
  const FAINT = '#8a8374';
  const ORANGE = '#e85d2a';
  const RED = '#d0342c';
  const YELLOW = '#e9b41e';
  const CYAN = '#0e8f9c';
  const mono = "monospace";
  const fontStack = "'Noto Sans CJK SC','Noto Sans SC','DejaVu Sans','HarmonyOS Sans SC',sans-serif";

  const titleChars = isZh ? 15 : 30;
  const titleLines = wrapChars(title, titleChars, 2);
  const descLines = wrapChars(description, isZh ? 28 : 52, 2);

  const titleFontSize = isZh ? 54 : 54;
  const titleStartY = 280;
  const titleLineHeight = titleFontSize + 16;
  const titleEls = titleLines
    .map((line, i) => `<text x="80" y="${titleStartY + i * titleLineHeight}" font-family="${fontStack}" font-size="${titleFontSize}" font-weight="900" fill="${INK}">${escapeXml(line)}</text>`)
    .join('\n  ');

  const descStartY = titleStartY + titleLines.length * titleLineHeight + 26;
  const descEls = descLines
    .map((line, i) => `<text x="80" y="${descStartY + i * 36}" font-family="${fontStack}" font-size="26" fill="${INK_MUTED}">${escapeXml(line)}</text>`)
    .join('\n  ');

  const dateEl = pubDate
    ? `<text x="80" y="512" font-family="${mono}" font-size="20" fill="${FAINT}" letter-spacing="1">${escapeXml(formatDate(pubDate, lang))}</text>`
    : '';

  // Blueprint grid (60px)
  const vLines = Array.from({ length: 21 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="630"/>`).join('');
  const hLines = Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="1200" y2="${i * 60}"/>`).join('');

  // Tag chips (orange-outlined)
  let tagX = 80;
  const tagEls = tags.slice(0, 4)
    .map((tag) => {
      const w = Math.min(tag.length * 11 + 30, 220);
      if (tagX + w > 1120) return '';
      const el = `<g><rect x="${tagX}" y="544" width="${w}" height="34" rx="3" fill="${PAPER}" stroke="${ORANGE}" stroke-width="1.5"/><text x="${tagX + 14}" y="566" font-family="${mono}" font-size="15" fill="${ORANGE}">#${escapeXml(tag)}</text></g>`;
      tagX += w + 12;
      return el;
    })
    .join('\n  ');

  // Orange corner marks (registration brackets)
  const corners = `
    <g stroke="${ORANGE}" stroke-width="4" fill="none" opacity="0.9">
      <path d="M28 40 h30 M28 40 v30"/>
      <path d="M1172 40 h-30 M1172 40 v30"/>
      <path d="M28 590 v-30 M28 590 h30"/>
      <path d="M1172 590 v-30 M1172 590 h-30"/>
    </g>`;

  // Header strip: wordmark + file no.
  const header = `
    <rect x="0" y="0" width="1200" height="76" fill="${PAPER}"/>
    <rect x="36" y="30" width="14" height="14" fill="${ORANGE}"/>
    <text x="62" y="42" font-family="${mono}" font-size="20" fill="${INK}" letter-spacing="3" font-weight="700">QWARA RESEARCH ARCHIVE</text>
    <text x="1120" y="42" text-anchor="end" font-family="${mono}" font-size="16" fill="${FAINT}" letter-spacing="2">FILE NO. QR-0001</text>`;

  // VHS tri-colour bar at the bottom
  const vhs = `
    <rect x="0" y="620" width="400" height="10" fill="${RED}"/>
    <rect x="400" y="620" width="400" height="10" fill="${YELLOW}"/>
    <rect x="800" y="620" width="400" height="10" fill="${CYAN}"/>`;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <g opacity="0.06" stroke="${INK}" stroke-width="1">${vLines}${hLines}</g>
  ${corners}
  ${header}
  ${titleEls}
  ${descEls}
  ${dateEl}
  ${tagEls}
  ${vhs}
</svg>`;
}
