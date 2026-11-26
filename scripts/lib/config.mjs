import { readFile } from 'node:fs/promises';

const REQUIRED = [
  'github.username',
  'github.featuredRepos',
  'profile.name',
  'profile.intro',
  'profile.now',
  'profile.mark',
  'profile.status',
  'profile.focus',
  'links',
  'stack',
  'theme.dark',
  'theme.light',
];
const THEME_KEYS = ['page', 'panel', 'well', 'line', 'text1', 'text2', 'text3', 'accent', 'onAccent'];
const HEX = /^#[0-9a-f]{6}$/i;

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

export function validateConfig(config) {
  const errors = [];
  for (const path of REQUIRED) {
    const v = get(config, path);
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) errors.push(`missing ${path}`);
  }

  for (const mode of ['dark', 'light']) {
    const theme = config.theme?.[mode];
    if (!theme) continue;
    for (const key of THEME_KEYS) {
      const v = theme[key];
      if (v == null) errors.push(`missing theme.${mode}.${key}`);
      else if (!HEX.test(v)) errors.push(`theme.${mode}.${key} must be a #rrggbb colour, got ${JSON.stringify(v)}`);
    }
    const { ramp, accentSteps } = theme;
    if (!Array.isArray(ramp) || ramp.length < 6 || !ramp.every((c) => HEX.test(c))) {
      errors.push(`theme.${mode}.ramp must list at least 6 #rrggbb colours, from the panel colour to the brightest accent`);
    } else if (!Number.isInteger(accentSteps) || accentSteps < 1 || accentSteps > ramp.length - 3) {
      errors.push(`theme.${mode}.accentSteps must be a whole number of accent colours at the end of the ramp (1 to ${ramp.length - 3})`);
    }
  }

  const featured = config.github?.featuredRepos;
  if (Array.isArray(featured) && featured.length && (featured.length !== 2 || !featured.every((f) => f?.repo))) {
    errors.push('github.featuredRepos must list exactly 2 entries, each with a "repo" name');
  }
  const more = config.github?.moreRepos;
  if (more != null && (!Array.isArray(more) || more.length > 5 || !more.every((r) => typeof r === 'string'))) {
    errors.push('github.moreRepos must be a list of up to 5 repo names (leave it empty to pick by stars)');
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
  if (stack != null && (typeof stack !== 'object' || Array.isArray(stack))) {
    errors.push('stack must map group names to lists, e.g. { "languages": ["typescript", "python"] }');
  } else if (stack) {
    for (const [group, items] of Object.entries(stack)) {
      if (!Array.isArray(items) || !items.length || !items.every((s) => typeof s === 'string' && s.trim())) {
        errors.push(`stack["${group}"] must be a non-empty list of names`);
      }
    }
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
