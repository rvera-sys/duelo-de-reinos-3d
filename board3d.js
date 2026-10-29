/* Duelo de Reinos — tablero 3D (WebGL) */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const TW = 1.2;                     // ancho de casilla lateral
const TD = 2.2;                     // profundidad del anillo (lado de la esquina)
let S = 17;                         // casillas por lado, contando una esquina
let EDGE = TD + ((S - 2) * TW) / 2; // semiancho del tablero
let HALF_C = EDGE - TD;             // semiancho del centro
let layoutN = 0;                    // N con el que se construyó la base

const api = function () { return window.__b3 || {}; };
const state = function () { const a = api(); return a.G ? a.G() : null; };

/* ---------- CSS: el tablero DOM queda solo como fuente de datos ---------- */
const css = document.createElement('style');
css.textContent = `
.board-scene{height:min(calc(100vh - 168px),86vw)!important;min-height:320px;overflow:hidden}
.board-wrap{display:none!important}
#gl3d{position:fixed;left:0;top:0;width:100vw;height:calc(100vh - 96px);min-height:340px;pointer-events:auto;z-index:2;display:block;touch-action:pan-y}
#gl3d.hide{display:none}
body.gl3d-on .wrap{position:relative;z-index:3;pointer-events:none}
body.gl3d-on .wrap [data-act],body.gl3d-on .wrap button,body.gl3d-on .wrap input,body.gl3d-on .wrap select,body.gl3d-on .wrap textarea,body.gl3d-on .wrap a{pointer-events:auto}
`;
document.head.appendChild(css);

const canvas = document.createElement('canvas');
canvas.id = 'gl3d';
canvas.className = 'hide';
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, 1, 0.4, 200);

/* ---------- luces ---------- */
const key = new THREE.DirectionalLight(0xfff1d2, 2.5);
key.position.set(-10, 22, 14);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0007;
key.shadow.normalBias = 0.02;
key.shadow.camera.left = -14;
key.shadow.camera.right = 14;
key.shadow.camera.top = 14;
key.shadow.camera.bottom = -14;
scene.add(key);

const fill = new THREE.DirectionalLight(0x8b9be0, 0.5);
fill.position.set(12, 9, -13);
scene.add(fill);

scene.add(new THREE.HemisphereLight(0xffd9a0, 0x0e0a1f, 0.7));

/* ---------- mesa ---------- */
const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4d22, roughness: 0.66, metalness: 0.06 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0ad63, roughness: 0.3, metalness: 0.8 });
const feltMat = new THREE.MeshStandardMaterial({ color: 0x161033, roughness: 0.96, metalness: 0 });

const board = new THREE.Group();
scene.add(board);

const baseGroup = new THREE.Group();
board.add(baseGroup);
const centerTexture = makeCenterTexture();

function buildBase() {
  while (baseGroup.children.length) {
    const c = baseGroup.children.pop();
    baseGroup.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material && c.material !== woodMat && c.material !== rimMat && c.material !== feltMat) c.material.dispose();
  }

  const frame = new THREE.Mesh(new THREE.BoxGeometry(EDGE * 2 + 0.9, 0.62, EDGE * 2 + 0.9), woodMat);
  frame.position.y = -0.31;
  frame.receiveShadow = true;
  frame.castShadow = true;
  baseGroup.add(frame);

  const rim = new THREE.Mesh(new THREE.BoxGeometry(EDGE * 2 + 0.34, 0.16, EDGE * 2 + 0.34), rimMat);
  rim.position.y = 0.0;
  rim.receiveShadow = true;
  baseGroup.add(rim);

  const felt = new THREE.Mesh(new THREE.BoxGeometry(EDGE * 2, 0.3, EDGE * 2), feltMat);
  felt.position.y = -0.02;
  felt.receiveShadow = true;
  baseGroup.add(felt);

  const centerSize = HALF_C * 2;
  const centerTop = new THREE.Mesh(
    new THREE.PlaneGeometry(centerSize * 0.99, centerSize * 0.99),
    new THREE.MeshStandardMaterial({ map: centerTexture, transparent: true, roughness: 0.85, metalness: 0.1 })
  );
  centerTop.rotation.x = -Math.PI / 2;
  centerTop.position.y = 0.13;
  baseGroup.add(centerTop);
}

