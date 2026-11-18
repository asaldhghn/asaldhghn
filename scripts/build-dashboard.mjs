// Builds assets/dashboard.svg: a terminal-style contributions panel for a GitHub profile README.
//   node tools/build-dashboard.mjs [out=assets/dashboard.svg]      (env: GH_LOGIN, default asaldhghn)
// Needs the GitHub CLI (`gh`) logged in locally, or GH_TOKEN set (as in a GitHub Action).
// Pure Node: no browser. The contribution grid is drawn with ASCII glyphs in greens.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LOGIN = process.env.GH_LOGIN || 'asaldhghn';
const OUT = path.resolve(process.argv[2] || 'assets/dashboard.svg');
const q = 'query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount weekday}}}}}}';
const data = JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', `query=${q}`, '-f', `login=${LOGIN}`], { encoding: 'utf8' }));
const cal = data.data.user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks.map((w) => w.contributionDays);
const days = weeks.flat();

/* ---------- stats ---------- */
const total = cal.totalContributions;
const active = days.filter((d) => d.contributionCount > 0);
const best = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a), days[0]);
let longest = 0, run = 0;
for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0, i = days.length - 1;
if (days[i].contributionCount === 0) i--;                   // today may not have a commit yet
for (; i >= 0 && days[i].contributionCount > 0; i--) current++;
const avg = active.length ? (total / active.length).toFixed(1) : '0';
const months = [];
for (const d of days) {
  const key = d.date.slice(0, 7);
  if (!months.length || months[months.length - 1].key !== key) months.push({ key, n: 0 });
  months[months.length - 1].n += d.contributionCount;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (k) => MON[parseInt(k.slice(5), 10) - 1];

/* ---------- layout ---------- */
const W = 830, H = 452, PAD = 36;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const maxDay = Math.max(1, ...days.map((d) => d.contributionCount));
const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((4 * n) / maxDay)));
const GLYPH = ['.', '+', '*', '%', '@'];
const COL = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];   // GitHub dark-theme contribution greens

