import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { loadConfig } from './lib/config.mjs';
import { loadGithubData } from './lib/github.mjs';
import { renderReadme } from './lib/readme.mjs';
import { headerSvg } from './lib/cards/header.mjs';

const root = new URL('../', import.meta.url);
const config = await loadConfig(new URL('profile.config.json', root));
const data = await loadGithubData(config, new URL('data/cache.json', root));
await mkdir(new URL('generated/', root), { recursive: true });

const { profile } = config;
// README layout: each inner array is one line of cards.
const layout = [
  [{ name: 'header', alt: `${profile.name}: ${profile.intro}`, href: `https://github.com/${config.github.username}`, render: (c, m) => headerSvg(c, m, data) }],
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

// Remove cards from earlier layouts so generated/ only holds what the README uses.
for (const f of await readdir(new URL('generated/', root))) {
  if (f.endsWith('.svg') && !written.includes(`generated/${f}`)) {
    await unlink(new URL(`generated/${f}`, root));
    console.log(`removed stale generated/${f}`);
  }
}

// Local-only preview (gitignored): the README's cards on GitHub's dark and light page colours, at README width.
// The ?v= stamp stops the browser showing cached cards from an earlier build.
const stamp = Date.now();
const column = (mode, bg) => `<section style="background:${bg};padding:24px 16px"><div style="max-width:880px;margin:auto">${rows
  .map((row) => `<div style="display:flex;justify-content:center;margin-bottom:8px">${row
    .map((c) => `<img src="generated/${c.name}-${mode}.svg?v=${stamp}" style="width:${100 / row.length}%;display:block" alt="">`)
    .join('')}</div>`)
  .join('')}</div></section>`;
await writeFile(
  new URL('preview.html', root),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile preview</title><body style="margin:0">${column('dark', '#0d1117')}${column('light', '#ffffff')}</body>`,
);