/* ---------- geometría de casillas ---------- */
function ensureLayout(N) {
  if (N === layoutN) return;
  S = N;
  EDGE = TD + ((S - 2) * TW) / 2;
  HALF_C = EDGE - TD;
  layoutN = N;
  buildBase();
}

/* Anillo: esquinas del lado TD y casillas laterales de TW de ancho x TD de fondo.
   Todas las piezas comparten el mismo borde exterior, así el anillo cierra prolijo. */
function tileFrame(i, N) {
  const perSide = N - 1;                 // casillas por lado contando una esquina
  const k = perSide - 1;                 // casillas laterales entre las dos esquinas
  const seg = Math.floor(i / perSide), off = i % perSide;
  const dOut = EDGE - TD / 2;            // distancia del centro a la línea de casillas
  const start = -(k * TW) / 2 + TW / 2;  // centro de la primera casilla lateral
  const cw = TD, cd = TD;                // cara de esquina
  const sw = TW, sd = TD;                // cara lateral

  if (off === 0) {
    if (seg === 0) return { x: dOut, z: dOut, w: cw, d: cd, rot: 0, corner: true, nx: 1, nz: 1 };
    if (seg === 1) return { x: -dOut, z: dOut, w: cw, d: cd, rot: 0, corner: true, nx: -1, nz: 1 };
    if (seg === 2) return { x: -dOut, z: -dOut, w: cw, d: cd, rot: 0, corner: true, nx: -1, nz: -1 };
    return { x: dOut, z: -dOut, w: cw, d: cd, rot: 0, corner: true, nx: 1, nz: -1 };
  }

  const j = off - 1;
  if (seg === 0) return { x: start + (k - 1 - j) * TW, z: dOut, w: sw, d: sd, rot: 0, corner: false, nx: 0, nz: 1 };
  if (seg === 1) return { x: -dOut, z: start + (k - 1 - j) * TW, w: sw, d: sd, rot: -Math.PI / 2, corner: false, nx: -1, nz: 0 };
  if (seg === 2) return { x: start + j * TW, z: -dOut, w: sw, d: sd, rot: Math.PI, corner: false, nx: 0, nz: -1 };
  return { x: dOut, z: start + j * TW, w: sw, d: sd, rot: Math.PI / 2, corner: false, nx: 1, nz: 0 };
}

function signature() {
  const G = state();
  if (!G || !G.board) return '';
  let s = G.inspect + '#' + G.turn + '#';
  for (let i = 0; i < G.board.length; i++) {
    const q = G.board[i];
    s += (q.owner == null ? '-' : q.owner) + q.level + (q.curse ? 'c' : '') + (q.reserved ? 'r' : '') + '.';
  }
  return s;
}

/* ---------- texturas de casilla ---------- */
const texCache = {};
const imgCache = {};
let dirty = true;

function shadeQ(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return '#' + c.getHexString();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrapText(g, text, x, y, maxW, lh, maxLines) {
  const words = String(text || '').split(' ');
  let line = '', lines = [];
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
    else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += '…'; }
  lines.forEach(function (l, i) { g.fillText(l, x, y + i * lh); });
}

function spriteSrcFor(i) {
  const img = document.querySelector('[data-act="tile"][data-i="' + i + '"] .aw img');
  if (!img) return null;
  const k = img.getAttribute('data-k');
  const SPR = api().SPR;
  if (k && SPR && SPR[k] && SPR[k].still) return SPR[k].still;
  return img.getAttribute('src');
}

