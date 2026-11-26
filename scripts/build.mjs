import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from './lib/config.mjs';
import { loadGithubData } from './lib/github.mjs';
import { renderReadme } from './lib/readme.mjs';
import { heroSvg } from './lib/cards/hero.mjs';
import { introSvg, nowSvg, stackSvg, linkSvg } from './lib/cards/static.mjs';
import { signalSvg, projectSvg } from './lib/cards/data.mjs';
import { footerSvg } from './lib/cards/footer.mjs';

const root = new URL('../', import.meta.url);
const config = await loadConfig(new URL('profile.config.json', root));
const data = await loadGithubData(config, new URL('data/cache.json', root));
await mkdir(new URL('generated/', root), { recursive: true });

const { profile } = config;
// README layout: each inner array is one line of cards.
const layout = [
  [{ name: 'hero', alt: `${profile.name}: ${profile.role}. ${profile.taglines[0]}`, render: heroSvg }],
  [{ name: 'intro', alt: profile.intro.join(' '), render: introSvg }],
  [{ name: 'now', alt: Object.entries(profile.now).map(([k, v]) => `${k}: ${v}`).join(', '), render: nowSvg }],
  data.featured.map((repo, i) => ({
    name: `project-${i + 1}`,
    alt: `${repo.name}: ${repo.description || 'project'}`,
    href: repo.url,
    render: (c, m) => projectSvg(c, m, data, i),
  })),
  [{ name: 'signal', alt: `${data.totals.contributions} contributions in the last year`, render: (c, m) => signalSvg(c, m, data) }],
  [{ name: 'stack', alt: `Stack: ${config.stack.map((s) => s.label).join(', ')}`, render: stackSvg }],
  [{ name: 'footer', alt: profile.signoff ?? 'see you around', render: footerSvg }],
  config.links.map((link, i) => ({ name: `link-${i + 1}`, alt: link.label, href: link.url, render: (c, m) => linkSvg(c, m, i) })),
];

const rows = [];
const written = [];
for (const row of layout) {
  const built = [];
  for (const card of row) {
    const out = { name: card.name, alt: card.alt, href: card.href };
    for (const mode of ['dark', 'light']) {
      const file = `generated/${card.name}-${mode}.svg`;
      out[mode] = await card.render(config, mode);
      await writeFile(new URL(file, root), out[mode]);
      written.push(file);
      console.log(`${file.padEnd(32)} ${(Buffer.byteLength(out[mode]) / 1024).toFixed(1)} KB`);
    }
    built.push(out);
  }
  rows.push(built);
}
await writeFile(new URL('README.md', root), renderReadme(rows));
console.log('README.md written');

// Local-only preview (gitignored): the README's cards on GitHub's dark and light page colours, at README width.
const column = (mode, bg) => `<section style="background:${bg};padding:24px 16px"><div style="max-width:880px;margin:auto">${rows
  .map((row) => `<div style="display:flex;justify-content:center;margin-bottom:8px">${row
    .map((c) => `<img src="generated/${c.name}-${mode}.svg" style="width:${100 / row.length}%;display:block" alt="">`)
    .join('')}</div>`)
  .join('')}</div></section>`;
await writeFile(
  new URL('preview.html', root),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile preview</title><body style="margin:0">${column('dark', '#0d1117')}${column('light', '#ffffff')}</body>`,
);
