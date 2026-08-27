/**
 * Inventle Global Stats API
 * Cloudflare Worker + D1 Database
 *
 * Privacy: IP addresses are NEVER stored.
 * Country is derived from Cloudflare's edge geolocation (request.cf.country),
 * resolved at the network level, so the IP never reaches this code.
 * A dedup hash prevents duplicate submissions but cannot be reversed to identify anyone.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers — allow pages.dev previews + production domain
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = (origin.endsWith('.inventle.pages.dev') || origin === 'https://inventle.pages.dev' || origin === 'https://inventle.io' || origin.endsWith('.inventle.io') || origin === 'http://localhost:8000') ? origin : (env.ALLOWED_ORIGIN || '*');
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      // ACAO varies per request Origin; without this a cache may serve one origin's header to another
      'Vary': 'Origin',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route requests
      if (request.method === 'POST' && path === '/api/stats') {
        return await handleSubmit(request, env, corsHeaders);
      }
      // fired on the player's first guess, so "started but never finished" is measurable
      if (request.method === 'POST' && path === '/api/stats/start') {
        return await handleStart(request, env, corsHeaders);
      }
      // "See something wrong?" problem reports
      if (request.method === 'POST' && path === '/api/report') {
        return await handleReport(request, env, corsHeaders);
      }
      // Admin read: GET /api/reports?key=<REPORTS_KEY secret>&limit=50
      if (request.method === 'GET' && path === '/api/reports') {
        return await handleReportsList(request, env, corsHeaders, url);
      }
      if (request.method === 'GET' && path === '/api/stats/today') {
        const puzzle = url.searchParams.get('puzzle');
        const todayRange = url.searchParams.get('range');
        return await handleToday(env, corsHeaders, puzzle, todayRange, cleanCountry(url.searchParams.get('country')));
      }
      if (request.method === 'GET' && path === '/api/stats/puzzle') {
        const num = url.searchParams.get('num');
        return await handlePuzzle(env, corsHeaders, num);
      }
      if (request.method === 'GET' && path === '/api/stats/countries') {
        const range = url.searchParams.get('range') || '1D';
        return await handleCountries(env, corsHeaders, range);
      }
      if (request.method === 'GET' && path === '/api/stats/hardest') {
        const hardestRange = url.searchParams.get('range');
        return await handleHardest(env, corsHeaders, hardestRange, cleanCountry(url.searchParams.get('country')));
      }
      if (request.method === 'GET' && path === '/api/stats/distribution') {
        const range = url.searchParams.get('range') || '1D';
        return await handleDistribution(env, corsHeaders, range, cleanCountry(url.searchParams.get('country')));
      }
      if (request.method === 'GET' && path === '/api/stats/trends') {
        // Prefer ?range= (the selector value); ?days= stays supported for older clients.
        const trendRange = url.searchParams.get('range');
        let days = parseInt(url.searchParams.get('days'), 10);
        if (!Number.isFinite(days) || days < 1) days = 7; // guard NaN / bad input
        return await handleTrends(env, corsHeaders, days, trendRange, cleanCountry(url.searchParams.get('country')));
      }
      // Everything the detail pages need that is not in puzzle_stats: streak buckets,
      // first-guess centuries, hourly plays, share-by-guess, BC-by-difficulty.
      if (request.method === 'GET' && path === '/api/stats/breakdown') {
        const range = url.searchParams.get('range') || '1D';
        return await handleBreakdown(env, corsHeaders, range, cleanCountry(url.searchParams.get('country')));
      }
      if (request.method === 'GET' && path === '/api/stats/live') {
        return await handleLive(env, corsHeaders);
      }
      if (request.method === 'GET' && path === '/api/puzzle') {
        const clientDate = url.searchParams.get('date');
        return handleDailyPuzzle(env, corsHeaders, clientDate);
      }
      if (request.method === 'POST' && path === '/api/guess') {
        return await handleGuess(request, env, corsHeaders);
      }

      return json({ error: 'Not found' }, 404, corsHeaders);
    } catch (err) {
      return json({ error: 'Internal error', detail: err.message }, 500, corsHeaders);
    }
  }
};

// ==================== HELPERS: PUZZLE NUM ====================
// Get current puzzle_num in PST (UTC-8)
function getPSTPuzzleNum() {
  const now = new Date();
  const pst = new Date(now.getTime() - 8 * 3600000);
  const epoch = new Date('2025-01-01T00:00:00Z');
  return Math.floor((pst - epoch) / 864e5) + 1;
}

// Get current server puzzle_num (UTC-based, for live counter)
function getUTCPuzzleNum() {
  const now = new Date();
  const epoch = new Date('2025-01-01T00:00:00Z');
  return Math.floor((now - epoch) / 864e5) + 1;
}

// Country codes come straight off a query string, so only the 2-letter ISO shape the
// edge writes is accepted; anything else can only ever be a no-match.
function cleanCountry(c) {
  if (!c) return null;
  const up = String(c).toUpperCase();
  return /^[A-Z]{2}$/.test(up) ? up : null;
}

// Convert range label to puzzle_num bounds [from, to]
function getPuzzleRange(range, currentPuzzle) {
  switch (range) {
    case '1D': return [currentPuzzle, currentPuzzle];
    case '1W': return [currentPuzzle - 6, currentPuzzle];
    case '1M': return [currentPuzzle - 29, currentPuzzle];
    case '3M': return [currentPuzzle - 89, currentPuzzle];
    case '6M': return [currentPuzzle - 179, currentPuzzle];
    case '1Y': return [currentPuzzle - 364, currentPuzzle];
    case 'ALL': return [1, Number.MAX_SAFE_INTEGER]; // never exclude a row filed under a timezone-ahead puzzle number
    default: return [currentPuzzle, currentPuzzle];
  }
}

// ==================== SUBMIT STATS ====================
async function handleSubmit(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }

  // Validate required fields
  if (typeof body.p !== 'number' || typeof body.w !== 'number') {
    return json({ error: 'Missing required fields' }, 400, cors);
  }

  // Safeguard: reject submissions outside realistic puzzle range (PST ± 2)
  const pstPuzzle = getPSTPuzzleNum();
  if (body.p < pstPuzzle - 2 || body.p > pstPuzzle + 2) {
    return json({ error: 'Puzzle number out of range' }, 400, cors);
  }

  // Get country from Cloudflare edge geolocation (IP never reaches our code)
  const country = (request.cf && request.cf.country) || 'XX';

  const today = new Date().toISOString().split('T')[0];
  const puzzleNum = body.p;

  // Clamp untrusted numeric fields to sane ranges (anti stat-poisoning).
  body.g = Math.min(Math.max(Math.round(+body.g || 0), 0), 6);
  body.t = Math.min(Math.max(Math.round(+body.t || 0), 0), 86400);
  body.sk = Math.min(Math.max(Math.round(+body.sk || 0), 0), 100000);
  body.fg = Math.min(Math.max(Math.round(+body.fg || 0), -9999), 2026);
  body.w = body.w ? 1 : 0;
  const amend = body.amend ? 1 : 0;

  // Prefers the client's per-game id for dedup so two players with identical timings
  // cannot collide; falls back to a gameplay fingerprint for older clients.
  const dedupSeed = body.sid ? ('sid:' + String(body.sid)) : [body.p, body.g, body.fg, body.t, (body.gt || []).join(',')].join(':');
  const realDedup = await hashString(dedupSeed + ':' + country + ':' + puzzleNum);

  // Check for duplicate / amendable submission
  const existing = await env.DB.prepare(
    'SELECT id, b1_result, b2_result, shared FROM game_results WHERE dedup_hash = ?'
  ).bind(realDedup).first();

  if (existing) {
    if (amend) {
      // same game re-submitted after bonus rounds / share: apply just the delta
      await applyAmendment(env.DB, today, puzzleNum, country, existing, body);
      return json({ ok: true, msg: 'Amended' }, 200, cors);
    }
    return json({ ok: true, msg: 'Already submitted' }, 200, cors);
  }

  // Insert the result
  await env.DB.prepare(`
    INSERT INTO game_results
    (puzzle_num, play_date, country, won, guesses, total_time, guess_intervals,
     first_guess, used_bc, input_method, keyboard_type, b1_result, b2_result,
     shared, mobile, dark_mode, color_scheme, streak, hour_utc, dedup_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.p,           // puzzle_num
    today,            // play_date
    country,          // country (from CF edge, IP never stored)
    body.w || 0,      // won
    body.g || 0,      // guesses
    body.t || 0,      // total_time
    JSON.stringify(body.gt || []), // guess_intervals
    body.fg || 0,     // first_guess
    body.bc || 0,     // used_bc
    body.im || 'none',// input_method
    body.kt || 'none',// keyboard_type
    body.b1 || 'none',// b1_result
    body.b2 || 'none',// b2_result
    body.sh || 0,     // shared
    body.mb || 0,     // mobile
    body.dk || 0,     // dark_mode
    body.sc || 0,     // color_scheme
    body.sk || 0,     // streak
    body.h || 0,      // hour_utc
    realDedup         // dedup_hash
  ).run();

  // update daily aggregates (kept for backward compatibility)
  await updateDailyStats(env.DB, today, country, body);
  await updateDailyStats(env.DB, today, 'ALL', body);

  // update puzzle-based aggregates (primary system)
  await updatePuzzleStats(env.DB, puzzleNum, country, body);
  await updatePuzzleStats(env.DB, puzzleNum, 'ALL', body);

  return json({ ok: true }, 200, cors);
}

// ==================== RECORD A GAME START ====================
// Written when the player commits their first guess. Uses the same dedup hash the
// completed result will use, so the two rows join on it and a reload cannot inflate
// the count.
// ============ "SEE SOMETHING WRONG?" REPORTS ============
// Always stored in D1; email is best-effort on top. The REPORT_MAIL send_email binding
// only works once Email Routing is enabled on the zone and the destination address is
// verified; until then reports still land in the table and are readable via /api/reports.
const REPORT_TO = 'you@example.com';   // set to your own address

async function handleReport(request, env, cors) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors); }

  // honeypot: a hidden "website" field. A filled one returns 200 and stores nothing.
  if (body.website) return json({ ok: true }, 200, cors);

  const email = String(body.email || '').trim().slice(0, 200);
  const message = String(body.message || '').trim().slice(0, 1000);
  const page = String(body.page || '').trim().slice(0, 300);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'valid email required' }, 400, cors);
  if (message.length < 10) return json({ error: 'message too short' }, 400, cors);

  const ip = request.headers.get('CF-Connecting-IP') || '0';
  const ipHash = (await hashString('report:' + ip)).slice(0, 24);

  // rate limits, counted straight off the table: 3 per IP per day, 40 total per day
  const mine = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM reports WHERE ip_hash = ? AND created > datetime('now','-1 day')"
  ).bind(ipHash).first();
  if ((mine?.n || 0) >= 3) return json({ error: 'limit reached — try again tomorrow' }, 429, cors);
  const all = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM reports WHERE created > datetime('now','-1 day')"
  ).first();
  if ((all?.n || 0) >= 40) return json({ error: 'report inbox is full — try again tomorrow' }, 429, cors);

  const country = cleanCountry(request.cf?.country);

  // best-effort direct email; failure must never lose the report
  let emailed = 0;
  if (env.REPORT_MAIL) {
    try {
      const { EmailMessage } = await import('cloudflare:email');
      const from = 'reports@inventle.io';
      const CRLF = '\r\n';
      const raw = [
        'From: Inventle Reports <' + from + '>',
        'To: <' + REPORT_TO + '>',
        'Reply-To: <' + email + '>',
        'Subject: [Inventle report] ' + (page || 'site'),
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Page: ' + (page || '(not given)'),
        'From: ' + email + (country ? ' (' + country + ')' : ''),
        '',
        message,
        ''
      ].join(CRLF);
      await env.REPORT_MAIL.send(new EmailMessage(from, REPORT_TO, raw));
      emailed = 1;
    } catch (e) { emailed = 0; }
  }

  await env.DB.prepare(
    'INSERT INTO reports (email, message, page, country, ip_hash, emailed) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(email, message, page, country, ipHash, emailed).run();

  return json({ ok: true }, 200, cors);
}

async function handleReportsList(request, env, cors, url) {
  if (!env.REPORTS_KEY || url.searchParams.get('key') !== env.REPORTS_KEY) {
    return json({ error: 'unauthorized' }, 401, cors);
  }
  let limit = parseInt(url.searchParams.get('limit'), 10);
  if (!Number.isFinite(limit) || limit < 1 || limit > 200) limit = 50;
  const rows = await env.DB.prepare(
    'SELECT id, created, email, message, page, country, emailed FROM reports ORDER BY id DESC LIMIT ?'
  ).bind(limit).all();
  return json({ reports: rows.results || [] }, 200, cors);
}

async function handleStart(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }
  if (typeof body.p !== 'number' || !body.sid) {
    return json({ error: 'Missing required fields' }, 400, cors);
  }
  // same window guard as handleSubmit: refuse puzzle numbers that cannot be current
  const pstPuzzle = getPSTPuzzleNum();
  if (body.p < pstPuzzle - 2 || body.p > pstPuzzle + 2) {
    return json({ error: 'Puzzle number out of range' }, 400, cors);
  }

  const country = (request.cf && request.cf.country) || 'XX';
  const today = new Date().toISOString().split('T')[0];
  const hash = await hashString('sid:' + String(body.sid) + ':' + country + ':' + body.p);
  const hour = Math.min(23, Math.max(0, Math.round(+body.h || 0)));

  // INSERT OR IGNORE: a repeated ping for the same game is a no-op
  await env.DB.prepare(
    'INSERT OR IGNORE INTO game_starts (puzzle_num, play_date, country, hour_utc, mobile, dedup_hash) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(body.p, today, country, hour, body.mb ? 1 : 0, hash).run();

  return json({ ok: true }, 200, cors);
}

// Starts vs. completions for a window. A start is finished when a game_results row
// carries the same dedup hash; everything else was abandoned mid-game.
async function getUnfinished(db, fromPuzzle, toPuzzle, country) {
  const cw = country ? ' AND s.country = ?' : '';
  const params = country ? [fromPuzzle, toPuzzle, country] : [fromPuzzle, toPuzzle];
  const row = await db.prepare(`
    SELECT
      COUNT(*) AS starts,
      SUM(CASE WHEN r.dedup_hash IS NULL THEN 1 ELSE 0 END) AS unfinished
    FROM game_starts s
    LEFT JOIN game_results r ON r.dedup_hash = s.dedup_hash
    WHERE s.puzzle_num >= ? AND s.puzzle_num <= ?${cw}
  `).bind(...params).first();

  const starts = (row && row.starts) || 0;
  const unfinished = (row && row.unfinished) || 0;
  return {
    starts: starts,
    finished: starts - unfinished,
    unfinished: unfinished,
    // rate is only meaningful once some games have been started
    unfinishedRate: starts > 0 ? Math.round(unfinished / starts * 100) : 0,
    // Per-puzzle series for the trend chart.
    daily: await unfinishedDaily(db, fromPuzzle, toPuzzle, country)
  };
}

async function unfinishedDaily(db, fromPuzzle, toPuzzle, country) {
  const cw = country ? ' AND s.country = ?' : '';
  const params = country ? [fromPuzzle, toPuzzle, country] : [fromPuzzle, toPuzzle];
  const rows = await db.prepare(`
    SELECT s.puzzle_num AS puzzle_num,
           COUNT(*) AS starts,
           SUM(CASE WHEN r.dedup_hash IS NULL THEN 1 ELSE 0 END) AS unfinished
    FROM game_starts s
    LEFT JOIN game_results r ON r.dedup_hash = s.dedup_hash
    WHERE s.puzzle_num >= ? AND s.puzzle_num <= ?${cw}
    GROUP BY s.puzzle_num
    ORDER BY s.puzzle_num ASC
    LIMIT 400
  `).bind(...params).all();
  return (rows.results || []).map(r => ({
    puzzle_num: r.puzzle_num,
    starts: r.starts,
    unfinished: r.unfinished,
    rate: r.starts > 0 ? Math.round(r.unfinished / r.starts * 100) : 0
  }));
}

// Bonus result semantics: only win-1/win-2/loss count as a played round.
// 'skip'/'none' are not played, and 'win-free' is a freebie rather than a win.
function bonusPlayed(r) { return (r === 'win-1' || r === 'win-2' || r === 'loss') ? 1 : 0; }
function bonusWon(r) { return (r === 'win-1' || r === 'win-2') ? 1 : 0; }

// ==================== AMEND A PRIOR SUBMISSION ====================
// Applies only the delta for the bonus and share columns, so re-submitting cannot
// double-count the main result.
async function applyAmendment(db, date, puzzleNum, country, existing, body) {
  const oldB1 = existing.b1_result || 'none', oldB2 = existing.b2_result || 'none', oldSh = existing.shared ? 1 : 0;
  const newB1 = body.b1 || 'none', newB2 = body.b2 || 'none', newSh = body.sh ? 1 : 0;
  const won = body.w ? 1 : 0;
  const dB1p = bonusPlayed(newB1) - bonusPlayed(oldB1);
  const dB1w = bonusWon(newB1) - bonusWon(oldB1);
  const dB2p = bonusPlayed(newB2) - bonusPlayed(oldB2);
  const dB2w = bonusWon(newB2) - bonusWon(oldB2);
  const dB1ft = (newB1 === 'win-1' ? 1 : 0) - (oldB1 === 'win-1' ? 1 : 0);
  const dBothWon = ((bonusWon(newB1) && bonusWon(newB2)) ? 1 : 0) - ((bonusWon(oldB1) && bonusWon(oldB2)) ? 1 : 0);
  const dSh = newSh - oldSh;
  const dShWin = won ? dSh : 0;
  const dShLoss = won ? 0 : dSh;

  // keeps the per-row record accurate for any future re-aggregation
  await db.prepare('UPDATE game_results SET b1_result = ?, b2_result = ?, shared = ? WHERE id = ?')
    .bind(newB1, newB2, newSh, existing.id).run();

  if (!dB1p && !dB1w && !dB2p && !dB2w && !dB1ft && !dBothWon && !dSh) return;

  const applyTo = async (table, keyCol, keyVal, c) => {
    await db.prepare(
      'UPDATE ' + table + ' SET b1_played=b1_played+?, b1_won=b1_won+?, b2_played=b2_played+?, b2_won=b2_won+?, ' +
      'b1_first_try=b1_first_try+?, both_won=both_won+?, shared_count=shared_count+?, ' +
      'shared_win_count=shared_win_count+?, shared_loss_count=shared_loss_count+? ' +
      'WHERE ' + keyCol + '=? AND country=?'
    ).bind(dB1p, dB1w, dB2p, dB2w, dB1ft, dBothWon, dSh, dShWin, dShLoss, keyVal, c).run();
  };
  await applyTo('daily_stats', 'play_date', date, country);
  await applyTo('daily_stats', 'play_date', date, 'ALL');
  await applyTo('puzzle_stats', 'puzzle_num', puzzleNum, country);
  await applyTo('puzzle_stats', 'puzzle_num', puzzleNum, 'ALL');
}

// ==================== UPDATE DAILY AGGREGATES ====================
async function updateDailyStats(db, date, country, body) {
  // Pre-compute values
  const won = body.w || 0;
  const guesses = body.g || 0;
  const time = body.t || 0;
  const d1 = won && guesses === 1 ? 1 : 0;
  const d2 = won && guesses === 2 ? 1 : 0;
  const d3 = won && guesses === 3 ? 1 : 0;
  const d4 = won && guesses === 4 ? 1 : 0;
  const d5 = won && guesses === 5 ? 1 : 0;
  const d6 = won && guesses === 6 ? 1 : 0;
  const b1p = bonusPlayed(body.b1);
  const b1w = bonusWon(body.b1);
  const b2p = bonusPlayed(body.b2);
  const b2w = bonusWon(body.b2);
  const shared = body.sh || 0;
  const mob = body.mb ? 1 : 0;
  const desk = body.mb ? 0 : 1;
  const kb = body.im === 'keyboard' || body.im === 'both' ? 1 : 0;
  const np = body.im === 'numpad' || body.im === 'both' ? 1 : 0;
  const bc = body.bc || 0;
  const fg = body.fg || 0;
  // Extended stats
  const dark = body.dk ? 1 : 0;
  const sc = Math.min(Math.max(body.sc || 0, 0), 3);
  const s0 = sc === 0 ? 1 : 0;
  const s1 = sc === 1 ? 1 : 0;
  const s2 = sc === 2 ? 1 : 0;
  const s3 = sc === 3 ? 1 : 0;
  const streak = body.sk || 0;
  const both = body.im === 'both' ? 1 : 0;
  const bcWin = bc && won ? 1 : 0;
  const shWin = shared && won ? 1 : 0;
  const shLoss = shared && !won ? 1 : 0;
  const b1ft = body.b1 === 'win-1' ? 1 : 0; // country bonus first try
  const bothWon = b1w && b2w ? 1 : 0; // won both bonuses

  // Upsert daily stats
  await db.prepare(`
    INSERT INTO daily_stats (play_date, country, total_players, total_wins, total_guesses, total_time,
      dist_1, dist_2, dist_3, dist_4, dist_5, dist_6,
      b1_played, b1_won, b2_played, b2_won, shared_count,
      mobile_count, desktop_count, keyboard_count, numpad_count,
      bc_used_count, first_guess_sum,
      dark_count, scheme_0, scheme_1, scheme_2, scheme_3,
      streak_sum, streak_max, both_count, bc_win_count, shared_win_count, shared_loss_count,
      b1_first_try, both_won)
    VALUES (?, ?, 1, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?)
    ON CONFLICT(play_date, country) DO UPDATE SET
      total_players = total_players + 1,
      total_wins = total_wins + ?,
      total_guesses = total_guesses + ?,
      total_time = total_time + ?,
      dist_1 = dist_1 + ?, dist_2 = dist_2 + ?, dist_3 = dist_3 + ?,
      dist_4 = dist_4 + ?, dist_5 = dist_5 + ?, dist_6 = dist_6 + ?,
      b1_played = b1_played + ?, b1_won = b1_won + ?,
      b2_played = b2_played + ?, b2_won = b2_won + ?,
      shared_count = shared_count + ?,
      mobile_count = mobile_count + ?, desktop_count = desktop_count + ?,
      keyboard_count = keyboard_count + ?, numpad_count = numpad_count + ?,
      bc_used_count = bc_used_count + ?, first_guess_sum = first_guess_sum + ?,
      dark_count = dark_count + ?,
      scheme_0 = scheme_0 + ?, scheme_1 = scheme_1 + ?, scheme_2 = scheme_2 + ?, scheme_3 = scheme_3 + ?,
      streak_sum = streak_sum + ?,
      streak_max = MAX(streak_max, ?),
      both_count = both_count + ?,
      bc_win_count = bc_win_count + ?,
      shared_win_count = shared_win_count + ?,
      shared_loss_count = shared_loss_count + ?,
      b1_first_try = b1_first_try + ?,
      both_won = both_won + ?,
      updated_at = datetime('now')
  `).bind(
    // INSERT values
    date, country,
    won, guesses, time,
    d1, d2, d3, d4, d5, d6,
    b1p, b1w, b2p, b2w, shared,
    mob, desk, kb, np, bc, fg,
    dark, s0, s1, s2, s3,
    streak, streak, both, bcWin, shWin, shLoss,
    b1ft, bothWon,
    // UPDATE values (same order)
    won, guesses, time,
    d1, d2, d3, d4, d5, d6,
    b1p, b1w, b2p, b2w, shared,
    mob, desk, kb, np, bc, fg,
    dark,
    s0, s1, s2, s3,
    streak, streak,
    both, bcWin, shWin, shLoss,
    b1ft, bothWon
  ).run();
}

// ==================== UPDATE PUZZLE STATS (new primary system) ====================
async function updatePuzzleStats(db, puzzleNum, country, body) {
  const won = body.w || 0;
  const guesses = body.g || 0;
  const time = body.t || 0;
  const d1 = won && guesses === 1 ? 1 : 0;
  const d2 = won && guesses === 2 ? 1 : 0;
  const d3 = won && guesses === 3 ? 1 : 0;
  const d4 = won && guesses === 4 ? 1 : 0;
  const d5 = won && guesses === 5 ? 1 : 0;
  const d6 = won && guesses === 6 ? 1 : 0;
  const b1p = bonusPlayed(body.b1);
  const b1w = bonusWon(body.b1);
  const b2p = bonusPlayed(body.b2);
  const b2w = bonusWon(body.b2);
  const shared = body.sh || 0;
  const mob = body.mb ? 1 : 0;
  const desk = body.mb ? 0 : 1;
  const kb = body.im === 'keyboard' || body.im === 'both' ? 1 : 0;
  const np = body.im === 'numpad' || body.im === 'both' ? 1 : 0;
  const bc = body.bc || 0;
  const fg = body.fg || 0;
  const dark = body.dk ? 1 : 0;
  const sc = Math.min(Math.max(body.sc || 0, 0), 3);
  const s0 = sc === 0 ? 1 : 0;
  const s1 = sc === 1 ? 1 : 0;
  const s2 = sc === 2 ? 1 : 0;
  const s3 = sc === 3 ? 1 : 0;
  const streak = body.sk || 0;
  const both = body.im === 'both' ? 1 : 0;
  const bcWin = bc && won ? 1 : 0;
  const shWin = shared && won ? 1 : 0;
  const shLoss = shared && !won ? 1 : 0;
  const b1ft = body.b1 === 'win-1' ? 1 : 0;
  const bothWon = b1w && b2w ? 1 : 0;

  await db.prepare(`
    INSERT INTO puzzle_stats (puzzle_num, country, total_players, total_wins, total_guesses, total_time,
      dist_1, dist_2, dist_3, dist_4, dist_5, dist_6,
      b1_played, b1_won, b2_played, b2_won, shared_count,
      mobile_count, desktop_count, keyboard_count, numpad_count,
      bc_used_count, first_guess_sum,
      dark_count, scheme_0, scheme_1, scheme_2, scheme_3,
      streak_sum, streak_max, both_count, bc_win_count, shared_win_count, shared_loss_count,
      b1_first_try, both_won)
    VALUES (?, ?, 1, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?)
    ON CONFLICT(puzzle_num, country) DO UPDATE SET
      total_players = total_players + 1,
      total_wins = total_wins + ?,
      total_guesses = total_guesses + ?,
      total_time = total_time + ?,
      dist_1 = dist_1 + ?, dist_2 = dist_2 + ?, dist_3 = dist_3 + ?,
      dist_4 = dist_4 + ?, dist_5 = dist_5 + ?, dist_6 = dist_6 + ?,
      b1_played = b1_played + ?, b1_won = b1_won + ?,
      b2_played = b2_played + ?, b2_won = b2_won + ?,
      shared_count = shared_count + ?,
      mobile_count = mobile_count + ?, desktop_count = desktop_count + ?,
      keyboard_count = keyboard_count + ?, numpad_count = numpad_count + ?,
      bc_used_count = bc_used_count + ?, first_guess_sum = first_guess_sum + ?,
      dark_count = dark_count + ?,
      scheme_0 = scheme_0 + ?, scheme_1 = scheme_1 + ?, scheme_2 = scheme_2 + ?, scheme_3 = scheme_3 + ?,
      streak_sum = streak_sum + ?,
      streak_max = MAX(streak_max, ?),
      both_count = both_count + ?,
      bc_win_count = bc_win_count + ?,
      shared_win_count = shared_win_count + ?,
      shared_loss_count = shared_loss_count + ?,
      b1_first_try = b1_first_try + ?,
      both_won = both_won + ?,
      updated_at = datetime('now')
  `).bind(
    puzzleNum, country,
    won, guesses, time,
    d1, d2, d3, d4, d5, d6,
    b1p, b1w, b2p, b2w, shared,
    mob, desk, kb, np, bc, fg,
    dark, s0, s1, s2, s3,
    streak, streak, both, bcWin, shWin, shLoss,
    b1ft, bothWon,
    // UPDATE values
    won, guesses, time,
    d1, d2, d3, d4, d5, d6,
    b1p, b1w, b2p, b2w, shared,
    mob, desk, kb, np, bc, fg,
    dark,
    s0, s1, s2, s3,
    streak, streak,
    both, bcWin, shWin, shLoss,
    b1ft, bothWon
  ).run();
}

// ==================== GET TODAY'S STATS ====================
async function handleToday(env, cors, puzzleParam, range, country) {
  // Use client's puzzle_num if provided, otherwise fall back to server's puzzle number.
  const puzzleNum = puzzleParam ? parseInt(puzzleParam) : getPSTPuzzleNum();

  // Range mode: when ?range= is given (1D/1W/1M/...), every column is aggregated across
  // the puzzle range. The SUM aliases keep the column names the rest of this function reads.
  const useRange = !!range;
  const [fromPuzzle, toPuzzle] = useRange
    ? getPuzzleRange(range, getPSTPuzzleNum())
    : [puzzleNum, puzzleNum];
  // 'ALL' is the pre-aggregated every-country row; a real code narrows to that country.
  const scope = country || 'ALL';
  // Shared WHERE for the game_results detail queries (single puzzle vs. a span).
  const grCountry = country ? ' AND country = ?' : '';
  const grWhere = (useRange ? 'puzzle_num >= ? AND puzzle_num <= ?' : 'puzzle_num = ?') + grCountry;
  const grParams = (useRange ? [fromPuzzle, toPuzzle] : [puzzleNum]).concat(country ? [country] : []);

  let global;
  if (useRange) {
    global = await env.DB.prepare(`
      SELECT
        SUM(total_players) AS total_players, SUM(total_wins) AS total_wins,
        SUM(total_guesses) AS total_guesses, SUM(total_time) AS total_time,
        SUM(dist_1) AS dist_1, SUM(dist_2) AS dist_2, SUM(dist_3) AS dist_3,
        SUM(dist_4) AS dist_4, SUM(dist_5) AS dist_5, SUM(dist_6) AS dist_6,
        SUM(b1_played) AS b1_played, SUM(b1_won) AS b1_won,
        SUM(b2_played) AS b2_played, SUM(b2_won) AS b2_won,
        SUM(shared_count) AS shared_count, SUM(mobile_count) AS mobile_count,
        SUM(desktop_count) AS desktop_count, SUM(keyboard_count) AS keyboard_count,
        SUM(numpad_count) AS numpad_count, SUM(both_count) AS both_count,
        SUM(bc_used_count) AS bc_used_count, SUM(first_guess_sum) AS first_guess_sum,
        SUM(dark_count) AS dark_count,
        SUM(scheme_0) AS scheme_0, SUM(scheme_1) AS scheme_1,
        SUM(scheme_2) AS scheme_2, SUM(scheme_3) AS scheme_3,
        SUM(streak_sum) AS streak_sum, MAX(streak_max) AS streak_max,
        SUM(bc_win_count) AS bc_win_count,
        SUM(shared_win_count) AS shared_win_count, SUM(shared_loss_count) AS shared_loss_count,
        SUM(b1_first_try) AS b1_first_try, SUM(both_won) AS both_won
      FROM puzzle_stats WHERE country = ? AND puzzle_num >= ? AND puzzle_num <= ?
    `).bind(scope, fromPuzzle, toPuzzle).first();
  } else {
    global = await env.DB.prepare(
      'SELECT * FROM puzzle_stats WHERE puzzle_num = ? AND country = ?'
    ).bind(puzzleNum, scope).first();
  }

  if (!global || !global.total_players) {
    // Returns the full shape zeroed: the client guards on `today.bonus` /
    // `today.schemeUsage`, so omitting them would leave the previous range on screen.
    return json({
      players: 0, wins: 0, winRate: 0, avgGuesses: 0, avgTime: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      bonus: { b1Played: 0, b1Won: 0, b2Played: 0, b2Won: 0 },
      shared: 0, mobile: 0, desktop: 0, keyboard: 0, numpad: 0, both: 0, bcUsed: 0,
      avgFirstGuess: 0, dark: 0, light: 0, schemeUsage: [0, 0, 0, 0],
      streakAvg: 0, streakMax: 0, bcWinRate: 0, bcWinDelta: 0,
      sharedWin: 0, sharedLoss: 0, b1FirstTry: 0, bothWon: 0,
      firstGuessPopular: 0, firstGuessBCPct: 0,
      solveTimeMedian: 0, solveTimeFastest: 0, solveTimeSlowest: 0,
      solveTimeByGuess: [0, 0, 0, 0, 0, 0],
      puzzleNum: puzzleNum
    }, 200, cors);
  }

  const p = global.total_players || 1;

  // Query game_results for detailed breakdowns not in puzzle_stats
  let firstGuessPopular = 0, firstGuessBCPct = 0;
  let solveTimeMedian = 0, solveTimeFastest = 0, solveTimeSlowest = 0;
  let solveTimeByGuess = [0, 0, 0, 0, 0, 0];

  try {
    // Most popular first guess year
    const fgPop = await env.DB.prepare(`
      SELECT first_guess, COUNT(*) as cnt FROM game_results
      WHERE ${grWhere} AND first_guess != 0
      GROUP BY first_guess ORDER BY cnt DESC LIMIT 1
    `).bind(...grParams).first();
    if (fgPop) firstGuessPopular = fgPop.first_guess;

    // % who guessed BC (negative year) first
    const fgBC = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM game_results
      WHERE ${grWhere} AND first_guess < 0
    `).bind(...grParams).first();
    if (fgBC) firstGuessBCPct = p > 0 ? Math.round(fgBC.cnt / p * 100) : 0;

    // Solve time stats (only for winners with time > 0)
    const times = await env.DB.prepare(`
      SELECT total_time FROM game_results
      WHERE ${grWhere} AND won = 1 AND total_time > 0
      ORDER BY total_time ASC
    `).bind(...grParams).all();
    if (times.results && times.results.length > 0) {
      const t = times.results;
      solveTimeFastest = t[0].total_time;
      solveTimeSlowest = t[t.length - 1].total_time;
      solveTimeMedian = t[Math.floor(t.length / 2)].total_time;
    }

    // Avg solve time by guess count
    const stByG = await env.DB.prepare(`
      SELECT guesses, ROUND(AVG(total_time)) as avg_t FROM game_results
      WHERE ${grWhere} AND won = 1 AND total_time > 0
      GROUP BY guesses ORDER BY guesses
    `).bind(...grParams).all();
    if (stByG.results) {
      for (const r of stByG.results) {
        if (r.guesses >= 1 && r.guesses <= 6) solveTimeByGuess[r.guesses - 1] = r.avg_t || 0;
      }
    }
  } catch (e) {
    // non-critical: continue with zeros
  }

  // Extended daily_stats fields (default to 0 if columns don't exist yet)
  const darkCount = global.dark_count || 0;
  const lightCount = p - darkCount;
  const bcWins = global.bc_win_count || 0;
  const bcTotal = global.bc_used_count || 0;
  const nonBcWins = (global.total_wins || 0) - bcWins;
  const nonBcTotal = p - bcTotal;
  const bcWinRate = bcTotal > 0 ? Math.round(bcWins / bcTotal * 100) : 0;
  const nonBcWinRate = nonBcTotal > 0 ? Math.round(nonBcWins / nonBcTotal * 100) : 0;

  return json({
    players: global.total_players,
    wins: global.total_wins,
    winRate: Math.round((global.total_wins / p) * 100),
    avgGuesses: +(global.total_guesses / p).toFixed(1),
    avgTime: Math.round(global.total_time / p),
    distribution: {
      1: global.dist_1, 2: global.dist_2, 3: global.dist_3,
      4: global.dist_4, 5: global.dist_5, 6: global.dist_6
    },
    bonus: {
      b1Played: global.b1_played, b1Won: global.b1_won,
      b2Played: global.b2_played, b2Won: global.b2_won
    },
    shared: global.shared_count,
    mobile: global.mobile_count,
    desktop: global.desktop_count,
    keyboard: global.keyboard_count,
    numpad: global.numpad_count,
    both: global.both_count || 0,
    bcUsed: global.bc_used_count,
    avgFirstGuess: p > 0 ? Math.round(global.first_guess_sum / p) : 0, // first_guess is signed (BC negative), so guard on player count, not sum sign
    // Extended stats
    dark: darkCount,
    light: lightCount,
    schemeUsage: [global.scheme_0 || 0, global.scheme_1 || 0, global.scheme_2 || 0, global.scheme_3 || 0],
    streakAvg: p > 0 ? +((global.streak_sum || 0) / p).toFixed(1) : 0,
    streakMax: global.streak_max || 0,
    bcWinRate: bcWinRate,
    bcWinDelta: bcWinRate - nonBcWinRate,
    sharedWin: global.shared_win_count || 0,
    sharedLoss: global.shared_loss_count || 0,
    b1FirstTry: global.b1_first_try || 0,
    bothWon: global.both_won || 0,
    // From game_results queries
    firstGuessPopular: firstGuessPopular,
    firstGuessBCPct: firstGuessBCPct,
    solveTimeMedian: solveTimeMedian,
    solveTimeFastest: solveTimeFastest,
    solveTimeSlowest: solveTimeSlowest,
    solveTimeByGuess: solveTimeByGuess,
    puzzleNum: puzzleNum
  }, 200, cors);
}

// ==================== GET PUZZLE STATS ====================
async function handlePuzzle(env, cors, num) {
  if (!num) return json({ error: 'Missing puzzle number' }, 400, cors);

  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as players,
      SUM(won) as wins,
      ROUND(AVG(guesses), 1) as avg_guesses,
      ROUND(AVG(total_time)) as avg_time,
      SUM(CASE WHEN won=1 AND guesses=1 THEN 1 ELSE 0 END) as dist_1,
      SUM(CASE WHEN won=1 AND guesses=2 THEN 1 ELSE 0 END) as dist_2,
      SUM(CASE WHEN won=1 AND guesses=3 THEN 1 ELSE 0 END) as dist_3,
      SUM(CASE WHEN won=1 AND guesses=4 THEN 1 ELSE 0 END) as dist_4,
      SUM(CASE WHEN won=1 AND guesses=5 THEN 1 ELSE 0 END) as dist_5,
      SUM(CASE WHEN won=1 AND guesses=6 THEN 1 ELSE 0 END) as dist_6
    FROM game_results WHERE puzzle_num = ?
  `).bind(parseInt(num)).first();

  return json(stats || {}, 200, cors);
}

// ==================== GET COUNTRY LEADERBOARD ====================
async function handleCountries(env, cors, range) {
  const currentPuzzle = getPSTPuzzleNum();
  const [fromPuzzle, toPuzzle] = getPuzzleRange(range, currentPuzzle);

  const rows = await env.DB.prepare(`
    SELECT
      country,
      SUM(total_players) as players,
      SUM(total_wins) as wins,
      ROUND(CAST(SUM(total_wins) AS REAL) / MAX(SUM(total_players), 1) * 100) as win_rate,
      ROUND(CAST(SUM(total_guesses) AS REAL) / MAX(SUM(total_players), 1), 1) as avg_guesses,
      ROUND(CAST(SUM(total_time) AS REAL) / MAX(SUM(total_players), 1)) as avg_time
    FROM puzzle_stats
    WHERE country != 'ALL' AND puzzle_num >= ? AND puzzle_num <= ?
    GROUP BY country
    ORDER BY players DESC
    LIMIT 50
  `).bind(fromPuzzle, toPuzzle).all();

  return json(rows.results || [], 200, cors);
}

// ==================== GET HARDEST PUZZLES ====================
async function handleHardest(env, cors, range, country) {
  const currentPuzzle = getPSTPuzzleNum();
  // Range-aware: "hardest puzzles" within the selected window (defaults to last 30 if absent).
  const [fromPuzzle, toPuzzle] = range
    ? getPuzzleRange(range, currentPuzzle)
    : [currentPuzzle - 29, currentPuzzle];
  // A single country has far fewer players per puzzle than the world, so the
  // minimum-players-to-rank floor scales with the scope.
  const scope = country || 'ALL';
  const minPlayers = country ? 3 : 10;
  const rows = await env.DB.prepare(`
    SELECT
      puzzle_num,
      total_players as players,
      ROUND(CAST(total_guesses AS REAL) / MAX(total_players, 1), 1) as avg_guesses,
      ROUND(CAST(total_wins AS REAL) / MAX(total_players, 1) * 100) as win_rate
    FROM puzzle_stats
    WHERE country = ? AND puzzle_num >= ? AND puzzle_num <= ?
      AND total_players >= ?
    ORDER BY avg_guesses DESC
    LIMIT 20
  `).bind(scope, fromPuzzle, toPuzzle, minPlayers).all();

  return json(rows.results || [], 200, cors);
}

// ==================== GET GUESS DISTRIBUTION ====================
async function handleDistribution(env, cors, range, country) {
  const currentPuzzle = getPSTPuzzleNum();
  const [fromPuzzle, toPuzzle] = getPuzzleRange(range, currentPuzzle);

  let query = `
    SELECT
      SUM(dist_1) as d1, SUM(dist_2) as d2, SUM(dist_3) as d3,
      SUM(dist_4) as d4, SUM(dist_5) as d5, SUM(dist_6) as d6,
      SUM(total_players) as total,
      SUM(total_wins) as wins
    FROM puzzle_stats
    WHERE puzzle_num >= ? AND puzzle_num <= ?
  `;
  const params = [fromPuzzle, toPuzzle];

  if (country) {
    query += ' AND country = ?';
    params.push(country);
  } else {
    query += ' AND country = ?';
    params.push('ALL');
  }

  const stmt = env.DB.prepare(query);
  const row = await stmt.bind(...params).first();

  return json({
    d1: row?.d1 || 0,
    d2: row?.d2 || 0,
    d3: row?.d3 || 0,
    d4: row?.d4 || 0,
    d5: row?.d5 || 0,
    d6: row?.d6 || 0,
    total: row?.total || 0,
    wins: row?.wins || 0
  }, 200, cors);
}

// ==================== GET DAILY TRENDS ====================
async function handleTrends(env, cors, days, range, country) {
  const currentPuzzle = getPSTPuzzleNum();
  // ?range= wins when present so the series covers exactly the selected window;
  // 'ALL' means every puzzle that has data, not a fixed lookback.
  let fromPuzzle, toPuzzle;
  if (range) {
    [fromPuzzle, toPuzzle] = getPuzzleRange(range, currentPuzzle);
  } else {
    fromPuzzle = currentPuzzle - (Math.min(days, 365) - 1); // inclusive endpoints → exactly `days` puzzles
    toPuzzle = currentPuzzle;
  }
  const scope = country || 'ALL';

  // Every per-day series the detail charts draw comes from this one query, so a range
  // change moves them all together. The series length is capped by keeping the newest
  // rows (inner DESC + LIMIT), then flipping back to chronological order for the chart.
  const rows = await env.DB.prepare(`
    SELECT * FROM (
      SELECT
        puzzle_num,
        total_players as players,
        total_wins as wins,
        ROUND(CAST(total_wins AS REAL) / MAX(total_players, 1) * 100) as win_rate,
        ROUND(CAST(shared_count AS REAL) / MAX(total_players, 1) * 100) as share_rate,
        ROUND(CAST(bc_used_count AS REAL) / MAX(total_players, 1) * 100) as bc_rate,
        ROUND(CAST(total_time AS REAL) / MAX(total_players, 1)) as avg_time,
        ROUND(CAST(total_guesses AS REAL) / MAX(total_players, 1), 1) as avg_guesses,
        scheme_0, scheme_1, scheme_2, scheme_3
      FROM puzzle_stats
      WHERE country = ? AND puzzle_num >= ? AND puzzle_num <= ?
      ORDER BY puzzle_num DESC
      LIMIT 400
    ) ORDER BY puzzle_num ASC
  `).bind(scope, fromPuzzle, toPuzzle).all();

  return json(rows.results || [], 200, cors);
}

// ==================== DETAIL BREAKDOWNS ====================
// Row-level rollups that puzzle_stats cannot answer (it stores sums, not distributions).
// One request backs the Streaks, First Guess, Play Times, Share Rate and BC detail pages.
async function handleBreakdown(env, cors, range, country) {
  const currentPuzzle = getPSTPuzzleNum();
  const [fromPuzzle, toPuzzle] = getPuzzleRange(range, currentPuzzle);
  const cWhere = country ? ' AND country = ?' : '';
  const where = 'puzzle_num >= ? AND puzzle_num <= ?' + cWhere;
  const params = country ? [fromPuzzle, toPuzzle, country] : [fromPuzzle, toPuzzle];
  // select goes before FROM, tail (extra WHERE / GROUP BY / ORDER BY) goes after the WHERE.
  const q = (select, tail) =>
    env.DB.prepare(`SELECT ${select} FROM game_results WHERE ${where} ${tail || ''}`).bind(...params).all();

  const empty = {
    players: 0, streaks: [], streakMax: 0, streakAvg: 0,
    firstGuess: [], firstGuessBuckets: FG_BUCKET_LABELS,
    hours: [], shareByGuess: [0, 0, 0, 0, 0, 0], shareByGuessN: [0, 0, 0, 0, 0, 0],
    bcByDifficulty: [], bcFirstGuessPct: 0, solveTimeByCountry: [],
    unfinished: { starts: 0, finished: 0, unfinished: 0, unfinishedRate: 0, daily: [] }
  };

  try {
    const [total, streakRows, fgRows, hourRows, shareRows, bcFirst, timeByCountry] = await Promise.all([
      q('COUNT(*) as n, MAX(streak) as mx, AVG(streak) as av'),
      // Streak buckets: 1, 2, 3-4, 5-6, 7-13, 14-29, 30+ (streak recorded at submit time)
      q(`CASE
           WHEN streak <= 0 THEN 'none' WHEN streak = 1 THEN '1' WHEN streak = 2 THEN '2'
           WHEN streak <= 4 THEN '3-4' WHEN streak <= 6 THEN '5-6' WHEN streak <= 13 THEN '7-13'
           WHEN streak <= 29 THEN '14-29' ELSE '30+' END as bucket, COUNT(*) as n`,
        'GROUP BY bucket'),
      // first guess by era bucket
      q(`CASE
           WHEN first_guess < 0 THEN 'BC' WHEN first_guess < 500 THEN '0-4'
           WHEN first_guess < 1000 THEN '5-9' WHEN first_guess < 1500 THEN '10-14'
           WHEN first_guess < 1700 THEN '15-16' WHEN first_guess < 1800 THEN '17'
           WHEN first_guess < 1900 THEN '18' WHEN first_guess < 2000 THEN '19'
           ELSE '20' END as bucket, COUNT(*) as n`,
        'AND first_guess != 0 GROUP BY bucket'),
      q('hour_utc, COUNT(*) as n', 'GROUP BY hour_utc ORDER BY hour_utc'),
      q('guesses, COUNT(*) as n, SUM(shared) as shared', 'GROUP BY guesses'),
      q('COUNT(*) as n', 'AND first_guess < 0'),
      q('country, COUNT(*) as n, ROUND(AVG(total_time)) as avg_t',
        'AND won = 1 AND total_time > 0 GROUP BY country ORDER BY n DESC LIMIT 15')
    ]);

    const t = (total.results && total.results[0]) || { n: 0, mx: 0, av: 0 };
    const players = t.n || 0;

    const streaks = (streakRows.results || [])
      .filter(r => r.bucket !== 'none')
      .map(r => ({ bucket: r.bucket, count: r.n }))
      .sort((a, b) => STREAK_BUCKET_ORDER.indexOf(a.bucket) - STREAK_BUCKET_ORDER.indexOf(b.bucket));

    const fgMap = {};
    for (const r of (fgRows.results || [])) fgMap[r.bucket] = r.n;
    const firstGuess = FG_BUCKET_LABELS.map(b => ({ bucket: b, count: fgMap[b] || 0 }));

    // share rate per guess count, plus the sample size behind each
    const shareByGuess = [0, 0, 0, 0, 0, 0], shareByGuessN = [0, 0, 0, 0, 0, 0];
    for (const r of (shareRows.results || [])) {
      const g = r.guesses;
      if (g >= 1 && g <= 6) {
        shareByGuessN[g - 1] = r.n || 0;
        shareByGuess[g - 1] = r.n > 0 ? Math.round((r.shared || 0) / r.n * 100) : 0;
      }
    }

    // BC usage split by puzzle difficulty (quintiles of avg guesses across the window)
    const bcByDifficulty = await bcQuintiles(env.DB, fromPuzzle, toPuzzle, country);
    const unfinished = await getUnfinished(env.DB, fromPuzzle, toPuzzle, country);

    return json({
      players: players,
      streaks: streaks,
      streakMax: t.mx || 0,
      streakAvg: players > 0 ? +(t.av || 0).toFixed(1) : 0,
      firstGuess: firstGuess,
      firstGuessBuckets: FG_BUCKET_LABELS,
      hours: (hourRows.results || []).map(r => ({ hour_utc: r.hour_utc, count: r.n })),
      shareByGuess: shareByGuess,
      shareByGuessN: shareByGuessN,
      bcByDifficulty: bcByDifficulty,
      bcFirstGuessPct: players > 0 ? Math.round(((bcFirst.results && bcFirst.results[0] && bcFirst.results[0].n) || 0) / players * 100) : 0,
      solveTimeByCountry: (timeByCountry.results || []).map(r => ({ country: r.country, players: r.n, avgTime: r.avg_t || 0 })),
      unfinished: unfinished
    }, 200, cors);
  } catch (e) {
    return json(Object.assign({ error: e.message }, empty), 200, cors);
  }
}

const FG_BUCKET_LABELS = ['BC', '0-4', '5-9', '10-14', '15-16', '17', '18', '19', '20'];
const STREAK_BUCKET_ORDER = ['1', '2', '3-4', '5-6', '7-13', '14-29', '30+'];

// Splits the window's puzzles into difficulty quintiles by avg guesses, then reports
// the share of players in each quintile that guessed a BC year.
async function bcQuintiles(db, fromPuzzle, toPuzzle, country) {
  const scope = country || 'ALL';
  const rows = await db.prepare(`
    SELECT puzzle_num,
           CAST(total_guesses AS REAL) / MAX(total_players, 1) as avg_g,
           total_players, bc_used_count
    FROM puzzle_stats
    WHERE country = ? AND puzzle_num >= ? AND puzzle_num <= ? AND total_players > 0
    ORDER BY avg_g DESC
  `).bind(scope, fromPuzzle, toPuzzle).all();

  const list = rows.results || [];
  if (list.length < 5) return []; // fewer than 5 puzzles cannot form quintiles

  const size = list.length / 5;
  const out = [];
  for (let i = 0; i < 5; i++) {
    const slice = list.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    const players = slice.reduce((a, r) => a + (r.total_players || 0), 0);
    const bc = slice.reduce((a, r) => a + (r.bc_used_count || 0), 0);
    out.push({ players: players, pct: players > 0 ? Math.round(bc / players * 100) : 0, puzzles: slice.length });
  }
  return out;
}

// ==================== LIVE COUNTER ====================
async function handleLive(env, cors) {
  // Live counter uses PST puzzle for "today's" count
  const currentPuzzle = getPSTPuzzleNum();

  const row = await env.DB.prepare(
    'SELECT total_players FROM puzzle_stats WHERE puzzle_num = ? AND country = ?'
  ).bind(currentPuzzle, 'ALL').first();

  // Per-hour breakdown for current puzzle
  const hours = await env.DB.prepare(`
    SELECT hour_utc, COUNT(*) as count
    FROM game_results
    WHERE puzzle_num = ?
    GROUP BY hour_utc
    ORDER BY hour_utc
  `).bind(currentPuzzle).all();

  return json({
    players: row ? row.total_players : 0,
    hours: hours.results || [],
    puzzleNum: currentPuzzle,
    timestamp: new Date().toISOString()
  }, 200, cors);
}

// ==================== DAILY PUZZLE ====================
// The invention list and shuffle seed live here and are never sent to the client as a
// whole. Only today's and adjacent days' puzzles are served.

// deterministic permutation of the invention list
function serverShuffle(arr) {
  // REDACTED IN THE PUBLIC COPY.
  //
  // Production uses a seeded Fisher-Yates shuffle to decide which invention
  // appears on which day. Publishing the seed would reveal every future answer,
  // so this returns the identity permutation instead: day N simply gets entry N.
  // Substitute your own seeded shuffle here — it must be deterministic, since
  // /api/puzzle and /api/guess both call it and have to agree.
  return arr.map((_, i) => i);
}

function getDayNum(dateStr) {
  // days since Jan 1, 2025; must match the client logic
  const d = new Date(dateStr + 'T00:00:00Z');
  const epoch = new Date('2025-01-01T00:00:00Z');
  return Math.floor((d - epoch) / 864e5);
}

async function handleDailyPuzzle(env, cors, clientDate) {
  // Validate client date is within ±1 day of server UTC
  const serverDate = new Date().toISOString().split('T')[0];
  const serverDay = getDayNum(serverDate);

  let requestedDate = clientDate;
  if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    requestedDate = serverDate;
  }

  const requestedDay = getDayNum(requestedDate);

  // Allow yesterday, today, tomorrow (covers all timezones: UTC-12 to UTC+14)
  if (Math.abs(requestedDay - serverDay) > 1) {
    return json({ error: 'Date out of range' }, 400, cors);
  }

  // loads inventions from the INVENTIONS_KV binding, falling back to the
  // INVENTIONS_JSON env var
  let inventions;
  try {
    let raw = null;
    if (env.INVENTIONS_KV) raw = await env.INVENTIONS_KV.get('inventions');
    if (!raw && env.INVENTIONS_JSON) raw = env.INVENTIONS_JSON;
    inventions = JSON.parse(raw || '[]');
  } catch {
    return json({ error: 'Invention data not configured' }, 500, cors);
  }

  if (inventions.length === 0) {
    return json({ error: 'No inventions loaded' }, 500, cors);
  }

  // Get the permutation and pick today's invention
  const perm = serverShuffle(inventions);
  const n = inventions.length;
  const idx = perm[((requestedDay % n) + n) % n];
  const invention = inventions[idx];

  // returns only what the client needs; the year is never sent until game over
  const puzzleNum = requestedDay + 1;
  return json({
    name: invention.name,
    country: invention.country,
    inventor: invention.inventor,
    category: invention.category,
    description: invention.description || '',
    puzzleNum: puzzleNum,
    date: requestedDate
  }, 200, cors);
}

// ==================== GUESS CHECKING ====================
// Year ranges for inventions with disputed/uncertain dates (name → [min, max])
const YEAR_RANGES = {
  "Fish Farming": [-8000, -2000],
  "Battering Ram": [-2500, -900],
  "Prosthetic Limb": [-1500, -710],
  "Crossbow": [-700, -600],
  "Crane": [-700, -515],
  "Gunpowder": [808, 850],
  "Hand Grenade": [1000, 1044],
  "Printing Press": [1440, 1455],
  "Microscope": [1590, 1600],
  "35mm Film Camera": [1913, 1925],
  "Pencil": [1564, 1565],
  "Safety Matches": [1844, 1853],
  "Hovercraft": [1955, 1959],
  "Taser": [1969, 1974],
  "Desk Lamp": [1932, 1934],
  "Tape Recorder": [1928, 1935],
  "Mouse": [1964, 1968],
  "Video Game Console": [1966, 1972],
  "Diesel Engine": [1893, 1897],
  "Photo Booth": [1925, 1926],
  "Grain Elevator": [1842, 1843],
  "VHS Videocassette": [1971, 1976],
  "Food Processor": [1963, 1971],
  "Carbon Fiber": [1958, 1964],
  "Polyethylene": [1933, 1939],
  "Stapler": [1866, 1879],
  "Electric Razor": [1928, 1931],
  "Floppy Disk": [1967, 1971],
  "Holography": [1947, 1948],
  "Synthetic Fertilizer": [1909, 1913],
  "Velcro": [1941, 1955],
  "Post-It Note": [1968, 1980],
  "Zipper": [1893, 1917],
  "Photocopier": [1938, 1959],
  "Laser Eye Surgery": [1981, 1987],
  "mRNA Vaccine": [2005, 2020],
  "3D-Printed Prosthetics": [2008, 2012],
  "Apple Watch": [2014, 2015],
  "Oculus VR Headset": [2012, 2013],
  "Raspberry Pi": [2011, 2012],
  "Fitness Tracker": [2008, 2009],
  "PlayStation": [1991, 1994],
  "Xbox": [2000, 2001],
  "DVD": [1995, 1996],
  "Android OS": [2007, 2008],
  "Windows OS": [1983, 1985],
  "Spotify": [2006, 2008],
  "Google Search": [1996, 1998],
  "PayPal": [1998, 1999],
  "Segway": [2001, 2002],
  "Polaroid Camera": [1947, 1948],
  "Electric Cigarette": [2003, 2004],
  "Noise-Canceling Headphones": [1986, 1989],
  "Super Soaker": [1989, 1990],
  "Smartwatch": [2012, 2013],
  "Microphone": [1876, 1877],
  "Speedboat": [1902, 1903],
  "Computer": [1945, 1946],
  "RAM Memory": [1947, 1948],
  "Particle Accelerator": [1930, 1931],
  "I-Beam": [1849, 1850],
  "Three Ring Binder": [1886, 1887],
  "Stent": [1986, 1987],
  "Monopoly": [1935, 1936],
  "Minecraft": [2010, 2011],
  "Suspension Bridge": [1779, 1826],
  "Superglue": [1942, 1951],
  "Ice Cream Cone": [1896, 1904],
  "Window Blinds": [1764, 1769],
  "Toaster": [1893, 1909],
  "Paper Napkin": [1887, 1930],
  "Pepsi-Cola": [1893, 1898],
  "Drone (Military UAV)": [1994, 2001],
  "Trolleybus": [1882, 1901],
  "Electric Oven": [1896, 1897],
  "Night Vision Goggles": [1939, 1960],
  "Jackhammer": [1849, 1894],
  "Fluoride Toothpaste": [1914, 1955],
  "Cruise Missile": [1944, 1957],
  "Center Pivot Irrigation": [1947, 1952],
  "Corrugated Cardboard": [1856, 1871],
  "Answering Machine": [1935, 1949]
};

function getDigitColors(guessYear, targetYear) {
  const gBC = guessYear < 0;
  const tBC = targetYear < 0;
  if (gBC !== tBC) return ['grey', 'grey', 'grey', 'grey'];
  const gd = String(Math.abs(guessYear)).padStart(4, '0').split('').map(Number);
  const td = String(Math.abs(targetYear)).padStart(4, '0').split('').map(Number);
  return gd.map((v, i) => {
    const df = Math.abs(v - td[i]);
    return df === 0 ? 'green' : df === 1 ? 'yellow' : 'grey';
  });
}

async function handleGuess(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }

  const { puzzleNum, guess } = body;
  if (typeof puzzleNum !== 'number' || typeof guess !== 'number') {
    return json({ error: 'Missing puzzleNum or guess' }, 400, cors);
  }
  if (guess === 0) {
    return json({ error: 'Year 0 does not exist' }, 400, cors);
  }
  if (guess > 2026 || guess < -9999) {
    return json({ error: 'Year out of range' }, 400, cors);
  }

  // validate puzzle number: PST +/- 2 (same tolerance as stats submission)
  const pstPuzzle = getPSTPuzzleNum();
  if (puzzleNum < pstPuzzle - 2 || puzzleNum > pstPuzzle + 2) {
    return json({ error: 'Puzzle number out of range' }, 400, cors);
  }

  // Load inventions
  let inventions;
  try {
    let raw = null;
    if (env.INVENTIONS_KV) raw = await env.INVENTIONS_KV.get('inventions');
    if (!raw && env.INVENTIONS_JSON) raw = env.INVENTIONS_JSON;
    inventions = JSON.parse(raw || '[]');
  } catch {
    return json({ error: 'Invention data not configured' }, 500, cors);
  }

  if (inventions.length === 0) {
    return json({ error: 'No inventions loaded' }, 500, cors);
  }

  // Resolve the invention for this puzzle number
  const perm = serverShuffle(inventions);
  const n = inventions.length;
  const dayNum = puzzleNum - 1;
  const idx = perm[((dayNum % n) + n) % n];
  const invention = inventions[idx];
  const targetYear = invention.year;

  // Check for exact match
  const isExact = guess === targetYear;

  // Check for range match (disputed/uncertain dates)
  const range = YEAR_RANGES[invention.name];
  const isRange = !isExact && range && guess >= range[0] && guess <= range[1];

  const isCorrect = isExact || isRange;

  // Compute per-digit colors (for tile feedback)
  const colors = isRange
    ? ['green', 'green', 'green', 'green']
    : getDigitColors(guess, targetYear);

  const eraCorrect = isRange ? true : (guess < 0) === (targetYear < 0);

  const result = {
    correct: isCorrect,
    colors: colors,
    eraCorrect: eraCorrect
  };

  // only reveals the year when the game is over (correct guess or gameOver flag)
  if (isCorrect || body.gameOver) {
    result.year = targetYear;
  }

  return json(result, 200, cors);
}

// ==================== HELPERS ====================
function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors
    }
  });
}

async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
