# Inventle Stats Backend — Setup Guide

## Prerequisites
- Cloudflare account (free tier works)
- Node.js installed
- Wrangler CLI: `npm install -g wrangler`

## Step 1: Login to Cloudflare
```bash
wrangler login
```

## Step 2: Create the D1 Database
```bash
cd worker
wrangler d1 create inventle-stats
```
This outputs a database_id. Copy it.

## Step 3: Update wrangler.toml
Replace `YOUR_DATABASE_ID_HERE` with the actual database_id from step 2.

## Step 4: Initialize the Database Schema
```bash
wrangler d1 execute inventle-stats --file=schema.sql
```

## Step 5: Upload the Invention Data
Generate a minified JSON of your inventions and upload as a secret:
```bash
cd ..
node -e "var d=JSON.parse(require('fs').readFileSync('inventions.json'));console.log(JSON.stringify(d));" > worker/inventions_min.json
cd worker
wrangler secret put INVENTIONS_JSON < inventions_min.json
```

## Step 6: Deploy the Worker
```bash
wrangler deploy
```
This gives you a URL like: `https://inventle-stats.YOUR_SUBDOMAIN.workers.dev`

## Step 7: Update Frontend
Point the client at your Worker. The URL appears in three files — `js/game.js`
(top of file, `INVENTLE_API`), `js/global-stats.js` and `js/report.js`:
```javascript
var INVENTLE_API = 'https://inventle-stats.YOUR_SUBDOMAIN.workers.dev';
```

Or if you set up a custom domain (e.g., `api.inventle.io`), use that instead.

## Step 8: Update CORS
In `wrangler.toml`, set `ALLOWED_ORIGIN` to your actual domain:
```toml
[vars]
ALLOWED_ORIGIN = "https://inventle.io"
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/puzzle?date=2026-03-15` | Get today's puzzle (±1 day for timezone coverage) |
| POST | `/api/stats` | Submit game result |
| GET | `/api/stats/today` | Today's aggregated stats |
| GET | `/api/stats/puzzle?num=438` | Stats for a specific puzzle |
| GET | `/api/stats/countries?range=1W` | Country leaderboard |
| GET | `/api/stats/hardest` | Hardest puzzles (30 days) |
| GET | `/api/stats/distribution?range=1M&country=US` | Guess distribution |
| GET | `/api/stats/trends?days=7` | Daily player/win trends |
| GET | `/api/stats/live` | Live player count + hourly breakdown |

## Daily Puzzle Architecture

The server holds the full invention list, including years, and decides which
invention appears on a given day by applying a seeded permutation to that list.

The daily client never receives the answer: `js/data-daily.js` ships names and
descriptions but no years, so the year exists only server-side and every guess
is graded by the Worker. (Infinite mode is different — it needs the whole
dataset locally, so `js/data.js` includes years there.)

The permutation is redacted in the public repository, since publishing it would
reveal every future answer. See `serverShuffle` in `src/index.js` and supply
your own seed.

**Flow:**
1. Client loads and fetches `/api/puzzle?date=YYYY-MM-DD`
2. The response supplies the invention name and description — never the year
3. Each guess is POSTed to `/api/guess`, which returns per-digit colours
4. Until the fetch resolves, guessing is blocked and the page says so; if the
   server is unreachable the daily puzzle cannot be played

**Timezone coverage:**
The server accepts dates ±1 day from UTC to handle all timezones (UTC-12 to UTC+14).
This means at any moment, 3 puzzles are "valid" (yesterday, today, tomorrow relative to UTC).

### Time Range Values
`1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, `ALL`

## Problem Reports (optional)

The invention pages carry a "See something wrong?" form. To enable it:

```bash
wrangler d1 execute inventle-stats --remote --file=migrate-reports.sql
wrangler secret put REPORTS_KEY      # any random string; guards the read endpoint
```

Reports are stored in D1 and rate-limited by IP hash (3 per address per day,
40 site-wide). Read them with:

```
GET /api/reports?key=<REPORTS_KEY>&limit=50
```

Direct email is optional on top. The `[[send_email]]` binding in `wrangler.toml`
only delivers once Email Routing is enabled on the zone and the destination
address is verified; until then reports still land in the table. Set the
destination in `REPORT_TO` at the top of `src/index.js`.

## Privacy
- IP addresses are NEVER stored in the database
- Country is derived from Cloudflare's edge geolocation (`request.cf.country`)
- The IP never reaches the Worker code — Cloudflare resolves it at the network level
- A gameplay fingerprint hash is used for dedup but cannot identify anyone
- All stored data is fully anonymous

## Cost
- Cloudflare Workers free tier: 100,000 requests/day
- D1 free tier: 5 million rows read/day, 100,000 rows written/day
- At 10K daily players: ~10K writes + ~50K reads = well within free tier
