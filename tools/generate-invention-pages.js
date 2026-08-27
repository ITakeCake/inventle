#!/usr/bin/env node
/**
 * generate-invention-pages.js
 * ---------------------------
 * Static page generator for Inventle.
 * Reads inventions.json (773 entries) and emits:
 *   - inventions/<slug>.html          one static landing page per invention
 *   - inventions/index.html           A-Z directory hub grouped by category
 *   - inventions-sitemap.xml          sitemap at repo root (absolute URLs)
 * Then mirrors inventions/ and inventions-sitemap.xml into deploy/.
 *
 * Idempotent: re-running regenerates everything deterministically and prunes
 * stale .html files (in both root and deploy copies) whose slug no longer
 * exists in the data.
 *
 * URLs: Cloudflare Pages 308-redirects "*.html" to the extensionless path, so
 * canonicals, sitemap entries and internal links all use extensionless URLs
 * while the files on disk keep their .html extension.
 *
 * Usage:  node tools/generate-invention-pages.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'inventions');
const DEPLOY_DIR = path.join(ROOT, 'deploy');
const SITE = 'https://inventle.io';
const BASE = SITE + '/inventions';

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'inventions.json'), 'utf8'));

/* ---------------------------------------------------------------- helpers */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['\u2019"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fmtYear(y) {
  return y < 0 ? `${-y} BC` : String(y);
}

/** "in 1876" for CE, "around 3200 BC" for BC (ancient dates are approximate) */
function yearPhrase(y) {
  return y < 0 ? `around ${-y} BC` : `in ${y}`;
}

/* Countries whose names take "the" in prose ("in the USA"). */
const THE_COUNTRIES = new Set(['USA', 'United States', 'UK', 'Netherlands', 'Philippines', 'UAE', 'Czech Republic']);

function countryProse(modern) {
  if (!modern || modern === 'Unknown') return null;
  return (THE_COUNTRIES.has(modern) ? 'the ' : '') + modern;
}

/* Collective/civilization inventors take "the" and "A, B" reads "the A and B". */
const COLLECTIVE_PREFIX = /^(Ancient|Medieval|Neolithic|Prehistoric|Early)\b/i;
const COLLECTIVE_NAMES = new Set([
  'Sumerians', 'Phoenicians', 'Mesopotamians', 'Assyrians', 'Celts',
  'Babylonians', 'Romans', 'Greeks', 'Egyptians', 'Persians', 'Incas',
  'Welsh', 'English',
]);

function inventorProse(inv) {
  if (!inv || inv === 'Unknown') return null;
  const collective = COLLECTIVE_PREFIX.test(inv) || inv.includes(',') || COLLECTIVE_NAMES.has(inv);
  const joined = inv.replace(/, /g, ' and ');
  return collective ? 'the ' + joined : joined;
}

function capFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** direct-answer sentence, targeted at search result snippets */
function answerSentence(e) {
  const ip = inventorProse(e.inventor);
  const cp = countryProse(e.country.modern);
  let s = `The ${e.name} was invented ${yearPhrase(e.year)}`;
  if (ip) s += ` by ${ip}`;
  if (cp) s += ` in ${cp}`;
  s += ip ? '.' : '; its inventor is unknown.';
  return s;
}

/** "Who invented the X?" paragraph. */
function whoSentence(e) {
  const ip = inventorProse(e.inventor);
  const cp = countryProse(e.country.modern);
  if (!ip) {
    let s = `The inventor of the ${e.name} is unknown. It dates to ${fmtYear(e.year)}`;
    if (cp) s += ` and originated in ${cp}`;
    return s + '.';
  }
  let s = `${capFirst(ip)} invented the ${e.name} ${yearPhrase(e.year)}`;
  if (cp) s += ` in ${cp}`;
  return s + '.';
}

/* Shows the historical polity only when it is genuinely different (endonym
   check filters trivial pairs like USA / United States). */
function historicalRegion(e) {
  const { modern, endonym, historical } = e.country;
  if (!historical || historical === 'Unknown') return null;
  if (historical === modern || historical === endonym) return null;
  return historical;
}

/* ------------------------------------------------- slugs (stable, deduped) */