function tileTexture(sq, i, w, d) {
  const G = state();
  const sel = G && G.inspect === i;
  const owned = sq.owner !== null && sq.owner !== undefined;
  const ck = i + ':' + (owned ? sq.owner : '-') + ':' + sq.level + ':' + (sel ? 1 : 0) +
    ':' + (sq.curse ? 'c' : '') + ':' + (sq.reserved ? 'r' : '') + ':' + (sq.t === 'prop' ? 1 : 0);
  if (texCache[ck]) return texCache[ck];

  const PPU = 260;
  const W = Math.round(PPU * Math.min(w, d));
  const H = Math.round(PPU * Math.max(w, d));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const L = Math.min(W, H);        // lado corto, para escalar tipografía

  const isProp = sq.t === 'prop';
  const ATTRS = api().ATTRS || {};
  const SPECIAL = api().SPECIAL || {};
  const col = isProp ? (ATTRS[sq.attr] || {}).color || '#b8722f' : SPECIAL[sq.t] || '#6d5520';
  const a = api();

  // cara de cartón claro
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#fdf5e0');
  grd.addColorStop(0.55, '#f0e0ba');
  grd.addColorStop(1, '#d9c194');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);

  g.strokeStyle = 'rgba(74,48,16,.5)';
  g.lineWidth = L * 0.022;
  g.strokeRect(L * 0.011, L * 0.011, W - L * 0.022, H - L * 0.022);

  g.textAlign = 'center';
  g.textBaseline = 'middle';

  // ---- banda de nombre, en el borde exterior ----
  const bandH = L * 0.32;
  const bandY = H - bandH - L * 0.035;
  g.fillStyle = col;
  g.fillRect(L * 0.03, bandY, W - L * 0.06, bandH);
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.fillRect(L * 0.03, bandY, W - L * 0.06, L * 0.014);
  g.fillStyle = 'rgba(255,255,255,.18)';
  g.fillRect(L * 0.03, bandY + bandH - L * 0.012, W - L * 0.06, L * 0.012);

  g.fillStyle = '#fffaf0';
  g.font = '800 ' + Math.round(L * 0.155) + 'px "Alegreya Sans","Segoe UI",Arial,sans-serif';
  wrapText(g, sq.name, W / 2, bandY + bandH * 0.44, W - L * 0.16, L * 0.165, 2);

  // ---- pie: ATK / tipo ----
  const footH = L * 0.19;
  const footY = bandY - footH - L * 0.02;
  g.fillStyle = 'rgba(38,20,4,.9)';
  roundRect(g, L * 0.06, footY, W - L * 0.12, footH, L * 0.035);
  g.fill();
  g.fillStyle = '#ffdf9c';
  g.font = '800 ' + Math.round(L * 0.125) + 'px "Alegreya Sans",Arial,sans-serif';
  const foot = isProp
    ? 'ATK ' + (a.fmt ? a.fmt(owned ? a.guardAtk(sq) : sq.atk) : sq.atk)
    : String((a.KIND || {})[sq.t] || '').toUpperCase();
  g.fillText(foot, W / 2, footY + footH * 0.54, W - L * 0.2);

  // ---- arte, hacia el centro ----
  const ax = L * 0.075, ay = L * 0.075;
  const aw = W - L * 0.15, ah = footY - ay - L * 0.03;
  g.fillStyle = '#0a0618';
  roundRect(g, ax, ay, aw, ah, L * 0.04);
  g.fill();

  const halo = g.createRadialGradient(ax + aw / 2, ay + ah * 0.5, L * 0.02, ax + aw / 2, ay + ah * 0.5, Math.max(aw, ah) * 0.62);
  halo.addColorStop(0, shadeQ(col, 0.95));
  halo.addColorStop(1, 'rgba(10,6,24,0)');
  g.save();
  roundRect(g, ax, ay, aw, ah, L * 0.04);
  g.clip();
  g.globalAlpha = 0.5;
  g.fillStyle = halo;
  g.fillRect(ax, ay, aw, ah);
  g.globalAlpha = 1;

  if (isProp) {
    const src = spriteSrcFor(i);
    if (src) {
      let im = imgCache[src];
      if (!im) {
        im = imgCache[src] = new Image();
        im.onload = function () { dirty = true; };
        im.src = src;
      }
      if (im.complete && im.naturalWidth) {
        const pad = L * 0.04;
        const k = Math.min((aw - pad * 2) / im.naturalWidth, (ah - pad * 2) / im.naturalHeight);
        const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(im, ax + (aw - dw) / 2, ay + (ah - dh) / 2, dw, dh);
      }
    }
  } else {
    const cx = ax + aw / 2, cy = ay + ah * 0.5;
    const r = Math.min(aw, ah) * 0.24;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,240,200,.13)';
    g.fill();
    g.strokeStyle = 'rgba(255,225,160,.55)';
    g.lineWidth = L * 0.014;
    g.stroke();
    g.fillStyle = 'rgba(255,240,200,.95)';
    g.font = '900 ' + Math.round(r * 1.2) + 'px "Cinzel",Georgia,serif';
    g.fillText((sq.name || '?').charAt(0).toUpperCase(), cx, cy + r * 0.08);
  }
  g.restore();

  g.strokeStyle = 'rgba(227,200,120,.6)';
  g.lineWidth = L * 0.012;
  roundRect(g, ax, ay, aw, ah, L * 0.04);
  g.stroke();

  if (isProp) {
    const lv = sq.level || 1;
    g.font = '700 ' + Math.round(L * 0.105) + 'px Arial';
    g.textAlign = 'right';
    g.fillStyle = '#ffcf66';
    g.fillText(new Array(lv + 1).join('★'), ax + aw - L * 0.05, ay + L * 0.075);
    g.textAlign = 'center';
  }

  if (isProp && !owned) {
    g.fillStyle = '#f0c24f';
    roundRect(g, ax + L * 0.03, ay + ah - L * 0.21, aw - L * 0.06, L * 0.18, L * 0.03);
    g.fill();
    g.fillStyle = '#1d1204';
    g.font = '800 ' + Math.round(L * 0.125) + 'px "Alegreya Sans",Arial,sans-serif';
    g.fillText(a.curPrice ? a.fmt(a.curPrice(sq)) : String(sq.price), ax + aw / 2, ay + ah - L * 0.115);
  }

  if (sel) {
    g.strokeStyle = '#ffd878';
    g.lineWidth = L * 0.035;
    g.strokeRect(L * 0.018, L * 0.018, W - L * 0.036, H - L * 0.036);
  }
  if (owned) {
    g.strokeStyle = G.players[sq.owner].color || '#f0c24f';
    g.lineWidth = L * 0.05;
    g.strokeRect(L * 0.025, L * 0.025, W - L * 0.05, H - L * 0.05);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (Object.keys(texCache).length > 420) {
    Object.keys(texCache).forEach(function (k) { texCache[k].dispose(); delete texCache[k]; });
  }
  texCache[ck] = tex;
  return tex;
}

