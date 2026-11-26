import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapWidth, truncate, textKit } from '../scripts/lib/svg.mjs';
import { measure } from '../scripts/lib/font.mjs';
import { resolveChip, layoutChips } from '../scripts/lib/cards/stack.mjs';
import { renderReadme } from '../scripts/lib/readme.mjs';

const chars = (s) => s.length * 10; // fake measure: 10px per character

test('font metrics: mono is fixed-width, sans is proportional, size scales linearly', () => {
  assert.equal(measure('mono', 'iiii', 14), measure('mono', 'MMMM', 14));
  assert.ok(measure('sans', 'WWWW', 14) > measure('sans', 'iiii', 14));
  assert.ok(Math.abs(measure('sans', 'hello', 28) - 2 * measure('sans', 'hello', 14)) < 1e-9);
  assert.equal(measure('mono', 'ab', 10, 2), measure('mono', 'ab', 10) + 4);
});

test('wrapWidth keeps lines within width and marks cut text', () => {
  assert.deepEqual(wrapWidth('one two three', 70, chars), ['one two', 'three']);
  const cut = wrapWidth('alpha beta gamma delta epsilon', 100, chars, 2);
  assert.equal(cut.length, 2);
  assert.ok(cut[1].endsWith('…'));
  assert.ok(cut.every((l) => chars(l) <= 100));
  assert.equal(truncate('short', 100, chars), 'short');
  assert.equal(truncate('much too long', 60, chars), 'much…');
});

test('textKit escapes text and records glyphs per font', async () => {
  const t = textKit();
  assert.match(t('mono', 'a<b', { x: 1, y: 2, size: 3, fill: '#fff' }), />a&lt;b</);
  const css = await t.style();
  assert.match(css, /@font-face\{font-family:'Card Mono';font-weight:400/);
  assert.doesNotMatch(css, /font-family:'Card Sans';font-weight:600;src/); // unused fonts are not embedded
});

test('stack chips resolve Simple Icons slugs and fall back to plain labels', () => {
  assert.equal(resolveChip('nextdotjs').label, 'Next.js');
  assert.ok(resolveChip('nextdotjs').icon.path.length > 10);
  assert.deepEqual(resolveChip('AWS'), { label: 'AWS', icon: null });
});

test('chips wrap onto a new row when the width runs out', () => {
  const chips = Array.from({ length: 12 }, (_, i) => resolveChip(`Tool ${i}`));
  const { placed, rows } = layoutChips(chips, 300);
  assert.ok(rows > 1);
  assert.ok(placed.every((c) => c.x + c.w <= 300));
  assert.equal(placed[0].x, 0);
});

test('README pairs dark and light sources and links cards', () => {
  const md = renderReadme([[{ name: 'header', alt: 'a "b"', dark: 'x', light: 'y', href: 'https://e.com/?a=1&b=2' }]]);
  assert.match(md, /prefers-color-scheme: dark\)" srcset="\.\/generated\/header-dark\.svg\?v=[0-9a-f]{10}"/);
  assert.match(md, /header-light\.svg/);
  assert.match(md, /alt="a &quot;b&quot;"/);
  assert.match(md, /href="https:\/\/e\.com\/\?a=1&amp;b=2"/);
});
