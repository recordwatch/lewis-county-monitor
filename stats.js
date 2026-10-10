// Precomputed stats for the static frontend. Lewis's roster has no
// demographics or housing location, so stats focus on charges, agencies,
// courts, bond, where people are released to, and length of stay.

// Only codes whose meaning is clear are named; anything else shows as-is.
export const AGENCY_NAMES = {
  LCSO: "Lewis County Sheriff's Office",
  CENT: 'Centralia Police',
  CHEH: 'Chehalis Police',
  WASH: 'Washington State Patrol',
  WINL: 'Winlock Police',
  NAPA: 'Napavine Police',
  MORT: 'Morton Police',
  TCSO: "Thurston County Sheriff's Office",
  JAIL: 'Lewis County Jail',
  DOC:  'Dept. of Corrections'
};

export const COURT_NAMES = {
  SUP: 'Lewis County Superior Court',
  LCD: 'Lewis County District Court',
  CNM: 'Centralia Municipal Court',
  CSM: 'Chehalis Municipal Court',
  WLM: 'Winlock Municipal Court',
  NMC: 'Napavine Municipal Court',
  DOC: 'Dept. of Corrections'
};

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function round1(n) {
  return n == null ? null : Math.round(n * 10) / 10;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const k = keyFn(item);
    if (k) counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

function topN(counts, n) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count, pct: total ? round1((count / total) * 100) : 0 }));
}

function daysBetween(start, end) {
  const ms = new Date(end) - new Date(start);
  return ms > 0 ? ms / 86_400_000 : null;
}

// "2026-10-10T04:26:29" -> "2026-10-10"
function day(ts) {
  return ts ? ts.slice(0, 10) : null;
}

export function buildStats(log, now) {
  const inCustody = log.filter(e => e.status === 'in_custody');
  const released  = log.filter(e => e.status === 'released');
  // Bookings we actually watched happen (not already in jail on day one).
  const observed  = log.filter(e => !e.baseline);
  const allCharges = log.flatMap(e => e.charges || []);

  // Bookings per day, last 30 days, keyed by the jail's own booking time.
  // Only includes people still booked or seen released, so days before
  // monitoring started undercount anyone released before we were watching.
  const today = new Date(now.slice(0, 10) + 'T12:00:00');
  const bookingsByDay = [];
  const perDay = countBy(log, e => day(e.bookedAt));
  const releasesPerDay = countBy(released, e => day(e.releasedAt));
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    bookingsByDay.push({ date: key, booked: perDay[key] || 0, released: releasesPerDay[key] || 0 });
  }

  // Length of stay for releases, measured from the jail's booking time.
  const stays = released.map(e => daysBetween(e.bookedAt, e.releasedAt)).filter(v => v != null);
  const stayBuckets = [
    ['< 1 day', 0, 1], ['1–3 days', 1, 3], ['3–7 days', 3, 7],
    ['1–4 weeks', 7, 28], ['1–3 months', 28, 90], ['3+ months', 90, Infinity]
  ].map(([label, lo, hi]) => ({ label, count: stays.filter(s => s >= lo && s < hi).length }));

  // Current population: how long people have been held so far.
  const heldSoFar = inCustody.map(e => daysBetween(e.bookedAt, now)).filter(v => v != null);

  const bonds = inCustody.map(e => e.bondTotal).filter(v => v != null);

  return {
    generatedAt: now,
    monitoringSince: log.reduce((min, e) => (!min || e.firstSeen < min ? e.firstSeen : min), null),
    totals: {
      bookingsTracked: log.length,
      bookingsObserved: observed.length,
      releasesObserved: released.length,
      inCustody: inCustody.length,
      uniquePeople: new Set(log.map(e => e.inmateNumber)).size
    },
    bookingsByDay,
    topCharges: topN(countBy(allCharges, c => c.description), 20),
    topAgencies: topN(countBy(log, e => e.arrestingAgency), 10)
      .map(a => ({ ...a, label: AGENCY_NAMES[a.name] || a.name })),
    courts: topN(countBy(allCharges, c => c.court), 12)
      .map(c => ({ ...c, label: COURT_NAMES[c.name] || c.name })),
    releasedTo: topN(countBy(released, e => e.releasedTo), 12),
    bondTypes: topN(countBy(allCharges, c => c.bondType), 12),
    stay: {
      releasedCount: stays.length,
      medianDays: round1(median(stays)),
      meanDays: round1(mean(stays)),
      buckets: stayBuckets,
      currentMedianDaysHeld: round1(median(heldSoFar)),
      currentLongestDaysHeld: round1(heldSoFar.length ? Math.max(...heldSoFar) : null)
    },
    bond: {
      withBond: bonds.length,
      noBond: inCustody.length - bonds.length,
      medianBond: median(bonds),
      maxBond: bonds.length ? Math.max(...bonds) : null,
      totalBond: bonds.reduce((a, b) => a + b, 0)
    },
    chargesPerBooking: round1(mean(log.map(e => (e.charges || []).length)))
  };
}
