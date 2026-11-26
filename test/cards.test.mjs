import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bitmapPath, wrap, pixelBox } from '../scripts/lib/svg.mjs';
import { PIXEL_FONT, monogramRows } from '../scripts/lib/pixelfont.mjs';
import { renderReadme } from '../scripts/lib/readme.mjs';

test('bitmap paths merge horizontal runs and honour the offset', () => {
  assert.equal(bitmapPath(['##.#'], 4), 'M0 0h8v4h-8zM12 0h4v4h-4z');
  assert.equal(bitmapPath(['.#'], 2, 10, 20), 'M12 20h2v2h-2z');
});

test('every pixel glyph is 3x5, and monograms scale up evenly', () => {
  for (const [ch, rows] of Object.entries(PIXEL_FONT)) {
    assert.equal(rows.length, 5, ch);
    assert.ok(rows.every((r) => /^[#.]{3}$/.test(r)), ch);
  }
  const rows = monogramRows('ts', 2);
  assert.equal(rows.length, 10);
  assert.ok(rows.every((r) => r.length === 14));
  assert.throws(() => monogramRows('é'), /no pixel glyph/);
});

test('wrap respects the budget and marks cut text', () => {
  assert.deepEqual(wrap('one two three', 7), ['one two', 'three']);
  const cut = wrap('alpha beta gamma delta epsilon', 10, 2);
  assert.equal(cut.length, 2);
  assert.ok(cut[1].endsWith('…'));
  assert.ok(cut.every((l) => l.length <= 10));
});

test('pixel boxes cut their corners', () => {
  const { border, fill } = pixelBox(5, 4);
  assert.equal(border[0][0], '.');
  assert.equal(border[0][1], '#');
  assert.equal(fill[1][2], '#');
});

test('README pairs dark and light sources and links cards', () => {
  const md = renderReadme([[{ name: 'hero', alt: 'a "b"', dark: 'x', light: 'y', href: 'https://e.com/?a=1&b=2' }]]);
  assert.match(md, /prefers-color-scheme: dark\)" srcset="\.\/generated\/hero-dark\.svg\?v=[0-9a-f]{10}"/);
  assert.match(md, /hero-light\.svg/);
  assert.match(md, /alt="a &quot;b&quot;"/);
  assert.match(md, /href="https:\/\/e\.com\/\?a=1&amp;b=2"/);
});
