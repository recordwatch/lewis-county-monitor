// Timestamps are Pacific local strings: "2026-10-10T04:26:29".
// Format them by slicing the string rather than via Date, so the display
// doesn't shift if the viewer is in a different time zone.

export function formatDate(ts) {
  if (!ts) return ''
  const [y, m, d] = ts.slice(0, 10).split('-')
  return `${m}/${d}/${y.slice(2)}`
}

export function formatTime(ts) {
  if (!ts || ts.length < 16) return ''
  let h = parseInt(ts.slice(11, 13), 10)
  const min = ts.slice(14, 16)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${min} ${ampm}`
}

export function formatDateTime(ts) {
  return ts ? `${formatDate(ts)} ${formatTime(ts)}` : ''
}

export function formatMoney(n) {
  if (n == null) return null
  return '$' + Number(n).toLocaleString('en-US')
}

export function timeHeld(start, end) {
  if (!start || !end) return null
  const ms = new Date(end) - new Date(start)
  if (!(ms > 0)) return null
  const totalMins = Math.floor(ms / 60000)
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export const AGENCY_NAMES = {
  LCSO: 'Lewis County Sheriff',
  CENT: 'Centralia PD',
  CHEH: 'Chehalis PD',
  WASH: 'Washington State Patrol',
  WINL: 'Winlock PD',
  NAPA: 'Napavine PD',
  MORT: 'Morton PD',
  TCSO: 'Thurston County Sheriff',
  JAIL: 'Lewis County Jail',
  DOC:  'Dept. of Corrections'
}

export const COURT_NAMES = {
  SUP: 'Lewis County Superior Court',
  LCD: 'Lewis County District Court',
  CNM: 'Centralia Municipal Court',
  CSM: 'Chehalis Municipal Court',
  WLM: 'Winlock Municipal Court',
  NMC: 'Napavine Municipal Court',
  DOC: 'Dept. of Corrections'
}

export function agencyName(code) {
  return AGENCY_NAMES[code] || code || 'N/A'
}

export function courtName(code) {
  return COURT_NAMES[code] || code
}

// "~" marks release times we estimated (first scrape they were missing)
// rather than read from the official releases page.
export function releaseTime(entry, fmt) {
  return (entry.releaseSource === 'official' ? '' : '~') + fmt(entry.releasedAt)
}