function makeCenterTexture() {
  const W = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, W, W);
  const C = W / 2;

  g.save();
  g.translate(C, C);
  for (let k = 0; k < 48; k++) {
    g.rotate(Math.PI / 24);
    g.fillStyle = k % 2 ? 'rgba(243,200,110,.075)' : 'rgba(243,200,110,.035)';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -W * 0.72);
    g.lineTo(W * 0.03, -W * 0.72);
    g.closePath();
    g.fill();
  }
  g.restore();

  g.strokeStyle = 'rgba(243,200,110,.5)';
  g.lineWidth = W * 0.006;
  g.beginPath(); g.arc(C, C, W * 0.45, 0, Math.PI * 2); g.stroke();
  g.lineWidth = W * 0.008;
  g.setLineDash([W * 0.01, W * 0.022]);
  g.beginPath(); g.arc(C, C, W * 0.38, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  g.lineWidth = W * 0.004;
  g.beginPath(); g.arc(C, C, W * 0.24, 0, Math.PI * 2); g.stroke();

  g.fillStyle = 'rgba(243,200,110,.8)';
  const w = W * 0.1, cy = C - W * 0.02;
  g.beginPath();
  g.moveTo(C - w, cy + W * 0.045);
  g.lineTo(C - w, cy - W * 0.022);
  g.lineTo(C - w / 2, cy + W * 0.011);
  g.lineTo(C, cy - W * 0.046);
  g.lineTo(C + w / 2, cy + W * 0.011);
  g.lineTo(C + w, cy - W * 0.022);
  g.lineTo(C + w, cy + W * 0.045);
  g.closePath();
  g.fill();

  // título sobre el fieltro
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(243,200,110,.9)';
  g.font = '700 ' + Math.round(W * 0.058) + 'px "Cinzel",Georgia,serif';
  g.fillText('DUELO DE REINOS', C, C + W * 0.16);
  g.fillStyle = 'rgba(243,200,110,.42)';
  g.font = '600 ' + Math.round(W * 0.026) + 'px "Alegreya Sans",Arial,sans-serif';
  g.fillText('POZO DEL REINO', C, C + W * 0.222);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

/* ---------- casillas 3D ---------- */
const tilesGroup = new THREE.Group();
board.add(tilesGroup);
const sideMat = new THREE.MeshStandardMaterial({ color: 0xe4cd96, roughness: 0.55, metalness: 0.12 });
const tileMeshes = [];
let housesGroup = null;

function buildTiles() {
  const G = state();
  if (!G || !G.board) return;
  const N = G.board.length / 4 + 1;
  ensureLayout(N);
  tilesGroup.clear();
  tileMeshes.length = 0;
  if (housesGroup) { board.remove(housesGroup); housesGroup = null; }

  for (let i = 0; i < G.board.length; i++) {
    const sq = G.board[i];
    const t = tileFrame(i, N);
    const tex = tileTexture(sq, i, t.w, t.d);
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.05 });
    const geo = new THREE.BoxGeometry(t.w * 0.94, 0.36, t.d * 0.94);
    const mesh = new THREE.Mesh(geo, [sideMat, sideMat, faceMat, sideMat, sideMat, sideMat]);
    mesh.position.set(t.x, 0.1, t.z);
    mesh.rotation.y = t.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.idx = i;
    tilesGroup.add(mesh);
    tileMeshes.push(mesh);

    if (sq.t === 'prop' && sq.owner != null) {
      if (!housesGroup) { housesGroup = new THREE.Group(); board.add(housesGroup); }
      addHouses(housesGroup, sq, G.players[sq.owner], t);
    }
  }
}

