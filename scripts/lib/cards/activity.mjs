// Activity: halftone contribution graph and totals on the left, top languages on the right.
import { textKit, svgDoc, frame, vline, titleBar, BAR } from '../svg.mjs';

const W = 880;
const fmt = (n) => n.toLocaleString('en-US');

// One dot per day; radius grows with the count. Grey for ordinary days, accent for the busiest tenth.
function halftone(theme, weeks, x0, y0, step) {
  const counts = weeks.flat().filter((c) => c != null && c > 0).sort((a, b) => a - b);
  const max = Math.max(1, counts.at(-1) ?? 1);
  const hot = counts[Math.floor(counts.length * 0.9)] ?? Infinity;
  const greys = theme.ramp.length - theme.accentSteps;
  let dots = '';
  weeks.forEach((days, wi) => {
    days.forEach((c, d) => {
      if (c == null) return;
      const cx = x0 + wi * step + step / 2;
      const cy = y0 + d * step + step / 2;
      if (!c) {
        dots += `<circle cx="${cx}" cy="${cy}" r="1" fill="${theme.ramp[3]}"/>`;
        return;
      }
      const k = Math.sqrt(c / max);
      const fill = c >= hot ? theme.accent : theme.ramp[Math.min(greys - 1, 3 + Math.round(k * (greys - 4)))];
      dots += `<circle cx="${cx}" cy="${cy}" r="${(1.6 + 2.6 * k).toFixed(2)}" fill="${fill}"/>`;
    });
  });
  return dots;
}

export async function activitySvg(config, mode, data) {
  const theme = config.theme[mode];
  const t = textKit();
  const h = 268;
  const step = 10.5;
  const graphX = 22;
  const graphY = BAR + 24;
  const split = 612;
  const langX = split + 24;
  const barW = W - 24 - langX;
  const maxShare = Math.max(...data.languages.map((l) => l.share), 0.0001);
  const stats = [
    [data.totals.contributions, 'contributions'],
    [data.totals.repos, 'repositories'],
    [data.totals.stars, 'stars'],
  ];

  const body = [
    frame(theme, W, h),
    titleBar(theme, t, W, 'activity', 'last 12 months'),
    vline(theme, split, BAR, h),
    `<g>${halftone(theme, data.weeks.slice(-53), graphX, graphY, step)}</g>`,
    ...stats.map(([n, label], i) => {
      const x = graphX + 2 + i * 170;
      return t('sansBold', fmt(n), { x, y: h - 46, size: 30, fill: theme.text1, spacing: -0.6 }) +
        t('mono', label.toUpperCase(), { x: x + 1, y: h - 24, size: 11, fill: theme.text3, spacing: 1.2 });
    }),
    t('mono', 'LANGUAGES', { x: langX, y: graphY + 6, size: 11, fill: theme.text3, spacing: 1.2 }),
    ...data.languages.map((l, i) => {
      const y = graphY + 36 + i * 32;
      const fillW = Math.max(2, Math.round((l.share / maxShare) * barW));
      return [
        t('mono', l.name, { x: langX, y, size: 13, fill: theme.text1 }),
        t('mono', `${Math.round(l.share * 100)}%`, { x: W - 24, y, size: 13, fill: theme.text3, anchor: 'end' }),
        `<rect x="${langX}" y="${y + 8}" width="${barW}" height="3" fill="${theme.well}"/>`,
        `<rect x="${langX}" y="${y + 8}" width="${fillW}" height="3" fill="${i ? theme.text3 : theme.accent}"/>`,
      ].join('');
    }),
  ].join('\n');
  const title = `${stats.map(([n, l]) => `${fmt(n)} ${l}`).join(', ')} in the last year. Top languages: ${data.languages.map((l) => l.name).join(', ')}.`;
  return svgDoc({ w: W, h, title, style: await t.style(), body });
}
