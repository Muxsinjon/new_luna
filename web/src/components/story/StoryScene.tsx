// Redesign: scroll-driven 3D story scene. Real NASA textures (LRO Moon, Blue Marble Earth, SDO Sun, Hipparcos/Tycho
// stars) placed with the app's JPL Horizons ephemeris. Moon frame = MOON_ME (texture longitude 0 at centre).
// Distances are compressed so Earth and Moon fit on screen; directions, lighting and phases are real.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { vectorsAt } from '../../lib/analysis'
import type { Ephemeris } from '../../lib/data'
import { unitVec, type Vec3 } from '../../lib/geometry'
import { cssVar } from '../../lib/theme'

const BASE = import.meta.env.BASE_URL + 'textures/'
/** MOON_ME (x lon 0, y lon 90° E, z north) -> three.js sphere frame (Y up, lon 0 at +X, lon 90° E at −Z) */
export const toThree = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1])
const EARTH_DIST = 28 // Moon radii (true: 221) - compressed for the story
const EARTH_R = 3.67 // Earth radius in Moon radii (true ratio)

export interface StoryFrame {
  /** 0..1 progress through the story */
  p: number
  /** mission time shown (ms UTC) */
  t: number
}
export interface StoryPin {
  lat: number
  lon: number
}

// camera keyframes [progress, position, target], re-evaluated every frame from the real Sun/Earth directions
type V = THREE.Vector3
const near = (lat: number, lon: number, r: number) => toThree(unitVec(lon, lat)).multiplyScalar(r)
/** low over the south pole, looking horizontally toward a body (its horizontal direction at the pole) */
function poleView(dir: V): [V, V] {
  const h = new THREE.Vector3(dir.x, 0, dir.z).normalize()
  const pos = new THREE.Vector3(0, -1.012, 0).add(h.clone().multiplyScalar(-0.16))
  return [
    pos,
    pos
      .clone()
      .add(h.multiplyScalar(10))
      .add(new THREE.Vector3(0, 1.4, 0)),
  ]
}
function keyframes(earthDir: V, sunDir: V): [number, V, V][] {
  const e = earthDir.clone().multiplyScalar(EARTH_DIST)
  const side = new THREE.Vector3().crossVectors(earthDir, new THREE.Vector3(0, 1, 0)).normalize()
  const [sp, st] = poleView(sunDir)
  const [ep, et] = poleView(earthDir)
  const hero = e
    .clone()
    .add(earthDir.clone().multiplyScalar(9))
    .add(side.clone().multiplyScalar(-5.5))
    .add(new THREE.Vector3(0, 1.2, 0))
  return [
    [0.0, hero, side.clone().multiplyScalar(-6)],
    [
      0.2,
      earthDir
        .clone()
        .multiplyScalar(4.2)
        .add(new THREE.Vector3(0, -0.6, 0)),
      new THREE.Vector3(0, -0.15, 0),
    ],
    [0.4, near(-58, 20, 2.7), new THREE.Vector3(0, -0.85, 0)],
    [0.6, sp, st],
    [0.8, ep, et],
    [1.0, near(-30, 60, 4.6), new THREE.Vector3(0.6, -0.2, 0)],
  ]
}

const smooth = (x: number) => x * x * (3 - 2 * x)

