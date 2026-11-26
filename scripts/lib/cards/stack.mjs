// Stack: groups of chips, each with a brand logo from Simple Icons (CC0) when one exists, else text only.
import * as simpleIcons from 'simple-icons';
import { textKit, svgDoc, frame, hline, titleBar, BAR, measurer } from '../svg.mjs';

const W = 880;
const ICONS = new Map(Object.values(simpleIcons).filter((i) => i?.slug).map((i) => [i.slug, i]));

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// A config entry is a Simple Icons slug ("nextdotjs") or any plain label ("AWS").
export function resolveChip(entry) {
  const icon = ICONS.get(entry.toLowerCase());
  return icon ? { label: icon.title, icon } : { label: entry, icon: null };
}

// Brand colours that would vanish on the panel (black logos on dark, white on light) fall back to the text colour.
function iconColour(icon, theme, mode) {
  const hex = `#${icon.hex}`;
  const l = luminance(hex);
  return (mode === 'dark' && l < 0.22) || (mode === 'light' && l > 0.8) ? theme.text1 : hex;
}

const CHIP_H = 30;
const GAP = 6;
const ICON = 14;
const labelWidth = measurer('sans', 14);
const chipWidth = (chip) => (chip.icon ? 10 + ICON + 8 : 12) + labelWidth(chip.label) + 12;

// Lay chips out left to right, wrapping when a row runs out of width.
export function layoutChips(chips, maxWidth) {
  const placed = [];
  let x = 0;
  let row = 0;
  for (const chip of chips) {
    const w = Math.ceil(chipWidth(chip));
    if (x && x + w > maxWidth) {
      x = 0;
      row++;
    }
    placed.push({ ...chip, x, row, w });
    x += w + GAP;
  }
  return { placed, rows: row + 1 };
}

export async function stackSvg(config, mode) {
  const theme = config.theme[mode];
  const t = textKit();
  const groups = Object.entries(config.stack).map(([name, entries]) => ({ name, ...layoutChips(entries.map(resolveChip), W - 40) }));
  const total = groups.reduce((n, g) => n + g.placed.length, 0);

  let y = BAR;
  const parts = [titleBar(theme, t, W, 'stack', `${total} tools`)];
  groups.forEach((g, gi) => {
    if (gi) parts.push(hline(theme, 0, W, y));
    parts.push(t('sansBold', g.name, { x: 20, y: y + 32, size: 16, fill: theme.text1 }));
    const chipsTop = y + 46;
    for (const c of g.placed) {
      const cx = 20 + c.x;
      const cy = chipsTop + c.row * (CHIP_H + GAP);
      parts.push(`<rect x="${cx}" y="${cy}" width="${c.w}" height="${CHIP_H}" rx="4" fill="${theme.well}"/>`);
      let textX = cx + 12;
      if (c.icon) {
        const ix = cx + 10;
        const iy = cy + (CHIP_H - ICON) / 2;
        parts.push(`<path transform="translate(${ix} ${iy}) scale(${ICON / 24})" fill="${iconColour(c.icon, theme, mode)}" d="${c.icon.path}"/>`);
        textX = ix + ICON + 8;
      }
      parts.push(t('sans', c.label, { x: textX, y: cy + 20, size: 14, fill: theme.text1 }));
    }
    y = chipsTop + g.rows * (CHIP_H + GAP) - GAP + 18;
  });
  const h = y;
  const body = [frame(theme, W, h), ...parts].join('\n');
  const title = `Stack. ${groups.map((g) => `${g.name}: ${g.placed.map((c) => c.label).join(', ')}`).join('. ')}.`;
  return svgDoc({ w: W, h, title, style: await t.style(), body });
}
