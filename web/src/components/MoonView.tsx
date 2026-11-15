// "View from the Moon": the real Moon globe (LRO colour + LOLA relief), Earth and Sun seen from 15 km above the
// chosen site, at the selected time. Directions come from the JPL Horizons ephemeris (topocentric from the camera);
// Earth and the Sun are drawn 4× larger than true size so they are easy to see. No terrain shadows are computed here.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { vectorsAt } from '../lib/analysis'
import type { Ephemeris } from '../lib/data'
import { D2R, R_MOON_KM, enuBasis, unitVec, type Vec3 } from '../lib/geometry'
import { R_EARTH_KM, SUN_RADIUS_DEG } from '../lib/physics/disc'
import { starsMoonME } from '../lib/stars'
import { makeEarth, makeStarPoints, makeSun, texture } from './story/bodies'
import { toThree } from './story/StoryScene'

const ALT_KM = 15
const ENLARGE = 4
const EARTH_D = 60 // scene units (Moon radii) at which Earth is drawn; its angular size is kept

export default function MoonView({
  eph,
  t,
  lat,
  lon,
  siteName,
}: {
  eph: Ephemeris
  t: number
  lat: number
  lon: number
  siteName: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const look = useRef({ az: NaN, el: 2 })
  const tRef = useRef(t)
  const [failed, setFailed] = useState(false)
  const [aim, setAim] = useState<{ body: 'sun' | 'earth'; n: number }>({ body: 'sun', n: 0 })
  const aimRef = useRef(aim)
  useEffect(() => {
    tRef.current = t
    aimRef.current = aim
  }, [t, aim])

  useEffect(() => {
    const el = host.current!
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    } catch {
      void Promise.resolve().then(() => setFailed(true))
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    const camera = new THREE.PerspectiveCamera(55, 1, 0.0005, 4000)
    const moonColor = texture('moon_color.jpg'),
      moonHeight = texture('moon_height.jpg', false)
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1, 256, 128),
      new THREE.MeshStandardMaterial({ map: moonColor, bumpMap: moonHeight, bumpScale: 2.2, roughness: 1, metalness: 0 }),
    )
    scene.add(moon)
    const earthBody = makeEarth(1)
    scene.add(earthBody.group)
    const sunBody = makeSun('eye')
    scene.add(sunBody.group)
    const stars = makeStarPoints(1400)
    scene.add(stars.points)
    const light = new THREE.DirectionalLight(0xffffff, 3.2)
    scene.add(light)
    scene.add(new THREE.AmbientLight(0xffffff, 0.03))

    // site frame in three.js coordinates
    const b = enuBasis(lon, lat)
    const up = toThree(b.u).normalize(),
      north = toThree(b.n).normalize(),
      east = toThree(b.e).normalize()
    const cam = up.clone().multiplyScalar(1 + ALT_KM / R_MOON_KM)
    const camKm: Vec3 = unitVec(lon, lat).map((c) => c * (R_MOON_KM + ALT_KM)) as Vec3
    camera.position.copy(cam)
    camera.up.copy(up)

    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)
    let visible = true
    const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting))
    io.observe(el)

    const azOf = (d: THREE.Vector3) => Math.atan2(d.dot(east), d.dot(north)) / D2R
    let lastAim = -1,
      starHour = -1,
      raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible) return
      const tt = tRef.current
      const v = vectorsAt(eph, tt)
      const sd = toThree(v.sun).normalize()
      const rel: Vec3 = [v.earth[0] - camKm[0], v.earth[1] - camKm[1], v.earth[2] - camKm[2]]
      const distKm = Math.hypot(rel[0], rel[1], rel[2])
      const ed = toThree(rel).normalize()
      light.position.copy(sd).multiplyScalar(100)
      sunBody.group.position.copy(cam).addScaledVector(sd, 900)
      sunBody.group.scale.setScalar(900 * Math.tan(SUN_RADIUS_DEG * ENLARGE * D2R))
      sunBody.group.lookAt(cam)
      earthBody.setSun(sd)
      earthBody.group.position.copy(cam).addScaledVector(ed, EARTH_D)
      earthBody.group.scale.setScalar(EARTH_D * Math.tan(Math.asin(R_EARTH_KM / distKm) * ENLARGE))
      earthBody.group.rotation.y = (tt / 86_164_100) * 2 * Math.PI // illustrative spin
      const hour = Math.floor(tt / 3_600_000)
      if (hour !== starHour && stars.catalogue().length) {
        starHour = hour
        const m = starsMoonME(stars.catalogue(), v.sun, tt)
        const d = new Float32Array(m.length)
        for (let i = 0; i < m.length; i += 3) d.set([m[i], m[i + 2], -m[i + 1]], i)
        stars.place(d)
      }
      // aim at a body when asked (or on first frame)
      if (aimRef.current.n !== lastAim || Number.isNaN(look.current.az)) {
        lastAim = aimRef.current.n
        const target = aimRef.current.body === 'sun' ? sd : ed
        look.current.az = azOf(target)
        look.current.el = Math.max(-6, Math.min(30, Math.asin(target.dot(up)) / D2R - 2))
      }
      const { az, el: e } = look.current
      const dir = north
        .clone()
        .multiplyScalar(Math.cos(az * D2R) * Math.cos(e * D2R))
        .addScaledVector(east, Math.sin(az * D2R) * Math.cos(e * D2R))
        .addScaledVector(up, Math.sin(e * D2R))
      camera.lookAt(cam.clone().add(dir))
      renderer.render(scene, camera)
    }
    tick()

    // drag to look around
    let drag: { x: number; y: number; az: number; el: number } | null = null
    const down = (ev: PointerEvent) => {
      el.setPointerCapture(ev.pointerId)
      drag = { x: ev.clientX, y: ev.clientY, ...look.current }
    }
    const move = (ev: PointerEvent) => {
      if (!drag) return
      const k = 55 / el.clientHeight
      look.current.az = drag.az - (ev.clientX - drag.x) * k
      look.current.el = Math.max(-20, Math.min(60, drag.el + (ev.clientY - drag.y) * k))
    }
    const upH = () => (drag = null)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', upH)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', resize)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', upH)
      moon.geometry.dispose()
      ;(moon.material as THREE.Material).dispose()
      moonColor.dispose()
      moonHeight.dispose()
      earthBody.dispose()
      sunBody.dispose()
      stars.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [eph, lat, lon])

  if (failed)
    return (
      <p className="state-error" role="alert">
        WebGL is unavailable in this browser, so the view from the Moon cannot be drawn. The 2D view still works.
      </p>
    )
  return (
    <figure className="moon-view">
      <div className="moon-view-tools">
        <button type="button" className="btn" onClick={() => setAim((a) => ({ body: 'sun', n: a.n + 1 }))}>
          Look at the Sun
        </button>
        <button type="button" className="btn" onClick={() => setAim((a) => ({ body: 'earth', n: a.n + 1 }))}>
          Look at Earth
        </button>
      </div>
      <div
        ref={host}
        className="moon-view-canvas"
        role="img"
        aria-label={`View from 15 km above ${siteName}, with the Sun and Earth in their real directions.`}
      />
      <figcaption>
        Seen from {ALT_KM} km above {siteName}. Drag to look around. Directions of the Sun and Earth are real (JPL Horizons); both are drawn{' '}
        {ENLARGE}× larger so they are easy to see. Moon: LRO colour and LOLA relief.
      </figcaption>
    </figure>
  )
}
