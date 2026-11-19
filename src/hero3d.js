/* CMB Immobilien – 3D-Einstieg: Haus mit Herz, komplett aus Code (three.js).
 * Methode: ein festes Canvas hinter der Story, Studiolicht per PMREM, Kamera-Cues pro Abschnitt,
 * Explosionsansicht, eine Uhr für den Puls, Bloom + ACES, adaptive Qualität.
 * Build: npx esbuild src/hero3d.js --bundle --minify --format=iife --outfile=assets/js/hero3d.js
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GREEN = 0xa8cd4e;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const rad = (d) => (d * Math.PI) / 180;
const html = document.documentElement;

/* ---------- Geometrie aus Code ---------- */
function rectPath(shape, w, h, cx = 0, cy = 0) {
  shape.moveTo(cx - w / 2, cy - h / 2);
  shape.lineTo(cx + w / 2, cy - h / 2);
  shape.lineTo(cx + w / 2, cy + h / 2);
  shape.lineTo(cx - w / 2, cy + h / 2);
  shape.closePath();
  return shape;
}

/** Quader mit polierter Fase; Maße sind die Außenmaße. */
function bevBox(w, h, d, r = 0.04) {
  const s = rectPath(new THREE.Shape(), w - 2 * r, h - 2 * r);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}