function addHouses(parent, sq, owner, t) {
  const col = new THREE.Color(owner ? owner.color : '#f0c24f');
  const n = Math.min(Math.max(sq.level || 1, 1), 4);
  const scale = t.corner ? 1.25 : 1;
  for (let k = 0; k < n; k++) {
    const bw = 0.17 * scale, bh = 0.26 * scale + k * 0.03, bd = 0.17 * scale;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bw, bh, bd),
      new THREE.MeshStandardMaterial({ color: 0xf7edd6, roughness: 0.8 })
    );
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(bw * 0.95, 0.17 * scale, 4),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.15 })
    );
    roof.rotation.y = Math.PI / 4;
    const spread = t.corner ? 0.52 : 0.36;
    const bx = ((k % 2) ? 1 : -1) * spread * (k > 1 ? 0.55 : 1);
    const bz = (k > 1 ? 0.42 : -0.34) * (t.corner ? 1.1 : 1);
    body.position.set(bx, bh / 2, bz);
    roof.position.set(bx, bh + 0.075 * scale, bz);
    body.castShadow = true;
    roof.castShadow = true;
    const grp = new THREE.Group();
    grp.add(body, roof);
    grp.position.set(t.x, 0.28, t.z);
    grp.rotation.y = t.rot;
    parent.add(grp);
  }
}

