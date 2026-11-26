import { readFile } from 'node:fs/promises';
import { PIXEL_FONT } from './pixelfont.mjs';

const REQUIRED = [
  'github.username',
  'profile.name',
  'profile.role',
  'profile.status',
  'profile.taglines',
  'profile.motto',
  'profile.intro',
  'profile.now',
  'github.featuredRepos',
  'links',
  'stack',
  'theme.dark',
  'theme.light',
];
const THEME_KEYS = ['bg', 'ink', 'dim', 'accent'];
const HEX = /^#[0-9a-f]{6}$/i;

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

export function validateConfig(config) {
  const errors = [];
  for (const path of REQUIRED) {
    const v = get(config, path);
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) errors.push(`missing ${path}`);
  }
  for (const mode of ['dark', 'light']) {
    if (!config.theme?.[mode]) continue;
    for (const key of THEME_KEYS) {
      const v = config.theme[mode][key];
      if (v == null) errors.push(`missing theme.${mode}.${key}`);
      else if (!HEX.test(v)) errors.push(`theme.${mode}.${key} must be a #rrggbb colour, got ${JSON.stringify(v)}`);
    }
    const ramp = config.theme[mode].ramp;
    if (!Array.isArray(ramp) || ramp.length < 3 || !ramp.every((c) => HEX.test(c))) {
      errors.push(`theme.${mode}.ramp must be a list of at least 3 #rrggbb colours, dark to bright`);
    }
  }
  const motto = config.profile?.motto;
  if (Array.isArray(motto) && motto.length && motto.length !== 2) errors.push('profile.motto must have exactly 2 words');

  const featured = config.github?.featuredRepos;
  if (Array.isArray(featured) && featured.length && (featured.length !== 2 || !featured.every((f) => f?.repo))) {
    errors.push('github.featuredRepos must list exactly 2 entries, each with a "repo" name');
  }
  const links = config.links;
  if (Array.isArray(links) && links.length) {
    if (links.length > 4) errors.push('links can hold at most 4 entries');
    links.forEach((l, i) => {
      if (!l?.label) errors.push(`links[${i}] needs a label`);
      if (!/^(https?:\/\/|mailto:)/.test(l?.url ?? '')) errors.push(`links[${i}].url must start with https://, http:// or mailto:`);
    });
  }
  const stack = config.stack;
  if (Array.isArray(stack) && stack.length) {
    if (stack.length > 8) errors.push('stack can hold at most 8 entries');
    stack.forEach((s, i) => {
      const mono = String(s?.mono ?? '').toUpperCase();
      if (!s?.label) errors.push(`stack[${i}] needs a label`);
      if (mono.length < 1 || mono.length > 2) errors.push(`stack[${i}].mono must be 1 or 2 characters`);
      else if ([...mono].some((c) => !PIXEL_FONT[c])) errors.push(`stack[${i}].mono uses a character the pixel font lacks (A-Z, 0-9, # + - .)`);
    });
  }
  if (errors.length) throw new Error(`profile.config.json is invalid:\n  - ${errors.join('\n  - ')}`);
  return config;
}

export async function loadConfig(url) {
  let raw;
  try {
    raw = await readFile(url, 'utf8');
  } catch (e) {
    throw new Error(`cannot read ${url.pathname ?? url}: ${e.message}`);
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    throw new Error(`profile.config.json is not valid JSON: ${e.message}`);
  }
  return validateConfig(config);
}
