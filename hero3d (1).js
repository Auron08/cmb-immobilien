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
    wall: new THREE.MeshPhysicalMaterial({ color: 0xd9d4c8, roughness: 0.6, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    plinth: new THREE.MeshPhysicalMaterial({ color: 0x8d9296, roughness: 0.6, metalness: 0.05 }),
    roof: new THREE.MeshPhysicalMaterial({ color: 0x9a4b38, roughness: 0.55, metalness: 0.1, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xc4c8cb, roughness: 0.16, metalness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xaec4cf, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.3, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false }),
    door: new THREE.MeshPhysicalMaterial({ color: 0x86ad34, roughness: 0.38, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.2 }),
    heart: new THREE.MeshStandardMaterial({ color: 0x2f7d0a, emissive: 0x58c20c, emissiveIntensity: 0.8, roughness: 0.4 }),
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

/* ---------- Tageslicht (PMREM): blauer Himmel, warme Sonne, grüne Wiese ---------- */
function skyTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  stops.forEach(([p, col]) => g.addColorStop(p, col));
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const SKY_STOPS = [[0, '#1766dc'], [0.22, '#2a7fe6'], [0.36, '#3f95ec'], [0.44, '#6fb5f6'], [0.485, '#a9d8fd'], [0.5, '#dff0ff'], [0.51, '#7fb55a'], [1, '#5a9a3a']];

function dayEnv(renderer) {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(SKY_STOPS), side: THREE.BackSide, toneMapped: false }));
  env.add(dome);
  const card = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  card(20, 14, 0xfff0d8, 5, [-20, 22, 22]); // Sonne, schräg von vorn links
  card(2.4, 30, GREEN, 3, [-30, 6, -14]); // CMB-Grün als Kontur
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  return tex;
}