/* ---------- peones ---------- */
const pawnsGroup = new THREE.Group();
board.add(pawnsGroup);
const pawns = {};

function makePawn(color, hero) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.36, metalness: 0.3 });
  const glow = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.3, metalness: 0.5, emissive: new THREE.Color(color), emissiveIntensity: 0.28 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.07, 24), mat);
  base.position.y = 0.035;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.185, 0.24, 24), mat);
  body.position.y = 0.19;
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 10, 20), glow);
  neck.rotation.x = Math.PI / 2;
  neck.position.y = 0.32;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 24, 18), mat);
  head.position.y = 0.46;
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 12), glow);
  crest.position.y = 0.61;
  [base, body, head, neck, crest].forEach(function (m) { m.castShadow = true; m.receiveShadow = true; });
  g.add(base, body, neck, head, crest);
  return g;
}

function syncPawns() {
  const G = state();
  if (!G || !G.board) return;
  const N = G.board.length / 4 + 1;
  ensureLayout(N);
  for (let i = 0; i < G.players.length; i++) {
    const p = G.players[i];
    let obj = pawns[i];
    if (!obj) { obj = makePawn(p.color || '#fff'); pawns[i] = obj; pawnsGroup.add(obj); }
    obj.visible = !!p.alive;
    if (!p.alive) continue;
    const t = tileFrame(p.pos, N);
    const mates = G.players.filter(function (x) { return x.alive && x.pos === p.pos; });
    const k = mates.indexOf(p), n = Math.max(mates.length, 1);
    const ang = (k / n) * Math.PI * 2 - Math.PI / 2;
    const rad = n > 1 ? 0.34 : 0;
    obj.userData.tx = t.x + Math.cos(ang) * rad;
    obj.userData.tz = t.z + Math.sin(ang) * rad;
    obj.userData.ty = 0.28;
    obj.userData.lift = (G.turn === p.id) ? 0.06 : 0;
    if (obj.userData.placed !== true) {
      obj.position.set(obj.userData.tx, obj.userData.ty, obj.userData.tz);
      obj.userData.placed = true;
    }
  }
}

/* ---------- dados ---------- */
const diceGroup = new THREE.Group();
board.add(diceGroup);
const pipTex = {};
function pipTexture(n) {
  if (pipTex[n]) return pipTex[n];
  const W = 128, cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const g = cv.getContext('2d');
  g.fillStyle = '#fdf8ec';
  g.fillRect(0, 0, W, W);
  g.strokeStyle = 'rgba(120,96,60,.25)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, W - 3, W - 3);
  const map = {
    1: [[0.5, 0.5]],
    2: [[0.29, 0.29], [0.71, 0.71]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.29, 0.29], [0.71, 0.29], [0.29, 0.71], [0.71, 0.71]],
    5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
    6: [[0.29, 0.24], [0.71, 0.24], [0.29, 0.5], [0.71, 0.5], [0.29, 0.76], [0.71, 0.76]]
  };
  g.fillStyle = '#241441';
  (map[n] || map[1]).forEach(function (p) {
    g.beginPath();
    g.arc(p[0] * W, p[1] * W, W * 0.082, 0, Math.PI * 2);
    g.fill();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  pipTex[n] = tex;
  return tex;
}

const OPP = { 1: 6, 6: 1, 2: 5, 5: 2, 3: 4, 4: 3 };
const DICE_Y = 1.5;
function makeDie(v) {
  const mats = [v, OPP[v], OPP[v], v, v, OPP[v]].map(function (x) {
    return new THREE.MeshStandardMaterial({ map: pipTexture(x), roughness: 0.4, metalness: 0.06 });
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), mats);
  m.castShadow = true;
  return m;
}

const dice = { a: null, b: null, sig: '', spin: 0 };

function syncDice() {
  const G = state();
  if (!G) return;
  const v1 = (G.dice && G.dice[0]) || 1, v2 = (G.dice && G.dice[1]) || 1;
  const sig = v1 + '-' + v2 + '-' + (G.rolling ? 1 : 0);
  if (sig === dice.sig) return;
  if (dice.a) { diceGroup.remove(dice.a); diceGroup.remove(dice.b); }
  dice.a = makeDie(v1);
  dice.b = makeDie(v2);
  dice.a.position.set(-3.4, DICE_Y, 6.2);
  dice.b.position.set(-2.0, DICE_Y, 7.2);
  diceGroup.add(dice.a, dice.b);
  dice.spin = G.rolling ? 1 : 0;
  dice.sig = sig;
}

/* ---------- raycast ---------- */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let down = null;

canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', function (e) {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 14) return;
  const r = canvas.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(tileMeshes, false)[0];
  if (!hit) return;
  const btn = document.querySelector('[data-act="tile"][data-i="' + hit.object.userData.idx + '"]');
  if (btn) btn.click();
});

