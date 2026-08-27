# Inventle

A daily invention-guessing game. You get six tries to name the year a famous
invention was created, with Wordle-style feedback on every digit.

Live at **[inventle.io](https://inventle.io)**

---

## The game

Guess a four-digit year. Each digit comes back coloured:

| Colour | Meaning |
| ------ | ------- |
| green  | exact digit |
| amber  | off by one |
| slate  | off by two or more |

Years before the common era are entered with an AD/BC toggle, so the answer
space runs from 9999 BC to the present day.

Two extra rounds follow the main puzzle: guess the country the invention came
from, then guess the inventor. Both are multiple choice with two attempts each.

**Infinite mode** drops the once-a-day limit and adds a run structure — strikes,
shields and a streak counter — over the same 773-invention set.

## Architecture

No build step, no framework, no bundler. Plain HTML, CSS and ES5-compatible
JavaScript, served as static files.

```
index.html          daily puzzle
infinite.html       endless mode
stats.html          global statistics dashboard
about/ contact/ ... static pages

js/core.js          shared game engine, rendering, settings, i18n glue
js/game.js          daily-specific logic and persistence
js/infinite.js      run structure: strikes, shields, streaks
js/global-stats.js  statistics dashboard
js/sound.js         Web Audio effects (synthesised + a few samples)
js/i18n.js          14-language string table
locales/            per-language invention names and descriptions

worker/src/index.js Cloudflare Worker: puzzle API, guess checking, statistics
worker/*.sql        D1 schema and migrations

tools/generate-invention-pages.js
                    static-site generator: one landing page per invention,
                    inheriting the site chrome from about.html at build time
```

**Hosting:** Cloudflare Pages for the static site, a Cloudflare Worker for the
API, D1 (SQLite) for statistics, KV for the invention data.

### Why the answer lives on the server

The daily page never receives the answer. `js/data-daily.js` ships invention
names and descriptions but **no years**; the Worker holds the year and grades
each guess. Infinite mode is different — it needs the whole dataset locally, so
`js/data.js` includes years there.

Which invention appears on which day comes from a seeded permutation of the
list, computed in the Worker. **That permutation is redacted in this repository**
— publishing it would hand over every future answer. See `serverShuffle` in
`worker/src/index.js`; drop in your own seed to run it.

## Running locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

The static site works on its own. Anything server-backed — the daily answer,
guess checking, global statistics — needs the Worker running too:

```bash
cd worker
npx wrangler dev
```

See `worker/SETUP.md` for creating the D1 database and loading the invention
data. `worker/wrangler.toml` ships with placeholder resource IDs; replace them
with your own.

## Regenerating the invention pages

```bash
node tools/generate-invention-pages.js
```

Reads `inventions.json` and emits a landing page per invention plus an index
and a sitemap. The page chrome is extracted from `about.html` at build time, so
a header change on the main site is inherited automatically rather than drifting.

## Data

`inventions.json` holds 773 entries — name, year, country, inventor, category
and a short description. `inventions.schema.md` documents the shape.

Inventions with genuinely disputed dates are graded against a year *range*
rather than a single value; the ranges live in `YEAR_RANGES` in the Worker.

## What is not in this repository

- Sound files — third-party audio that is licensed for use on the site but not
  for redistribution. `js/sound.js` degrades to silence when they are absent.
- The generated `inventions/` pages and the deploy mirror — both rebuildable.
- The daily permutation seed, and live Cloudflare resource IDs.

## License

MIT — see [LICENSE](LICENSE).

The invention dataset is compiled from public sources. The Inventle name and
logo are not covered by the licence.