export default function StoryScene({
  eph,
  frame,
  pins,
  reduced,
}: {
  eph: Ephemeris
  frame: React.RefObject<StoryFrame>
  pins: StoryPin[]
  reduced: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current!
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      el.classList.add('story-fallback') // CSS shows a static gradient; the story text still works
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 4000)
    const tex = new THREE.TextureLoader()
    const load = (f: string, srgb = true) => {
      const t = tex.load(BASE + f)
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      return t
    }
    // stars: ecliptic north roughly along the Moon's spin axis (within 1.5°); longitude aligned with the Sun each frame
    const stars = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 48, 24),
      new THREE.MeshBasicMaterial({ map: load('stars.jpg'), side: THREE.BackSide, color: 0x8a8a8a }),
    )
    stars.rotation.x = (-23.44 * Math.PI) / 180
    const starRig = new THREE.Group()
    starRig.add(stars)
    scene.add(starRig)
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1, 192, 96),
      new THREE.MeshStandardMaterial({
        map: load('moon_color.jpg'),
        bumpMap: load('moon_height.jpg', false),
        bumpScale: 2.2,
        roughness: 1,
        metalness: 0,
      }),
    )
    scene.add(moon)
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 96, 48),
      new THREE.MeshStandardMaterial({ map: load('earth.jpg'), roughness: 0.85, metalness: 0 }),
    )
    scene.add(earth)
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.03, 64, 32),
      new THREE.MeshBasicMaterial({ color: cssVar('--c-earth'), transparent: true, opacity: 0.12, side: THREE.BackSide }),
    )
    earth.add(atmo)
    const sun = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: load('sun.jpg'), transparent: true }))
    scene.add(sun)
    // soft glow around the Sun (display aid; the disc itself is the SDO image)
    const gc = document.createElement('canvas')
    gc.width = gc.height = 128
    const g2 = gc.getContext('2d')!
    const grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, cssVar('--c-sun'))
    grad.addColorStop(1, 'transparent')
    g2.fillStyle = grad
    g2.fillRect(0, 0, 128, 128)
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(gc),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.55,
        transparent: true,
      }),
    )
    glow.scale.setScalar(260)
    scene.add(glow)
    const light = new THREE.DirectionalLight(0xffffff, 3.2)
    scene.add(light)
    scene.add(new THREE.AmbientLight(0xffffff, 0.035))
    const pinMat = new THREE.MeshBasicMaterial({ color: cssVar('--c-accent') })
    const pinMeshes: THREE.Mesh[] = []
    for (const p of pins) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 12, 8), pinMat)
      pinMeshes.push(m)
      m.position.copy(toThree(unitVec(p.lon, p.lat)).multiplyScalar(1.004))
      moon.add(m)
    }
    const v0 = vectorsAt(eph, frame.current.t)
    const k0 = keyframes(toThree(v0.earth).normalize(), toThree(v0.sun).normalize())
    const camPos = k0[0][1].clone(),
      camTgt = k0[0][2].clone()
    let raf = 0,
      visible = true
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)
    const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting))
    io.observe(el)
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible) return
      const { p, t } = frame.current
      const { earth: ev, sun: sv } = vectorsAt(eph, t)
      const sd = toThree(sv).normalize()
      const ed = toThree(ev).normalize()
      light.position.copy(sd).multiplyScalar(100)
      sun.position.copy(sd).multiplyScalar(900)
      sun.scale.setScalar(900 * Math.tan((0.2666 * 5 * Math.PI) / 180)) // drawn 5× true size for visibility
      sun.lookAt(0, 0, 0)
      earth.position.copy(ed).multiplyScalar(EARTH_DIST)
      earth.rotation.y = (t / 86_164_100) * 2 * Math.PI // sidereal spin (illustrative)
      starRig.rotation.y = Math.atan2(-sd.z, sd.x) // keeps the star field consistent with the Sun direction
      // camera along the keyframes, eased and damped for smoothness
      const keys = keyframes(ed, sd)
      let i = 0
      while (i < keys.length - 2 && p > keys[i + 1][0]) i++
      const [p0, a0, b0] = keys[i],
        [p1, a1, b1] = keys[i + 1]
      const f = smooth(Math.min(1, Math.max(0, (p - p0) / (p1 - p0))))
      const wantPos = a0.clone().lerp(a1, f),
        wantTgt = b0.clone().lerp(b1, f)
      const k = reduced ? 1 : 0.08
      camPos.lerp(wantPos, k)
      camTgt.lerp(wantTgt, k)
      camera.position.copy(camPos)
      // near the surface, 'up' is the local vertical (at the south pole that is -Y)
      const alt = camPos.length()
      const w = Math.min(1, Math.max(0, (2.2 - alt) / 1.0))
      camera.up.set(0, 1, 0).lerp(camPos.clone().normalize(), w).normalize()
      camera.lookAt(camTgt)
      const ps = Math.min(1, Math.max(0.06, (alt - 1) / 1.6))
      for (const m of pinMeshes) m.scale.setScalar(ps)
      glow.position.copy(sun.position)
      renderer.render(scene, camera)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', resize)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.MeshStandardMaterial | undefined
        mat?.map?.dispose()
        mat?.bumpMap?.dispose()
        mat?.dispose?.()
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [eph, frame, pins, reduced])
  return <div ref={host} className="story-canvas" aria-hidden />
}
