// Four plain-word cards for one site: Sun now, Earth now, sunlight over the next 30 days, Earth over the next 30 days.
import type { NextEvent } from '../lib/analysis'
import { fmtHours, fmtHoursApprox, fmtPct } from '../lib/format'
import type { SiteDigest } from '../lib/siteDigest'

function countdown(ev: NextEvent, t: number): string {
  const word = ev.kind.toLowerCase()
  if (ev.time === null) return `No ${word} found before the data ends.`
  return `${ev.kind} in ${fmtHoursApprox(ev.time - t)} (to the hour).`
}

export default function SiteCards({
  d,
  sunEv,
  earthEv,
  t,
  span = 'next 30 days',
  expectedH = 30 * 24,
}: {
  d: SiteDigest | null
  sunEv: NextEvent
  earthEv: NextEvent
  t: number
  span?: string
  expectedH?: number
}) {
  if (!d) return <p className="hint">Insufficient data: this date is outside the supported range.</p>
  const short = d.hours < expectedH - 24
  return (
    <div className="site-cards">
      <section className={`site-card ${d.sunState === 'sunlit' ? 'on-sun' : 'off'}`}>
        <h3>Sun now</h3>
        <p className="big">{d.sunState === 'sunlit' ? 'In sunlight' : d.sunState === 'behind terrain' ? 'In shadow' : 'Lunar night'}</p>
        <p>
          {d.sunState === 'behind terrain' ? 'The Sun is up, but a ridge hides it. ' : ''}
          {countdown(sunEv, t)}
        </p>
      </section>
      <section className={`site-card ${d.earthState === 'in view' ? 'on-earth' : 'off'}`}>
        <h3>Earth now</h3>
        <p className="big">{d.earthState === 'in view' ? 'Earth in view' : 'Earth hidden'}</p>
        <p>
          {d.earthState === 'behind terrain' ? 'Terrain blocks the line to Earth. ' : ''}
          {d.earthState === 'below the horizon' ? 'Earth is below the horizon. ' : ''}
          {countdown(earthEv, t)}
        </p>
      </section>
      <section className="site-card">
        <h3>Sunlight, {span}</h3>
        <p className="big">{fmtPct(d.sunPct)}</p>
        <p>Longest night: {fmtHours(d.longestNightH)}.</p>
      </section>
      <section className="site-card">
        <h3>Earth, {span}</h3>
        <p className="big">
          {d.earth === 'always' ? 'Always in view' : d.earth === 'never' ? 'Never in view' : `In view ${fmtPct(d.earthPct)}`}
        </p>
        <p>
          {d.earth === 'sometimes'
            ? 'Line of sight to Earth comes and goes.'
            : d.earth === 'always'
              ? 'Line of sight to Earth the whole time.'
              : 'No direct line of sight: a relay would be needed.'}
        </p>
      </section>
      {short && <p className="hint">Only {fmtHours(d.hours)} of data remain after this date, so these numbers cover a shorter span.</p>}
    </div>
  )
}