// GitHub's own metrics: 10px cells, 3px gaps
const px = 13, py = 13, CELL = 10, BOX_X = PAD, BOX_Y = 78, BOX_W = W - 2 * PAD, BOX_H = 164, gx0 = BOX_X + 52, gy0 = BOX_Y + 36;
const jitter = (a, b) => { let h = Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
let grid = '';
weeks.forEach((wk, wi) => {
  wk.forEach((d) => {
    const l = level(d.contributionCount);
    // the whole grid builds left → right (with a little scatter); brighter days land a touch later
    const t = (0.2 + wi * 0.045 + jitter(wi, d.weekday) * 0.25 + l * 0.04).toFixed(2);
    const cx = (gx0 + wi * px + CELL / 2).toFixed(1), cy = (gy0 + d.weekday * py + CELL / 2).toFixed(1);
    grid += `<g transform="translate(${cx} ${cy})" opacity="0"><set attributeName="opacity" to="1" begin="${t}s" fill="freeze"/>` +
      `<g><animateTransform attributeName="transform" type="scale" values="0.1;1.25;1" keyTimes="0;.6;1" dur="0.45s" begin="${t}s" fill="freeze"/>` +
      `<rect x="${-CELL / 2}" y="${-CELL / 2}" width="${CELL.toFixed(1)}" height="${CELL.toFixed(1)}" rx="2" fill="${COL[l]}"/></g></g>`;
  });
});
let monthLabels = '', lastKey = '';
weeks.forEach((wk, wi) => {
  const key = wk[0].date.slice(0, 7);
  if (key !== lastKey && wi < weeks.length - 2) { monthLabels += `<text class="gh" x="${(gx0 + wi * px).toFixed(1)}" y="${gy0 - 7}">${monthName(key)}</text>`; lastKey = key; }
});
const dayLabels = [['Mon', 1], ['Wed', 3], ['Fri', 5]].map(([n, r]) => `<text class="gh" x="${BOX_X + 14}" y="${gy0 + r * py + 9}">${n}</text>`).join('');
const legY = BOX_Y + BOX_H - 28, legRight = BOX_X + BOX_W - 16, sqStart = legRight - 40 - 5 * 13 + 3;
const legend = `<text class="gh" style="text-anchor:end" x="${sqStart - 6}" y="${legY + 9}">Less</text>` + COL.map((c, k) => `<rect x="${sqStart + k * 13}" y="${legY}" width="10" height="10" rx="2" fill="${c}"/>`).join('') + `<text class="gh" style="text-anchor:end" x="${legRight}" y="${legY + 9}">More</text>`;

// stat tiles (3 × 2)
const tiles = [
  ['current streak', `${current} days`], ['longest streak', `${longest} days`], ['contributions', total.toLocaleString('en-US')],
  ['active days', String(active.length)], ['best day', String(best.contributionCount)], ['avg / active day', avg],
];
const tx0 = PAD, ty0 = 292, tw = 128, th = 58, tg = 10;
const tileSvg = tiles.map(([k, v], n) => {
  const x = tx0 + (n % 3) * (tw + tg), y = ty0 + Math.floor(n / 3) * (th + tg);
  return `<rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="6" fill="#08120e" stroke="#17302a"/><text class="lab" x="${x + 12}" y="${y + 20}">$ ${esc(k)}</text><text class="val" x="${x + 12}" y="${y + 44}">${esc(v)}</text>`;
}).join('');

// monthly bars
const bx0 = 470, by1 = 388, bh = 78, bw = 20, bgap = 7;
const maxM = Math.max(1, ...months.map((m) => m.n));
const bars = months.map((m, n) => {
  const h = Math.max(2, Math.round((m.n / maxM) * bh)), x = bx0 + n * (bw + bgap);
  return `<g opacity="0"><set attributeName="opacity" to="1" begin="${(1.2 + n * 0.06).toFixed(2)}s" fill="freeze"/><rect x="${x}" y="${by1 - h}" width="${bw}" height="${h}" rx="2" fill="#2f8059"/><rect x="${x}" y="${by1 - h}" width="${bw}" height="3" rx="1.5" fill="#7fd29c"/><text class="lab" x="${x + bw / 2}" y="${by1 + 16}" text-anchor="middle">${monthName(m.key)}</text></g>`;
}).join('');
const barTitle = `<text class="lab" x="${bx0}" y="${ty0 + 10}">$ contributions / month</text>`;

const FONT = 'ui-monospace,SFMono-Regular,Menlo,Consolas,&quot;Liberation Mono&quot;,monospace';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(LOGIN)}'s contribution activity: ${total} contributions in the last year, current streak ${current} days, longest streak ${longest} days.">
<style>text{font-family:${FONT};font-size:13px;text-anchor:middle;font-weight:700}.lab{font-size:11px;font-weight:400;fill:#4f7d66;text-anchor:start}.val{font-size:19px;fill:#8fcba5;text-anchor:start}.t{font-size:12px;font-weight:400;fill:#4f7d66;text-anchor:start}.gh{font-family:-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,&quot;Noto Sans&quot;,Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;fill:#e6edf3;text-anchor:start}.gh-h{font-family:-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,&quot;Noto Sans&quot;,Helvetica,Arial,sans-serif;font-size:15px;font-weight:400;fill:#e6edf3;text-anchor:start}.cap{font-size:12px;font-weight:400;fill:#5f8f78;text-anchor:start}</style>
<rect width="${W}" height="${H}" rx="14" fill="#050b08"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="#17302a"/>
<rect x="1" y="1" width="${W - 2}" height="36" rx="13" fill="#08120e"/>
<circle cx="24" cy="19" r="5.5" fill="#6b2f3b"/><circle cx="43" cy="19" r="5.5" fill="#6b5a2f"/><circle cx="62" cy="19" r="5.5" fill="#2f6b4a"/>
<text class="t" x="90" y="23">${esc(LOGIN)}@github ~ % ./contributions.sh</text>
<rect x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" rx="6" fill="#0d1117" stroke="#30363d"/>
${monthLabels}${dayLabels}
${grid}
<text class="gh-h" x="${PAD}" y="${BOX_Y - 12}">${total.toLocaleString('en-US')} contributions in the last year</text>
<text class="gh" x="${BOX_X + 14}" y="${legY + 9}">Learn how we count contributions</text>
${legend}
<text class="t" x="${PAD}" y="${ty0 - 24}">${esc(LOGIN)}@github ~ % ./stats.sh</text>
${tileSvg}${barTitle}${bars}
</svg>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg);
console.log(`wrote ${OUT}  ${(svg.length / 1024).toFixed(0)} KB  total=${total} streak=${current}/${longest} active=${active.length} best=${best.contributionCount}`);
