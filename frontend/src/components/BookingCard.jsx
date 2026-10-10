import { useState } from 'react'
import { formatDateTime, formatMoney, timeHeld, agencyName, courtName, releaseTime } from '../format'

export default function BookingCard({ entry }) {
  const [open, setOpen] = useState(false)

  const isReleased = entry.status === 'released'
  const held = isReleased ? timeHeld(entry.bookedAt, entry.releasedAt) : null

  return (
    <div className={`card ${isReleased ? 'card-released' : 'card-custody'}`}>
      <div className="card-header" onClick={() => setOpen(!open)}>
        <div className="card-left">
          <div className="card-name">{entry.name}</div>
          <div className="card-meta">
            Inmate #{entry.inmateNumber} &nbsp;·&nbsp; Booked: {formatDateTime(entry.bookedAt)}
            {held && <span className="card-time-held"> &nbsp;·&nbsp; Held: {held}</span>}
          </div>
        </div>
        <div className="card-right">
          <span className={`badge ${isReleased ? 'badge-released' : 'badge-custody'}`}>
            {isReleased ? 'Released' : 'In Custody'}
          </span>
          <span className="card-toggle">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="card-body">
          {isReleased && entry.releasedAt && (
            <div className="card-release-row">
              Released: {releaseTime(entry, formatDateTime)}
              {entry.releasedTo && <> &nbsp;·&nbsp; To: {entry.releasedTo}</>}
              {held && <span className="card-time-held-detail"> &nbsp;·&nbsp; Time held: {held}</span>}
            </div>
          )}

          <div className="card-description">
            <div className="desc-row">
              <span>Arresting Agency</span><span>{agencyName(entry.arrestingAgency)}</span>
            </div>
            <div className="desc-row">
              <span>Bond Total</span><span>{formatMoney(entry.bondTotal) || 'None'}</span>
            </div>
          </div>

          {entry.charges?.length > 0 && (
            <div className="card-charges">
              <div className="charges-title">Charges ({entry.charges.length})</div>
              {entry.charges.map((c, i) => (
                <div key={i} className="charge-row">
                  <div className="charge-violation">
                    {c.description}
                    
                  </div>
                  {c.court && <div className="charge-court">{courtName(c.court)}</div>}
                  {(c.bondType || c.bondAmount) && (
                    <div className="charge-bail">
                      Bond: {[c.bondType, formatMoney(c.bondAmount)].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {c.arrestingAgency && (
                    <div className="charge-agency">Arrested by: {agencyName(c.arrestingAgency)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
