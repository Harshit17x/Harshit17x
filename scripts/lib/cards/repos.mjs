// Project showcase cards (a 2-wide grid of real UI screenshots), the "more repositories" table and link cells.
import { readFile } from 'node:fs/promises';
import { textKit, svgDoc, frame, hline, BAR, measurer, truncate } from '../svg.mjs';

const fmt = (n) => n.toLocaleString('en-US');
const root = new URL('../../../', import.meta.url);
const host = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

// Title bar with a numbered badge, the project's UI screenshot edge to edge, then a one-line description and tag.
export async function projectSvg(config, mode, data, index) {
  const theme = config.theme[mode];
  const entry = config.github.featuredRepos[index];
  const repo = data.featured.find((r) => r.name.toLowerCase() === entry.repo.toLowerCase()) ?? { name: entry.repo, url: `https://github.com/${config.github.username}/${entry.repo}` };
  const t = textKit();
  const w = 440;
  const pad = 18;
  const shotH = 248;
  const footY = BAR + shotH;
  const h = footY + 52;
  const shot = `data:image/jpeg;base64,${(await readFile(new URL(entry.shot, root))).toString('base64')}`;
  const title = entry.title || repo.name;
  const num = String(index + 1).padStart(2, '0');
  const titleX = pad + 34;
  const titleW = measurer('monoBold', 14)(title);
  const where = truncate(host(repo.homepage || repo.url), w - titleX - titleW - pad - 24, measurer('mono', 12));
  const tag = entry.tag || '';
  const tagW = tag ? measurer('mono', 12)(tag) + 20 : 0;
  const desc = truncate(entry.description || repo.description || '', w - pad * 2 - tagW, measurer('mono', 13));

  const body = [
    frame(theme, w, h),
    `<rect x="${pad}" y="15" width="24" height="18" fill="${theme.accent}"/>`,
    t('monoBold', num, { x: pad + 12, y: 28.5, size: 11, fill: theme.onAccent, anchor: 'middle' }),
    t('monoBold', title, { x: titleX, y: 30, size: 14, fill: theme.text1 }),
    t('mono', where, { x: w - pad, y: 30, size: 12, fill: theme.text3, anchor: 'end' }),
    hline(theme, 0, w, BAR - 1),
    `<image x="1" y="${BAR}" width="${w - 2}" height="${shotH}" preserveAspectRatio="xMidYMid slice" href="${shot}"/>`,
    hline(theme, 0, w, footY),
    t('mono', desc, { x: pad, y: footY + 31, size: 13, fill: theme.text2 }),
    tag ? t('mono', tag, { x: w - pad, y: footY + 31, size: 12, fill: theme.text3, anchor: 'end' }) : '',
  ].join('\n');
  return svgDoc({ w, h, title: `${title}: ${entry.description || repo.description || 'project'}`, style: await t.style(), body });
}

// A small five-point star path centred on (x, y).
function star(x, y, r, colour) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `<polygon points="${pts.join(' ')}" fill="${colour}"/>`;
}

export async function moreReposSvg(config, mode, data) {
  const theme = config.theme[mode];
  const t = textKit();
  const w = 880;
  const rows = data.more;
  const headY = BAR + 34;
  const rowH = 52;
  const firstRow = BAR + 50;
  const h = firstRow + rows.length * rowH + 4;
  const cols = { name: 20, desc: 240, lang: 640, stars: 790 };

  const body = [
    frame(theme, w, h),
    titleBar(theme, t, w, 'more repositories', `${rows.length} selected`),
    ...[['repository', cols.name], ['description', cols.desc], ['language', cols.lang], ['stars', cols.stars]]
      .map(([label, x]) => t('mono', label.toUpperCase(), { x, y: headY, size: 11, fill: theme.text3, spacing: 1.2 })),
    ...rows.map((r, i) => {
      const y = firstRow + i * rowH + 32;
      return [
        i ? hline(theme, 0, w, firstRow + i * rowH) : '',
        t('monoBold', truncate(r.name, cols.desc - cols.name - 20, measurer('monoBold', 14)), { x: cols.name, y, size: 14, fill: theme.text1 }),
        t('sans', truncate(r.description || 'No description yet.', cols.lang - cols.desc - 24, measurer('sans', 14)), { x: cols.desc, y, size: 14, fill: theme.text2 }),
        t('mono', r.language || '—', { x: cols.lang, y, size: 13, fill: theme.text1 }),
        star(cols.stars + 5, y - 4.5, 5.5, theme.accent),
        t('mono', fmt(r.stars), { x: cols.stars + 18, y, size: 13, fill: theme.text1 }),
      ].join('');
    }),
  ].join('\n');
  return svgDoc({ w, h, title: `More repositories: ${rows.map((r) => r.name).join(', ')}`, style: await t.style(), body });
}

// One link cell; four sit side by side at 25% width.
export async function linkSvg(config, mode, index) {
  const theme = config.theme[mode];
  const { label } = config.links[index];
  const t = textKit();
  const w = 220;
  const h = 76;
  const text = label.toUpperCase();
  const textW = measurer('monoBold', 14, 2)(text);
  const body = [
    frame(theme, w, h),
    t('monoBold', text, { x: 22, y: 43, size: 14, fill: theme.text1, spacing: 2 }),
    arrow(22 + textW + 10, 34, theme.accent),
  ].join('\n');
  return svgDoc({ w, h, title: label, style: await t.style(), body });
}