/* ---------- cámara: encuadra la fila del jugador activo ---------- */
const camPos = new THREE.Vector3(9, 6, 12);
const camTgt = new THREE.Vector3(0, 0, 0);
const wantPos = new THREE.Vector3();
const wantTgt = new THREE.Vector3();
const ELEV = 0.45;    // altura de la cámara relativa a la distancia (~24°)
const FIT = 1.55;     // cuánto de la fila entra a lo ancho (1 = fila completa; >1 recorta)
const PAN = 3.4;      // cuánto acompaña al jugador a lo largo de la fila

// cuántas casillas de la fila entran a lo ancho: en vertical (celular) menos y más grandes
function fitFactor() {
  const rowLen = (S - 2) * TW + TD;
  const tiles = Math.max(4.5, Math.min(11, 3.2 + camera.aspect * 5.6));
  return Math.max(FIT, rowLen / (tiles * TW));
}

// distancia necesaria para que la fila entre a lo ancho, sea cual sea la ventana
function camDist() {
  const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
  const rowLen = (S - 2) * TW + TD;
  return Math.max(7, Math.min(34, rowLen / (2 * halfW * fitFactor())));
}

function rowFrame(seg) {
  const dOut = EDGE - TD / 2;
  if (seg === 0) return { cx: 0, cz: dOut, nx: 0, nz: 1, tx: -1, tz: 0 };
  if (seg === 1) return { cx: -dOut, cz: 0, nx: -1, nz: 0, tx: 0, tz: -1 };
  if (seg === 2) return { cx: 0, cz: -dOut, nx: 0, nz: -1, tx: 1, tz: 0 };
  return { cx: dOut, cz: 0, nx: 1, nz: 0, tx: 0, tz: 1 };
}

function focusPoint() {
  const G = state();
  if (!G || !G.board || !G.players) return null;
  const p = G.players[G.turn];
  if (!p || !p.alive) return null;
  const N = G.board.length / 4 + 1;
  ensureLayout(N);
  const t = tileFrame(p.pos, N);
  // fila por la que avanza el jugador (en las esquinas, la de salida)
  const perSide = N - 1;
  const seg = Math.floor(((p.pos + 1) % (4 * perSide)) / perSide);
  const r = rowFrame(seg);
  const o = (t.x - r.cx) * r.tx + (t.z - r.cz) * r.tz;
  // el paneo tiene que alcanzar para que la casilla del jugador no se salga del cuadro
  const rowLen = (S - 2) * TW + TD;
  const lim = Math.max(PAN, rowLen / 2 - (rowLen / fitFactor()) * 0.32);
  const s = Math.max(-lim, Math.min(lim, o));
  return {
    x: r.cx + r.tx * s, z: r.cz + r.tz * s,
    nx: r.nx, nz: r.nz, tx: r.tx, tz: r.tz
  };
}