/* Weiche Kreisfläche (Wolken, Sonnenschein) als Textur */
function softDot(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.45, outer); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Wiese, Garten, Himmel und Sonne. Alles aus Code, keine Fremdbilder. */
function makeWorld(scene) {
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const world = new THREE.Group();
  scene.add(world);

  // Wiese mit Farbflecken
  const gc = document.createElement('canvas');
  gc.width = gc.height = 512;
  const gx = gc.getContext('2d');
  gx.fillStyle = '#5fa534'; gx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    gx.fillStyle = `rgba(${rnd() < 0.5 ? '40,120,30' : '130,190,60'},${0.08 + rnd() * 0.14})`;
    const r = 6 + rnd() * 34;
    gx.beginPath(); gx.arc(rnd() * 512, rnd() * 512, r, 0, 7); gx.fill();
  }
  for (let i = 0; i < 5000; i++) {
    gx.strokeStyle = `rgba(${rnd() < 0.5 ? '35,110,25' : '160,210,80'},.35)`;
    const px = rnd() * 512, py = rnd() * 512;
    gx.beginPath(); gx.moveTo(px, py); gx.lineTo(px + rnd() * 3 - 1.5, py - 3 - rnd() * 5); gx.stroke();
  }
  const gtex = new THREE.CanvasTexture(gc);
  gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping;
  gtex.repeat.set(26, 26);
  gtex.colorSpace = THREE.SRGBColorSpace;
  gtex.anisotropy = 4;
  const meadow = new THREE.Mesh(new THREE.CircleGeometry(190, 64), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1, metalness: 0, envMapIntensity: 0.55 }));
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.y = -0.02;
  world.add(meadow);

  const mat = (color, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true, envMapIntensity: 0.6 });

  // Hügel am Horizont
  const hillGeo = new THREE.SphereGeometry(1, 24, 12);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3, d = 96 + rnd() * 26, r = 20 + rnd() * 16;
    const h = new THREE.Mesh(hillGeo, mat(i % 2 ? 0x4c8a38 : 0x58a040, 1));
    h.scale.set(r * 1.5, r * 0.34, r * 1.2);
    h.position.set(Math.sin(a) * d, -1, Math.cos(a) * d);
    world.add(h);
  }

  // Bäume weit hinten und an den Seiten (blockieren nie die Sicht aufs Haus)
  const trunk = new THREE.CylinderGeometry(0.28, 0.4, 3, 8);
  const crown = new THREE.IcosahedronGeometry(1, 1);
  const fir = new THREE.ConeGeometry(1, 1, 8);
  const trunkM = mat(0x6b4a2e), crownM = [mat(0x3f9a30), mat(0x4aa83a), mat(0x2f8a2c)], firM = mat(0x2f7a38);
  const tree = (x, z, s, kind) => {
    const g = new THREE.Group();
    if (kind === 0) {
      const t = new THREE.Mesh(trunk, trunkM); t.position.y = 1.5; g.add(t);
      [[0, 4.6, 0, 2.6], [1.4, 3.7, 0.4, 1.8], [-1.3, 3.9, -0.5, 1.9]].forEach(([cx, cy, cz, r], i) => {
        const c = new THREE.Mesh(crown, crownM[i % 3]); c.scale.setScalar(r); c.position.set(cx, cy, cz); g.add(c);
      });
    } else {
      const t = new THREE.Mesh(trunk, trunkM); t.position.y = 1; t.scale.set(0.7, 0.7, 0.7); g.add(t);
      [[0, 3, 2.4, 3], [0, 5, 1.9, 2.6], [0, 6.9, 1.4, 2.2]].forEach(([, cy, r, h]) => {
        const c = new THREE.Mesh(fir, firM); c.scale.set(r, h, r); c.position.y = cy; g.add(c);
      });
    }
    g.scale.setScalar(s); g.position.set(x, 0, z); g.rotation.y = rnd() * 6;
    world.add(g);
  };
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.12, d = 60 + rnd() * 34;
    tree(Math.sin(a) * d, Math.cos(a) * d, 0.9 + rnd() * 0.9, rnd() < 0.72 ? 0 : 1);
  }

  // Büsche und Hecken, niedrig
  const bush = new THREE.IcosahedronGeometry(1, 1);
  [[-9.5, -3, 1.5], [9.8, -4, 1.7], [-10.5, 6, 1.2], [10.6, 7, 1.3], [-6, -10, 1.8], [7, -11, 1.6], [0, -13, 2]].forEach(([x, z, r], i) => {
    const m = new THREE.Mesh(bush, crownM[i % 3]); m.scale.set(r, r * 0.8, r); m.position.set(x, r * 0.55, z); world.add(m);
  });

  // Blumenbeete vor dem Haus
  const bedM = mat(0x5a3b25, 1);
  [-1, 1].forEach((s) => {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 1.5), bedM);
    bed.position.set(s * 4.1, 0.13, 6.2); world.add(bed);
  });
  const petals = [0xff5a5f, 0xffc933, 0xff8fb8, 0xffffff, 0xb36bff];
  const flower = new THREE.IcosahedronGeometry(0.17, 0);
  const fl = new THREE.InstancedMesh(flower, new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), 360);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < 360; i++) {
    let x, z;
    if (i < 130) { x = (i % 2 ? 1 : -1) * (4.1 + (rnd() - 0.5) * 4.2); z = 6.2 + (rnd() - 0.5) * 1.2; }
    else { const a = rnd() * 6.283, d = 10 + rnd() * 30; x = Math.sin(a) * d; z = Math.cos(a) * d; if (Math.abs(x) < 9 && Math.abs(z) < 7) { x += 14; } }
    m4.makeScale(1, 1, 1); m4.setPosition(x, i < 130 ? 0.42 : 0.12, z);
    fl.setMatrixAt(i, m4); fl.setColorAt(i, col.set(petals[(rnd() * 5) | 0]));
  }
  world.add(fl);

  // Gartenweg zur Haustür (Trittplatten)
  const stone = mat(0xd9d3c7, 0.8);
  const slab = new THREE.CylinderGeometry(0.62, 0.66, 0.1, 10);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(slab, stone);
    m.position.set(Math.sin(i * 0.7) * 0.45, 0.04, 6.2 + i * 1.5); m.scale.set(1, 1, 0.8); world.add(m);
  }

  // Weißer Gartenzaun (Latten instanziert), vorn mit Lücke für den Weg
  const pick = new THREE.BoxGeometry(0.18, 1.05, 0.06);
  const post = [];
  const edge = (x0, z0, x1, z1) => {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.55);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (z > 15.5 && Math.abs(x) < 1.6) continue;
      post.push([x, z, Math.atan2(x1 - x0, z1 - z0)]);
    }
  };
  edge(-17, -15, 17, -15); edge(17, -15, 17, 17); edge(-17, 17, -17, -15); edge(-17, 17, 17, 17);
  const fence = new THREE.InstancedMesh(pick, new THREE.MeshStandardMaterial({ color: 0xe9e5db, roughness: 0.8 }), post.length);
  post.forEach(([x, z, r], i) => { m4.makeRotationY(r); m4.setPosition(x, 0.52, z); fence.setMatrixAt(i, m4); });
  world.add(fence);

  // Grashalme und Wildblumen im Hintergrund
  const tuft = new THREE.ConeGeometry(0.09, 0.5, 4);
  const tufts = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: 0x6cb83a, roughness: 1, flatShading: true }), 1400);
  for (let i = 0; i < 1400; i++) {
    const a = rnd() * 6.283, d = 6 + Math.sqrt(rnd()) * 50;
    m4.makeScale(1, 0.6 + rnd() * 1.2, 1); m4.setPosition(Math.sin(a) * d, 0.2, Math.cos(a) * d); tufts.setMatrixAt(i, m4);
  }
  world.add(tufts);

  // Himmelskuppel, Sonne und Wolken: folgen der Kamera, drehen sich mit ihrem Blickwinkel
  const sky = new THREE.Group();
  scene.add(sky);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(170, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(SKY_STOPS), side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10;
  scene.add(dome);
  const sunDir = new THREE.Vector3(-0.3, 0.15, -0.95).normalize();
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2c2).multiplyScalar(5), fog: false }));
  sun.position.copy(sunDir).multiplyScalar(150);
  sky.add(sun);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(255,244,200,.95)', 'rgba(255,230,150,.35)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  glow.scale.setScalar(78); glow.position.copy(sun.position); sky.add(glow);
  const cloudMap = softDot('rgba(255,255,255,.95)', 'rgba(255,255,255,.55)');
  [[-0.9, 0.34, -0.5, 46, 15], [-0.15, 0.3, -1, 58, 17], [0.6, 0.38, -0.8, 50, 14], [0.95, 0.27, -0.2, 44, 12], [-0.62, 0.22, -0.9, 34, 10], [0.2, 0.46, -0.9, 38, 11]].forEach(([x, y, z, w, h]) => {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudMap, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    c.position.set(x, y, z).normalize().multiplyScalar(140); c.scale.set(w, h, 1); sky.add(c);
  });

  // Sonnenlicht, kommt immer von schräg vorn links oben (relativ zur Kamera)
  const lights = new THREE.Group();
  scene.add(lights);
  const sunLight = new THREE.DirectionalLight(0xfff1d4, 1.5);
  sunLight.position.set(-16, 22, 26);
  lights.add(sunLight);
  const target = new THREE.Object3D();
  target.position.set(0, 3, 0);
  scene.add(target); sunLight.target = target;
  const fill = new THREE.HemisphereLight(0xbfe0ff, 0x6fae4a, 0.45);
  scene.add(fill);

  return { sky, dome, lights };
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
  renderer.toneMappingExposure = 0.88;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdff0ff);
  scene.fog = new THREE.Fog(0xcfe6fb, 110, 330);
  scene.environment = dayEnv(renderer);
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const { root, layers, heart } = build();
  scene.add(root);

  // Wiese, Garten, Himmel, Sonne
  const world = makeWorld(scene);
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
  const heartLight = new THREE.PointLight(0x7ad21e, 2.5, 10, 2);
  heartLight.position.set(0, 7.65, 5.2);
  scene.add(heartLight);

  // Postprocessing
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.4, 0.55, 1.0);
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
    { id: 'beat-hero', frame: 15.5, az: 26, el: -1, t: [0, 5.6, 0], off: 0.2, e: 0, ts: 1 },
    { id: 'beat-close', frame: 3.8, az: 6, el: 5, t: [0, 7.7, 3.5], off: 0.3, e: 0, ts: 0.22 },
    { id: 'beat-apart', frame: 26, az: -22, el: 7, t: [0, 8.6, 0], off: 0.1, e: 1, ts: 1 },
    { id: 'beat-around', frame: 26, az: 150, el: 12, t: [0, 8.6, 0], off: 0.1, e: 1, ts: 1 },
    { id: 'beat-outro', frame: 16.5, az: 330, el: 0, t: [0, 5.4, 0], off: -0.2, e: 0, ts: 1 },
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
    heart.material.emissiveIntensity = 0.7 + 0.9 * s;
    heart.scale.setScalar(1 + 0.07 * s);
    heartLight.intensity = 2.5 + 6 * s;
    heartLight.position.set(0, layers[3].group.position.y + heart.position.y, heart.position.z + 1.8);

    placeCamera(cur);
    world.sky.rotation.y = rad(cur.az); world.lights.rotation.y = rad(cur.az);
    world.sky.position.copy(camera.position); world.dome.position.copy(camera.position);
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