/** Wandtafel mit Öffnungen (Fenster, Tür), extrudiert mit Fase. */
function panel(w, h, d, holes = [], r = 0.04) {
  const s = rectPath(new THREE.Shape(), w - 2 * r, h - 2 * r);
  holes.forEach((o) => s.holes.push(rectPath(new THREE.Path(), o.w + 2 * r, o.h + 2 * r, o.x, o.y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}

function heartShape(sc, shape = new THREE.Shape(), cy = 0) {
  shape.moveTo(0, cy - 0.95 * sc);
  shape.bezierCurveTo(-1.25 * sc, cy - 0.1 * sc, -0.95 * sc, cy + 0.95 * sc, 0, cy + 0.45 * sc);
  shape.bezierCurveTo(0.95 * sc, cy + 0.95 * sc, 1.25 * sc, cy - 0.1 * sc, 0, cy - 0.95 * sc);
  return shape;
}

function build() {
  const M = {
    wall: new THREE.MeshPhysicalMaterial({ color: 0xe6e4df, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    plinth: new THREE.MeshPhysicalMaterial({ color: 0x25282b, roughness: 0.32, metalness: 0.7 }),
    roof: new THREE.MeshPhysicalMaterial({ color: 0x3a3f44, roughness: 0.3, metalness: 1, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xc4c8cb, roughness: 0.16, metalness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xaec4cf, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.3, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false }),
    door: new THREE.MeshPhysicalMaterial({ color: 0x86ad34, roughness: 0.38, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.2 }),
    heart: new THREE.MeshStandardMaterial({ color: 0x5f7d22, emissive: GREEN, emissiveIntensity: 1.0, roughness: 0.4 }),
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  };

  const root = new THREE.Group();
  const layers = [];
  const addLayer = (name, baseY, lift, order, center) => {
    const g = new THREE.Group();
    g.position.y = baseY;
    root.add(g);
    const L = { name, group: g, base: new THREE.Vector3(0, baseY, 0), lift: new THREE.Vector3(...lift), order, center: new THREE.Vector3(...center) };
    layers.push(L);
    return g;
  };

  // 0 Sockel (Verwaltung)
  {
    const g = addLayer('sockel', 0, [0, 0, 0], 0.1, [0, 0.3, 0]);
    g.add(mesh(bevBox(11.2, 0.6, 8.2, 0.05), M.plinth, 0, 0.3, 0));
    g.add(mesh(bevBox(2.6, 0.22, 1.3, 0.04), M.plinth, 0, 0.11, 4.7));
  }

  // 1 Erdgeschoss (Vermietung)
  {
    const g = addLayer('eg', 0.6, [0, 2.0, 0], 0.35, [0, 1.5, 0]);
    const win = [{ x: -3, y: 0.25, w: 1.8, h: 1.5 }, { x: 3, y: 0.25, w: 1.8, h: 1.5 }];
    g.add(mesh(panel(10, 3, 0.3, [{ x: 0, y: -0.35, w: 1.3, h: 2.3 }, ...win]), M.wall, 0, 1.5, 3.5));
    g.add(mesh(panel(10, 3, 0.3, win), M.wall, 0, 1.5, -3.5));
    win.forEach((o) => {
      g.add(mesh(new THREE.BoxGeometry(o.w + 0.05, o.h + 0.05, 0.03), M.glass, o.x, 1.5 + o.y, 3.5));
      g.add(mesh(new THREE.BoxGeometry(o.w + 0.05, o.h + 0.05, 0.03), M.glass, o.x, 1.5 + o.y, -3.5));
    });
    g.add(mesh(bevBox(1.3, 2.3, 0.1, 0.03), M.door, 0, 1.15, 3.45));
    g.add(mesh(bevBox(0.08, 0.2, 0.06, 0.02), M.steel, 0.45, 1.1, 3.55));
    [-1, 1].forEach((s) => g.add(mesh(bevBox(0.3, 3, 6.7), M.wall, s * 4.85, 1.5, 0)));
    g.add(mesh(bevBox(9.7, 0.2, 6.7), M.wall, 0, 2.9, 0));
  }

  // 2 Obergeschoss (Verkauf und Kauf)
  {
    const g = addLayer('og', 3.6, [0, 4.2, 0], 0.6, [0, 1.4, 0]);
    const win = [-3, 0, 3].map((x) => ({ x, y: 0.1, w: 1.5, h: 1.4 }));
    g.add(mesh(panel(10, 2.8, 0.3, win), M.wall, 0, 1.4, 3.5));
    g.add(mesh(panel(10, 2.8, 0.3, win), M.wall, 0, 1.4, -3.5));
    win.forEach((o) => {
      g.add(mesh(new THREE.BoxGeometry(o.w + 0.05, o.h + 0.05, 0.03), M.glass, o.x, 1.4 + o.y, 3.5));
      g.add(mesh(new THREE.BoxGeometry(o.w + 0.05, o.h + 0.05, 0.03), M.glass, o.x, 1.4 + o.y, -3.5));
    });
    [-1, 1].forEach((s) => g.add(mesh(bevBox(0.3, 2.8, 6.7), M.wall, s * 4.85, 1.4, 0)));
    g.add(mesh(bevBox(9.7, 0.2, 6.7), M.wall, 0, 2.7, 0));
    // Balkon mit Geländer
    g.add(mesh(bevBox(3.4, 0.14, 1.2, 0.03), M.plinth, 0, 0.1, 4.1));
    const rail = new THREE.BoxGeometry(3.4, 0.04, 0.04);
    g.add(mesh(rail, M.steel, 0, 0.95, 4.65));
    for (let x = -1.6; x <= 1.61; x += 0.4) g.add(mesh(new THREE.BoxGeometry(0.04, 0.85, 0.04), M.steel, x, 0.55, 4.65));
    [-1.7, 1.7].forEach((x) => g.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 1.1), M.steel, x, 0.95, 4.1)));
  }

  // 3 Dach mit Giebel und Herz (Bewertung)
  let heart;
  {
    const g = addLayer('dach', 6.4, [0, 7.0, 0], 1.0, [0, 1.6, 0]);
    const a = Math.atan2(3.3, 5.6);
    const len = Math.hypot(5.6, 3.3);
    [-1, 1].forEach((s) => {
      const slab = mesh(bevBox(len, 0.22, 8.4, 0.04), M.roof, s * 2.8, 1.65, 0);
      slab.rotation.z = -s * a;
      g.add(slab);
    });
    g.add(mesh(bevBox(0.5, 0.2, 8.4, 0.04), M.steel, 0, 3.32, 0));
    g.add(mesh(bevBox(0.9, 2.0, 0.9, 0.04), M.roof, 3.2, 2.2, -1.2));
    const tri = (withHole) => {
      const s = new THREE.Shape();
      s.moveTo(-5, 0); s.lineTo(5, 0); s.lineTo(0, 3.15); s.closePath();
      if (withHole) s.holes.push(heartShape(0.7, new THREE.Path(), 1.3));
      return new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false, curveSegments: 14 });
    };
    const front = mesh(tri(true), M.wall, 0, 0.0, 3.375);
    // Herzfenster: Loch auf Höhe y = 1.25 verschieben
    front.geometry.translate(0, 0, 0);
    g.add(front);
    const back = mesh(tri(false), M.wall, 0, 0, -3.625);
    g.add(back);
    // Das Herz selbst (leuchtend) sitzt im Giebelfenster
    const hs = heartShape(0.62);
    const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3, curveSegments: 20 });
    hg.translate(0, 0, -0.05);
    heart = mesh(hg, M.heart, 0, 1.3, 3.5);
    g.add(heart);
  }
  heart.userData.base = heart.position.clone();
  heart.userData.lift = new THREE.Vector3(0, 0.9, 3.2);

  return { root, layers, heart, M };
}

/* ---------- Studiolicht (PMREM) ---------- */
function studioEnv(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x040405);
  const add = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    studio.add(m);
  };
  add(22, 14, 0xfff3e6, 6, [-22, 20, 20]); // Hauptlicht, schräg
  add(2.4, 34, 0xffffff, 8, [30, 4, 12]); // Streifenlicht, Kantenlinie
  add(2.4, 30, GREEN, 5, [-30, 6, -14]); // CMB-Grün als Kontur
  add(18, 6, 0xcfe0ff, 2, [0, 28, -10]); // Kopflicht, kühl
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(studio, 0.04).texture;
  pm.dispose();
  return tex;
}

