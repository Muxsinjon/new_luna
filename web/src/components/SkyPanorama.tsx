// The whole sky around one site on one fixed scale (−5° to 15°), with the real LOLA horizon, the Sun and Earth now,
// and where they travel over the next lunar day. Idea adapted from astoreyai/lunar-lighting-planner.
import type { Sample } from '../lib/analysis'
import { fmtAz, fmtDeg } from '../lib/format'
import { type VisModel, signal } from '../lib/visibility'
import { useWidth } from './ui'

const LO = -5,
  HI = 15

export default function SkyPanorama({
  horizon,
  step,
  now,
  path,
  vis,
  siteName,
}: {
  horizon: number[]
  step: number
  now: Sample
  /** hourly samples ahead (thinned), for the dotted paths */
  path: Sample[]
  vis: VisModel
  siteName: string
}) {
  const [box, W] = useWidth<HTMLDivElement>()
  const H = Math.round(Math.max(200, Math.min(300, W * 0.3)))
  const x = (az: number) => ((((az % 360) + 360) % 360) / 360) * W
  const yRaw = (el: number) => H - ((el - LO) / (HI - LO)) * H
  const y = (el: number) => yRaw(Math.max(LO - 1, Math.min(HI, el)))
  const ground = horizon.map((h, i) => `${x(i * step).toFixed(1)},${y(h).toFixed(1)}`)
  const stretch = Math.round(360 / W / ((HI - LO) / H))
  const sunUp = signal(now, 'sun', vis) > 0
  const earthUp = signal(now, 'earth', vis) > 0
  const clipped = now.sunEl > HI || now.earthEl > HI
  const terrain = vis === 'terrain'
  const label = `${siteName}: the full 360° horizon. The Sun is ${sunUp ? 'up' : 'hidden'} at azimuth ${fmtAz(now.sunAz)}, elevation ${fmtDeg(now.sunEl)}; Earth is ${earthUp ? 'in view' : 'hidden'} at azimuth ${fmtAz(now.earthAz)}, elevation ${fmtDeg(now.earthEl)}.`
  return (
    <figure className="sky-pano">
      <div ref={box}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
          <rect width={W} height={H} className="sky-bg" />
          {[0, 5, 10].map((g) => (
            <g key={g}>
              <line x1={0} x2={W} y1={y(g)} y2={y(g)} className={g === 0 ? 'sky-zero' : 'sky-grid'} />
              <text x={6} y={y(g) - 4} className="sky-tick">
                {g}°
              </text>
            </g>
          ))}
          {path.map((p, i) => (
            <circle
              key={`s${i}`}
              cx={x(p.sunAz)}
              cy={y(p.sunEl)}
              r={1.6}
              className={signal(p, 'sun', vis) > 0 ? 'sky-path sun' : 'sky-path off'}
            />
          ))}
          {path.map((p, i) => (
            <circle
              key={`e${i}`}
              cx={x(p.earthAz)}
              cy={y(p.earthEl)}
              r={1.6}
              className={signal(p, 'earth', vis) > 0 ? 'sky-path earth' : 'sky-path off'}
            />
          ))}
          {/* bodies first, so the terrain in front hides them */}
          <circle cx={x(now.sunAz)} cy={y(now.sunEl)} r={9} className="sky-sun" />
          <circle cx={x(now.earthAz)} cy={y(now.earthEl)} r={8} className="sky-earth" />
          {terrain ? (
            <path d={`M0,${H} L${ground.join(' L')} L${W},${y(horizon[0])} L${W},${H}Z`} className="sky-ground" />
          ) : (
            <rect x={0} y={y(0)} width={W} height={H - y(0)} className="sky-ground" />
          )}
          {!sunUp && <circle cx={x(now.sunAz)} cy={y(now.sunEl)} r={9} className="sky-ring sun" />}
          {!earthUp && <circle cx={x(now.earthAz)} cy={y(now.earthEl)} r={8} className="sky-ring earth" />}
          <text x={x(now.sunAz) + 13} y={y(now.sunEl) - 9} className="sky-label sun">
            Sun{sunUp ? '' : ' (hidden)'}
          </text>
          <text x={x(now.earthAz) + 12} y={y(now.earthEl) + 18} className="sky-label earth">
            Earth{earthUp ? '' : ' (hidden)'}
          </text>
          {['N', 'E', 'S', 'W'].map((c, i) => (
            <text key={c} x={x(i * 90) + 4} y={H - 8} className="sky-compass">
              {c}
            </text>
          ))}
        </svg>
      </div>
      <figcaption>
        The whole horizon around you, north to north. Dots show where the Sun and Earth travel over the next 30 days (bright: visible, grey:
        hidden). Heights are stretched about {stretch}× so the low polar horizon is readable
        {clipped ? '; anything higher than 15° is drawn at the top edge' : ''}.
      </figcaption>
    </figure>
  )
}
