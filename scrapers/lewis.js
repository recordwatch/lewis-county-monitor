import fs from 'fs';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://jail.lewiscountywa.gov';
export const ROSTER_URL = `${BASE_URL}/roster.html`;
export const RELEASES_URL = `${BASE_URL}/releases.html`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

// Per-request cap. A stalled connection would otherwise hang the Actions job.
const REQUEST_TIMEOUT_MS = 30_000;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper. Backoff: 2s, 5s, 10s.
async function getWithRetry(url, attempts = 3) {
  const backoff = [2000, 5000, 10000];
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        console.error(`  Request failed (attempt ${i + 1}/${attempts}): ${err.message} — retrying in ${backoff[i] / 1000}s`);
        await delay(backoff[i]);
      }
    }
  }
  throw lastErr;
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// "$2,500" -> 2500. Blank or $0 -> null.
function parseDollars(text) {
  const m = (text || '').match(/\$\s*([\d,]+\.?\d*)/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ''));
  return v > 0 ? v : null;
}

// Lewis prints Pacific local time as "19:01:00 10/09/2026". Store it as
// "2026-10-09T19:01:00" so it sorts as a string and browsers parse it.
function toLocalIso(text) {
  const m = clean(text).match(/^(\d{2}):(\d{2}):(\d{2}) (\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return clean(text) || null;
  const [, hh, mi, ss, mo, dd, yyyy] = m;
  return `${yyyy}-${mo}-${dd}T${hh}:${mi}:${ss}`;
}

// The roster's "Number" is a per-person inmate number that is reused across
// bookings, so a booking is identified by inmate number + booking time.
export function bookingId(inmateNumber, bookedAt) {
  return `${inmateNumber}-${(bookedAt || '').replace(/\D/g, '')}`;
}

// Each inmate is a <tr class="name"> row followed by a hidden row holding a
// charges sub-table. Everything is on one page.
export function parseRoster(html) {
  const $ = cheerio.load(html);
  const inmates = [];

  $('#main-table > tbody > tr.name').each((_, row) => {
    const cells = $(row).children('td');
    const name = clean($(cells[0]).text());
    const inmateNumber = clean($(cells[1]).text());
    const bookedAt = toLocalIso($(cells[2]).text());
    if (!inmateNumber || !name) return;

    const charges = [];
    $(row).next('tr').find('table.sub-table tbody tr').each((_, tr) => {
      // toArray() rather than .map().get(): cheerio's map drops null results,
      // which would shift every column after an empty cell.
      const tds = $(tr).find('td').toArray().map(td => clean($(td).text()) || null);
      if (!tds[7]) return;
      charges.push({
        description:     tds[7],
        arrestDate:      toLocalIso(tds[0]),
        arrestingAgency: tds[1],
        court:           tds[2],
        billingAgency:   tds[3],
        bondType:        tds[4],
        bondAmount:      parseDollars(tds[5]),
        warrantNumber:   tds[6]
      });
    });

    const bondTotal = charges.reduce((sum, c) => sum + (c.bondAmount || 0), 0);

    inmates.push({
      id: bookingId(inmateNumber, bookedAt),
      inmateNumber,
      name,
      bookedAt,
      // No booking-level agency on this site; the first charge's is the arrest.
      arrestingAgency: charges[0]?.arrestingAgency || null,
      bondTotal: bondTotal > 0 ? bondTotal : null,
      charges
    });
  });

  return inmates;
}

// "Completed Releases" lists recent releases with the real release time and
// destination, but no inmate number — callers must match on name.
export function parseReleases(html) {
  const $ = cheerio.load(html);
  const releases = [];
  $('tr.name').each((_, row) => {
    const tds = $(row).children('td').toArray().map(td => clean($(td).text()));
    if (!tds[0]) return;
    releases.push({ name: tds[0], releasedAt: toLocalIso(tds[1]), releasedTo: tds[2] || null });
  });
  return releases;
}

// Set ROSTER_HTML_FILE / RELEASES_HTML_FILE to parse saved copies instead of
// fetching (handy for testing offline).
async function load(url, fileEnv) {
  return process.env[fileEnv] ? fs.readFileSync(process.env[fileEnv], 'utf-8') : getWithRetry(url);
}

export async function fetchRoster() {
  return parseRoster(await load(ROSTER_URL, 'ROSTER_HTML_FILE'));
}

// Non-fatal: a failed releases fetch just means release times fall back to
// "when we noticed", so return [] instead of throwing.
export async function fetchRecentReleases() {
  try {
    return parseReleases(await load(RELEASES_URL, 'RELEASES_HTML_FILE'));
  } catch (err) {
    console.error('Releases fetch failed:', err.message);
    return [];
  }
}