/* ---------- Start ---------- */
function start() {
  const canvas = document.getElementById('welt');
  const story = document.getElementById('story');
  if (!canvas || !story) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SNAP = /[?&]snap\b/.test(location.search);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  } catch (e) {
    html.classList.add('no3d');
    return;
  }
  if (!renderer.getContext()) { html.classList.add('no3d'); return; }

  const isPhone = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
  let dpr = Math.min(devicePixelRatio || 1, isPhone ? 1.75 : 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4b5357);
  scene.fog = new THREE.Fog(0x4b5357, 38, 90);
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 1.0;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const { root, layers, heart } = build();
  scene.add(root);

  // Boden und Kontaktschatten
  const floor = new THREE.Mesh(new THREE.CircleGeometry(46, 64), new THREE.MeshStandardMaterial({ color: 0x394043, roughness: 0.55, metalness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sx = sc.getContext('2d');
  const gr = sx.createRadialGradient(64, 64, 6, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(0.55, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(22, 18), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  scene.add(shadow);

  // Herzlicht
  const heartLight = new THREE.PointLight(GREEN, 6, 14, 2);
  heartLight.position.set(0, 7.65, 5.2);
  scene.add(heartLight);

  // Postprocessing
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.55, 0.65, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let W = 1, H = 1;
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr);
    composer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    computeAt();
    if (reduced) frame(0.016, true);
  }

  /* ---------- Kamera-Cues, an Abschnitte gebunden ---------- */
  const CUES = [
    { id: 'beat-hero', frame: 15.5, az: 26, el: 10, t: [0, 4.4, 0], off: 0.2, e: 0, ts: 1 },
    { id: 'beat-close', frame: 3.8, az: 6, el: 6, t: [0, 7.7, 3.5], off: 0.3, e: 0, ts: 0.22 },
    { id: 'beat-apart', frame: 26, az: -22, el: 13, t: [0, 8.6, 0], off: 0.1, e: 1, ts: 1 },
    { id: 'beat-around', frame: 26, az: 150, el: 22, t: [0, 8.6, 0], off: 0.1, e: 1, ts: 1 },
    { id: 'beat-outro', frame: 16.5, az: 330, el: 11, t: [0, 4.4, 0], off: -0.2, e: 0, ts: 1 },
  ];
  const KEYS = ['frame', 'az', 'el', 'off', 'e', 'ts', 'tx', 'ty', 'tz'];
  CUES.forEach((c) => { [c.tx, c.ty, c.tz] = c.t; });
  let ats = [0, 0.25, 0.5, 0.75, 1];
  function computeAt() {
    const span = Math.max(1, story.offsetHeight - innerHeight);
    ats = CUES.map((c) => {
      const el = document.getElementById(c.id);
      if (!el) return 0;
      return clamp((el.offsetTop + el.offsetHeight / 2 - innerHeight / 2) / span, 0, 1);
    });
    for (let i = 1; i < ats.length; i++) if (ats[i] <= ats[i - 1]) ats[i] = ats[i - 1] + 0.001;
  }
  function goalFor(p) {
    const out = {};
    let i = 0;
    while (i < CUES.length - 2 && p > ats[i + 1]) i++;
    const a = CUES[i], b = CUES[i + 1];
    let u = clamp((p - ats[i]) / (ats[i + 1] - ats[i]), 0, 1);
    u = smooth(clamp((u - 0.12) / 0.76, 0, 1)); // Ruhephase um jeden Cue
    KEYS.forEach((k) => { out[k] = a[k] + (b[k] - a[k]) * u; });
    return out;
  }
  const cur = Object.assign({}, CUES[0]);
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), dir = new THREE.Vector3(), right = new THREE.Vector3();
  function placeCamera(s) {
    const asp = W / H;
    let h = s.frame, off = s.off;
    if (asp < 1) { h = s.frame * clamp(0.62 / asp, 1, 2.4); off = 0; }
    const dist = h / 2 / Math.tan(rad(camera.fov / 2));
    const az = rad(s.az), el = rad(s.el);
    dir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    tgt.set(s.tx, s.ty + (asp < 1 ? h * 0.12 : 0), s.tz);
    right.set(Math.cos(az), 0, -Math.sin(az)).multiplyScalar(-off * h * asp);
    pos.copy(tgt).addScaledVector(dir, dist).add(right);
    tgt.add(right);
    camera.position.copy(pos);
    camera.lookAt(tgt);
  }

  /* ---------- Beschriftung der Etagen (Projektion auf den Bildschirm) ---------- */
  const labels = [...document.querySelectorAll('#etagen li')];
  const leader = document.getElementById('leader');
  const lines = labels.map(() => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    leader && leader.appendChild(l);
    return l;
  });
  const v3 = new THREE.Vector3();
  function updateLabels(e) {
    const desktop = W >= 900;
    const vis = desktop ? smooth(clamp((e - 0.8) / 0.2, 0, 1)) * smooth(1 - clamp(Math.abs(cur.az + 22) / 55, 0, 1)) : 0;
    labels.forEach((li, i) => {
      const L = layers[i];
      if (!L) return;
      if (!desktop) { li.style.opacity = ''; li.style.transform = ''; lines[i].style.opacity = 0; return; }
      v3.copy(L.group.position).add(L.center); v3.x = 5.6;
      v3.project(camera);
      const px = (v3.x * 0.5 + 0.5) * W, py = (-v3.y * 0.5 + 0.5) * H;
      const lx = W * 0.77;
      li.style.opacity = vis.toFixed(3);
      li.style.transform = `translate(${lx}px, ${py}px) translateY(-50%)`;
      lines[i].setAttribute('x1', px); lines[i].setAttribute('y1', py);
      lines[i].setAttribute('x2', lx - 14); lines[i].setAttribute('y2', py);
      lines[i].style.opacity = (vis * 0.7).toFixed(3);
    });
  }

  /* ---------- Eingabe ---------- */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { ptr.tx = (e.clientX / innerWidth) * 2 - 1; ptr.ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  /* ---------- Schleife ---------- */
  let time = 0, active = true, fpsAcc = 0, fpsN = 0, tuned = false;
  let last = performance.now();
  const beatOf = (t) => {
    const ph = (t * 0.9) % 1;
    const a = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 8);
    const b = 0.6 * Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2 - 0.95)), 8);
    return a + b;
  };
  function frame(dtRaw, once) {
    const dt = Math.min(dtRaw, 0.05);
    const span = Math.max(1, story.offsetHeight - innerHeight);
    const p = reduced ? 0 : clamp((scrollY - story.offsetTop) / span, 0, 1);
    const goal = goalFor(p);
    const k = SNAP || once ? 1 : 1 - Math.exp(-dt * 4.5);
    KEYS.forEach((key) => { cur[key] += (goal[key] - cur[key]) * k; });
    time += dt * cur.ts;
    ptr.x += (ptr.tx - ptr.x) * 0.06; ptr.y += (ptr.ty - ptr.y) * 0.06;
    scene.environmentRotation.set(ptr.y * 0.45, -ptr.x * 0.8, 0);

    // Explosion: obere Teile gehen zuerst, kommen zuletzt zurück
    layers.forEach((L) => {
      const delay = (1 - L.order) * 0.42;
      const t = smooth(clamp((cur.e - delay) / 0.58, 0, 1));
      L.group.position.copy(L.base).addScaledVector(L.lift, t);
    });
    const hd = smooth(clamp((cur.e - 0.0) / 0.5, 0, 1));
    heart.position.copy(heart.userData.base).addScaledVector(heart.userData.lift, hd);
    const s = beatOf(time);
    heart.material.emissiveIntensity = 0.9 + 0.9 * s;
    heart.scale.setScalar(1 + 0.07 * s);
    heartLight.intensity = 6 + 12 * s;
    heartLight.position.set(0, layers[3].group.position.y + heart.position.y, heart.position.z + 1.8);

    placeCamera(cur);
    updateLabels(cur.e);
    composer.render(dtRaw);
  }

  function tick(now) {
    const dtRaw = (now - last) / 1000;
    last = now;
    if (active) {
      frame(dtRaw, false);
      // adaptive Qualität: erst Auflösung, dann Bloom
      if (!tuned) {
        fpsAcc += dtRaw; fpsN++;
        if (fpsN >= 90) {
          const fps = fpsN / fpsAcc;
          if (fps < 40) {
            if (dpr > 0.8) { dpr = Math.max(0.75, dpr - 0.35); resize(); }
            else { bloom.enabled = false; tuned = true; }
          } else { tuned = true; }
          fpsAcc = 0; fpsN = 0;
        }
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Initialisieren ---------- */
  computeAt();
  resize();
  addEventListener('resize', resize);
  new ResizeObserver(computeAt).observe(story);
  new IntersectionObserver((en) => { active = en[0].isIntersecting; canvas.classList.toggle('aus', !active); }, { threshold: 0 }).observe(story);

  const ready = () => { html.classList.add('bereit'); };
  (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve()).catch(() => {}).then(() => {
    frame(0.016, true);
    ready();
    if (!reduced) requestAnimationFrame(tick);
  });
  window.__cmb3d = { camera, cur, layers, renderer };
}

start();