const usedSlugs = new Map();
for (const e of data) {
  let slug = slugify(e.name) || 'invention';
  if (usedSlugs.has(slug)) {
    let n = 2;
    while (usedSlugs.has(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }
  usedSlugs.set(slug, e);
  e._slug = slug;
}

/* -------------------------------------------- related inventions selection */

/* Transport and Transportation are the same subject split across two labels;
   merge them for relatedness (display keeps the original label). */
const relKey = (c) => (c === 'Transportation' ? 'Transport' : c);

const byCat = new Map();
for (const e of data) {
  const k = relKey(e.category);
  if (!byCat.has(k)) byCat.set(k, []);
  byCat.get(k).push(e);
}

function relatedTo(e) {
  const near = (a, b) =>
    Math.abs(a.year - e.year) - Math.abs(b.year - e.year) || a.name.localeCompare(b.name);
  let picks = byCat.get(relKey(e.category)).filter((x) => x !== e).sort(near).slice(0, 6);
  if (picks.length < 4) {
    // tiny category: pad with nearest-by-year inventions from the whole set
    const pad = data.filter((x) => x !== e && !picks.includes(x)).sort(near);
    picks = picks.concat(pad.slice(0, 6 - picks.length));
  }
  return picks;
}

/* ------------------------------------------------------------- shared HTML
 *
 * The header, nav drawer, settings modal and their behaviour are extracted from
 * about.html at build time, so these pages inherit any header change on the next
 * regeneration. Extraction throws if about.html's shape changes.
 * sound.js is not loaded here (these pages stay silent), but the header's sound
 * button still toggles the global pref via settings-page.js.
 */

const aboutHtml = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8');

function cut(from, to, label, includeEnd) {
  const i = aboutHtml.indexOf(from);
  if (i < 0) throw new Error('chrome extraction failed: missing start of ' + label);
  const j = aboutHtml.indexOf(to, i + from.length);
  if (j < 0) throw new Error('chrome extraction failed: missing end of ' + label);
  return aboutHtml.slice(i, includeEnd ? j + to.length : j);
}

/* the pages live under /inventions/, so every root-relative link must be absolute */
function absolutize(html) {
  return html
    .replace(/href="index\.html"/g, 'href="/"')
    .replace(/href="(about|infinite|stats|how-to-play|privacy|terms|contact)\.html"/g, 'href="/$1"')
    .replace(/src="js\//g, 'src="/js/');
}

const CHROME_STYLE  = cut('<style>', '</style>', 'style block', true);
const THEME_SCRIPT  = cut("<script>(function(){try{var p=JSON.parse(localStorage.getItem('wi_prefs'))", '</script>', 'theme script', true);
const CHROME_HEADER = absolutize(cut('<header>', '</header>', 'header', true))
  .replace('<span class="logo-stats-text">About</span>', '<span class="logo-stats-text">Inventions</span>');
/* settings modal + nav overlay + nav drawer, then the inline script that drives them */
const CHROME_PANELS = absolutize(cut('<div class="modal-bg" id="m-settings">', '</nav>', 'settings/nav panels', true));
const navScriptStart = aboutHtml.indexOf('<script>', aboutHtml.indexOf("getElementById('nav-overlay')") - 400);
if (navScriptStart < 0) throw new Error('chrome extraction failed: nav script');
const CHROME_NAVSCRIPT = absolutize(aboutHtml.slice(navScriptStart, aboutHtml.indexOf('</script>', navScriptStart) + 9));
/* the site scripts about.html loads, minus sound.js; version query strings ride along */
const CHROME_SCRIPTS = (aboutHtml.match(/<script src="js\/[^"]+"><\/script>/g) || [])
  .filter((t) => !t.includes('sound.js'))
  .map(absolutize)
  // report.js is not in about.html: the report widget lives only on the invention
  // pages, so it is appended here rather than inherited from the chrome.
  .concat('<script src="/js/report.js?v=b27"></script>')
  .join('\n');

/* content-only styles; chrome styling comes from CHROME_STYLE and uses the same theme
 * variables, so dark/light and the colour-blind schemes apply here too */
const CONTENT_CSS = `
main{max-width:760px;margin:0 auto;padding:34px 20px 56px}
main h1{font-size:1.75rem;font-weight:800;line-height:1.25;margin-bottom:18px}
main h2{font-size:1.2rem;font-weight:700;margin:32px 0 12px}
main p{margin-bottom:12px}
main a{color:var(--right)}
.answer{background:var(--surface);border-left:4px solid var(--right);border-radius:8px;padding:16px 18px;font-size:1.06rem;font-weight:600;margin-bottom:18px}
.desc{color:var(--text2)}
main table{width:100%;border-collapse:collapse;margin:22px 0;background:var(--surface);border-radius:8px;overflow:hidden}
main th,main td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--border);font-size:.95rem;vertical-align:top}
main tr:last-child th,main tr:last-child td{border-bottom:none}
main th{color:var(--text2);font-weight:600;width:38%;white-space:nowrap}
main td{font-weight:600}
.yr{color:var(--near);font-weight:800}
.cta{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:22px;text-align:center;margin:32px 0}
.cta p{font-weight:700;font-size:1.05rem;margin-bottom:14px}
.cta a{display:inline-block;background:var(--right);color:#06281d;font-weight:800;padding:12px 26px;border-radius:8px;text-decoration:none}
.cta a:hover{text-decoration:none;filter:brightness(1.08)}
.rel{list-style:none;display:flex;flex-wrap:wrap;gap:10px;padding:0}
.rel a{display:block;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px;color:var(--text);font-weight:600;font-size:.92rem;text-decoration:none}
.rel a:hover{border-color:var(--right)}
.rel span{color:var(--near);font-weight:700}
.toc{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;padding:0}
.toc a{display:block;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:6px 14px;color:var(--text);font-size:.88rem;font-weight:600;text-decoration:none}
.toc a:hover{border-color:var(--right)}
.cols{list-style:none;columns:2;column-gap:28px;padding:0}
.cols li{margin-bottom:6px;break-inside:avoid;font-size:.95rem}
.cols .y{color:var(--text2);font-size:.85rem}
@media(max-width:600px){.cols{columns:1}}
footer.inv-foot{border-top:1px solid var(--border);color:var(--text2);font-size:.85rem}
.fwrap{max-width:760px;margin:0 auto;padding:20px;display:flex;flex-wrap:wrap;gap:10px 24px;justify-content:space-between}
footer.inv-foot a{color:var(--text2)}
`.trim();

const FOOTER = `<footer class="inv-foot"><div class="fwrap">
<div><a href="${SITE}/">Inventle</a> &mdash; the daily invention guessing game</div>
<div><a href="./">All inventions</a> &middot; <a href="${SITE}/about">About</a> &middot; <a href="#" data-report>See something wrong?</a></div>
</div></footer>`;

function pageShell({ title, desc, canonical, jsonLd, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Inventle">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${CHROME_STYLE}
<style>${CONTENT_CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\u003c')}</script>
</head>
<body>
${THEME_SCRIPT}
${CHROME_HEADER}
<main>
${body}
</main>
${FOOTER}
${CHROME_PANELS}
${CHROME_NAVSCRIPT}
${CHROME_SCRIPTS}
</body>
</html>
`;
}

/* --------------------------------------------------------- invention pages */

function inventionPage(e) {
  const year = fmtYear(e.year);
  const title = `When was the ${e.name} invented? (${year})`;
  const question = `When was the ${e.name} invented?`;
  const answer = answerSentence(e);
  const who = whoSentence(e);
  const hist = historicalRegion(e);
  const canonical = `${BASE}/${e._slug}`;

  let desc = answer;
  if (desc.length <= 110) desc += ' Play Inventle, the free daily invention-guessing game.';

  const faq = [
    {
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: `${answer} ${e.description}` },
    },
    {
      '@type': 'Question',
      name: `Who invented the ${e.name}?`,
      acceptedAnswer: { '@type': 'Answer', text: who },
    },
  ];
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq };

  const rows = [
    `<tr><th>Year invented</th><td><span class="yr">${esc(year)}</span></td></tr>`,
    `<tr><th>Inventor</th><td>${esc(e.inventor)}</td></tr>`,
    `<tr><th>Country</th><td>${esc(e.country.modern)}</td></tr>`,
    hist ? `<tr><th>Region at the time</th><td>${esc(hist)}</td></tr>` : '',
    `<tr><th>Category</th><td>${esc(e.category)}</td></tr>`,
  ].filter(Boolean).join('\n');

  const rel = relatedTo(e)
    .map((r) => `<li><a href="${r._slug}">${esc(r.name)} <span>${esc(fmtYear(r.year))}</span></a></li>`)
    .join('\n');

  const body = `<h1>${esc(question)}</h1>
<p class="answer">${esc(answer)}</p>
<p class="desc">${esc(e.description)}</p>
<table>
${rows}
</table>
<h2>Who invented the ${esc(e.name)}?</h2>
<p>${esc(who)}</p>
<div class="cta">
<p>Think you could have guessed it?</p>
<a href="${SITE}/">Play today's invention puzzle &rarr;</a>
</div>
<h2>Related inventions</h2>
<ul class="rel">
${rel}
</ul>`;

  return pageShell({ title, desc, canonical, jsonLd, body });
}

/* --------------------------------------------------------------- hub page */

function indexPage() {
  const total = data.length;
  const title = `When Was It Invented? A\u2013Z of ${total} Inventions`;
  const desc = `Browse all ${total} inventions from the Inventle daily game, grouped by category. ` +
    `Find out when each one was invented, who invented it, and where.`;
  const canonical = `${BASE}/`;

  // group by display category (Transportation folded into Transport)
  const groups = new Map();
  for (const e of data) {
    const k = relKey(e.category);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const cats = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  const toc = cats
    .map((c) => `<li><a href="#c-${slugify(c)}">${esc(c)} (${groups.get(c).length})</a></li>`)
    .join('\n');

  const sections = cats
    .map((c) => {
      const items = groups.get(c)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => `<li><a href="${e._slug}">${esc(e.name)}</a> <span class="y">${esc(fmtYear(e.year))}</span></li>`)
        .join('\n');
      return `<section id="c-${slugify(c)}">
<h2>${esc(c)}</h2>
<ul class="cols">
${items}
</ul>
</section>`;
    })
    .join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: desc,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Inventle', url: `${SITE}/` },
  };

  const body = `<h1>When was it invented? All ${total} inventions</h1>
<p>The complete Inventle archive: ${total} inventions across ${cats.length} categories, from the first stone tools to the modern web.
Every entry answers the question &ldquo;when was it invented?&rdquo; &mdash; the year, the inventor, and the country.</p>
<div class="cta">
<p>Think you could have guessed the years?</p>
<a href="${SITE}/">Play today's invention puzzle &rarr;</a>
</div>
<h2>Browse by category</h2>
<ul class="toc">
${toc}
</ul>
${sections}`;

  return pageShell({ title, desc, canonical, jsonLd, body });
}

/* ---------------------------------------------------------------- sitemap */

function sitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `<url><loc>${BASE}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ...data.map(
      (e) =>
        `<url><loc>${BASE}/${e._slug}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

/* ------------------------------------------------------------------ write */

function pruneStale(dir, keep) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.html') && !keep.has(f)) {
      fs.unlinkSync(path.join(dir, f));
      n++;
    }
  }
  return n;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const written = new Set();
let totalBytes = 0;
let maxBytes = 0;
let maxPage = '';

for (const e of data) {
  const html = inventionPage(e);
  const file = `${e._slug}.html`;
  fs.writeFileSync(path.join(OUT_DIR, file), html);
  written.add(file);
  const b = Buffer.byteLength(html);
  totalBytes += b;
  if (b > maxBytes) { maxBytes = b; maxPage = file; }
}

const indexHtml = indexPage();
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml);
written.add('index.html');
totalBytes += Buffer.byteLength(indexHtml);

const smap = sitemapXml();
fs.writeFileSync(path.join(ROOT, 'inventions-sitemap.xml'), smap);

const pruned = pruneStale(OUT_DIR, written);

/* mirror into deploy/ */
const deployOut = path.join(DEPLOY_DIR, 'inventions');
fs.mkdirSync(deployOut, { recursive: true });
for (const f of written) {
  fs.copyFileSync(path.join(OUT_DIR, f), path.join(deployOut, f));
}
const prunedDeploy = pruneStale(deployOut, written);
fs.copyFileSync(path.join(ROOT, 'inventions-sitemap.xml'), path.join(DEPLOY_DIR, 'inventions-sitemap.xml'));

console.log(`Generated ${written.size - 1} invention pages + index.html in inventions/`);
console.log(`Sitemap: inventions-sitemap.xml (${data.length + 1} URLs)`);
console.log(`Mirrored to deploy/inventions/ and deploy/inventions-sitemap.xml`);
console.log(`Total HTML: ${(totalBytes / 1024).toFixed(0)} KB; largest page: ${maxPage} (${(maxBytes / 1024).toFixed(1)} KB)`);
if (pruned || prunedDeploy) console.log(`Pruned stale files: ${pruned} root, ${prunedDeploy} deploy`);
