// GitHub data for the signal and project cards. Falls back to data/cache.json when offline or without a token.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

export const THUMB = { w: 100, h: 40 }; // project thumbnails, in dither cells

const QUERY = `query($login: String!) {
  user(login: $login) {
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100,
                 orderBy: { field: STARGAZERS, direction: DESC }) {
      totalCount
      nodes {
        name description url stargazerCount openGraphImageUrl usesCustomOpenGraphImage
        primaryLanguage { name }
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount weekday } }
      }
    }
  }
}`;

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

async function graphql(tok, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${tok}`, 'Content-Type': 'application/json', 'User-Agent': 'dither-sky-profile' },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  if (!res.ok) throw new Error(`GitHub API answered ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  if (!json.data?.user) throw new Error(`no GitHub user named ${variables.login}`);
  return json.data.user;
}

// Downscaled grayscale bytes of a repo's social preview image, base64. Null if it can't be fetched.
async function thumbnail(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(THUMB.w, THUMB.h, { fit: 'cover' })
      .grayscale()
      .raw()
      .toBuffer();
    return raw.toString('base64');
  } catch {
    return null;
  }
}

export async function summarise(user, featuredConfig) {
  const repos = user.repositories.nodes;
  const sizes = new Map();
  for (const r of repos) for (const e of r.languages.edges) sizes.set(e.node.name, (sizes.get(e.node.name) ?? 0) + e.size);
  const totalSize = [...sizes.values()].reduce((a, b) => a + b, 0) || 1;
  const languages = [...sizes]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, size]) => ({ name, share: size / totalSize }));

  const featured = [];
  for (const f of featuredConfig) {
    const repo = repos.find((r) => r.name.toLowerCase() === f.repo.toLowerCase());
    if (!repo) throw new Error(`featured repo "${f.repo}" is not among your public, non-fork repos: ${repos.map((r) => r.name).join(', ')}`);
    featured.push({
      name: repo.name,
      description: f.description || repo.description || '',
      url: repo.url,
      stars: repo.stargazerCount,
      language: repo.primaryLanguage?.name ?? '',
      // GitHub's auto-generated card is mostly text and turns to mush when dithered; only use custom previews.
      thumb: repo.usesCustomOpenGraphImage ? await thumbnail(repo.openGraphImageUrl) : null,
    });
  }

  const cal = user.contributionsCollection.contributionCalendar;
  return {
    totals: {
      contributions: cal.totalContributions,
      repos: user.repositories.totalCount,
      stars: repos.reduce((a, r) => a + r.stargazerCount, 0),
    },
    // One array of 7 per week, indexed by weekday (0 = Sunday); null where the week is partial.
    weeks: cal.weeks.map((w) => {
      const days = Array(7).fill(null);
      for (const d of w.contributionDays) days[d.weekday] = d.contributionCount;
      return days;
    }),
    languages,
    featured,
  };
}

export async function loadGithubData(config, cacheUrl) {
  const tok = token();
  if (tok) {
    try {
      const user = await graphql(tok, { login: config.github.username });
      const data = await summarise(user, config.github.featuredRepos);
      await mkdir(new URL('./', cacheUrl), { recursive: true });
      await writeFile(cacheUrl, `${JSON.stringify(data, null, 1)}\n`);
      return data;
    } catch (e) {
      if (/featured repo/.test(e.message)) throw e; // a config mistake, not a network one
      console.warn(`GitHub fetch failed (${e.message}); using data/cache.json`);
    }
  }
  try {
    return JSON.parse(await readFile(cacheUrl, 'utf8'));
  } catch {
    throw new Error('No GitHub data: sign in with `gh auth login` or set GITHUB_TOKEN, then build again.');
  }
}