function updateCamera(dt) {
  const f = focusPoint();
  const d = camDist();
  if (f) {
    wantPos.set(f.x + f.nx * d, d * ELEV, f.z + f.nz * d);
    wantTgt.set(f.x - f.nx * d * 0.18, 0.7, f.z - f.nz * d * 0.18);
  } else {
    wantPos.set(0, d * 1.15, d * 1.05);
    wantTgt.set(0, 0.2, 0);
  }
  const k = Math.min(1, dt * 2.6);
  camPos.lerp(wantPos, k);
  camTgt.lerp(wantTgt, k);
  camera.position.copy(camPos);
  camera.lookAt(camTgt);
}

/* ---------- loop ---------- */
const clk = new THREE.Clock();
let lastSig = '';

function fitCanvas() {
  const G0 = state();
  if (!G0 || !G0.board) { canvas.classList.add('hide'); document.body.classList.remove('gl3d-on'); return false; }
  canvas.classList.remove('hide');
  document.body.classList.add('gl3d-on');
  const w = Math.max(320, window.innerWidth);
  const vh = window.innerHeight;
  let top = 0, h = Math.max(340, vh - 96);
  // en pantallas angostas el lienzo ocupa solo la franja libre entre el marcador y la barra
  if (w < 700) {
    const strip = document.querySelector('.strip');
    const bar = document.querySelector('.bar');
    top = strip ? Math.max(0, strip.getBoundingClientRect().bottom + 4) : 0;
    const bot = bar ? Math.max(top + 240, bar.getBoundingClientRect().top - 4) : vh;
    h = Math.max(240, Math.min(vh - top, bot - top));
  }
  canvas.style.top = top + 'px';
  canvas.style.height = h + 'px';
  const pr = renderer.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  return true;
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clk.getDelta(), 0.05);
  if (!fitCanvas()) return;

  const G = state();
  if (G && G.board) {
    const sig = signature();
    if (sig !== lastSig || dirty) {
      lastSig = sig;
      dirty = false;
      buildTiles();
    }
    syncPawns();
    syncDice();
  }

  for (const id in pawns) {
    const p = pawns[id];
    if (!p.visible) continue;
    const k = Math.min(1, dt * 10);
    p.position.x += (p.userData.tx - p.position.x) * k;
    p.position.z += (p.userData.tz - p.position.z) * k;
    const d = Math.hypot(p.userData.tx - p.position.x, p.userData.tz - p.position.z);
    const hop = d > 0.04 ? Math.abs(Math.sin(performance.now() / 85)) * 0.16 : 0;
    p.position.y = p.userData.ty + hop + p.userData.lift;
  }

  if (dice.a) {
    const t = performance.now() / 1000;
    if (dice.spin > 0) {
      dice.spin = Math.max(0, dice.spin - dt * 1.3);
      dice.a.rotation.x += dt * 13; dice.a.rotation.y += dt * 10;
      dice.b.rotation.x += dt * 11; dice.b.rotation.y += dt * 14;
      dice.a.position.y = DICE_Y + Math.sin(t * 14) * 0.3;
      dice.b.position.y = DICE_Y + Math.cos(t * 15) * 0.3;
    } else {
      dice.a.rotation.x += (0.18 - dice.a.rotation.x) * dt * 4;
      dice.a.rotation.y += (0.42 - dice.a.rotation.y) * dt * 4;
      dice.b.rotation.x += (0.12 - dice.b.rotation.x) * dt * 4;
      dice.b.rotation.y += (-0.3 - dice.b.rotation.y) * dt * 4;
      dice.a.position.y += (DICE_Y - dice.a.position.y) * dt * 4;
      dice.b.position.y += (DICE_Y - dice.b.position.y) * dt * 4;
    }
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () { dirty = true; });
}

tick();
window.__b3d = { scene: scene, camera: camera, board: board, focus: focusPoint, frame: tileFrame, state: state };
