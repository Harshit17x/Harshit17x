// Validates the build output: well-formed SVGs, size budgets, no external loads, and README links that resolve.
import { readdir, readFile, access } from 'node:fs/promises';
import { XMLValidator } from 'fast-xml-parser';

const root = new URL('../', import.meta.url);
const BUDGET_KB = { header: 900, default: 300 };
const problems = [];

const files = (await readdir(new URL('generated/', root))).filter((f) => f.endsWith('.svg'));
if (!files.length) problems.push('generated/ has no SVGs; run npm run build first');

for (const f of files) {
  const text = await readFile(new URL(`generated/${f}`, root), 'utf8');
  const valid = XMLValidator.validate(text);
  if (valid !== true) problems.push(`${f}: invalid XML (${valid.err.msg} at line ${valid.err.line})`);
  const kb = Buffer.byteLength(text) / 1024;
  const budget = f.startsWith('header') ? BUDGET_KB.header : BUDGET_KB.default;
  if (kb > budget) problems.push(`${f}: ${kb.toFixed(0)} KB is over the ${budget} KB budget`);
  // GitHub's image sandbox blocks external loads, so anything not inline or a local #id would break.
  for (const m of text.matchAll(/(?:href|src)\s*=\s*"([^"]*)"|url\(\s*['"]?([^'")]*)/g)) {
    const ref = m[1] ?? m[2];
    if (!ref.startsWith('#') && !ref.startsWith('data:')) problems.push(`${f}: external reference ${ref.slice(0, 60)}`);
  }
}

const readme = await readFile(new URL('README.md', root), 'utf8').catch(() => '');
if (!readme) problems.push('README.md is missing');
for (const m of readme.matchAll(/(?:srcset|src)="\.\/([^"?]+)/g)) {
  await access(new URL(m[1], root)).catch(() => problems.push(`README references missing file ${m[1]}`));
}

if (problems.length) {
  console.error(`check failed:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`check passed: ${files.length} SVGs, README references resolve`);
