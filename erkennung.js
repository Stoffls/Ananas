// Ananas – Texterkennung der Rocket-League-Anzeigetafel
// Spaltenköpfe und Namen: Tesseract (kostenlos, läuft im Browser)
// Zahlen: eigene Ziffernerkennung (erkennt auch die durchgestrichene Null)
import { SPIELER, WERTE } from './logik.js';

const KOPF = ['PUNKTZAHL', 'TORE', 'VORLAGEN', 'PARADEN', 'SCHUSSE'];
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

// ---------- Tesseract laden ----------
let workerPromise = null;
function ladeSkript(src) {
  return new Promise((ok, fehler) => {
    if (window.Tesseract) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = () => ok(); s.onerror = () => fehler(new Error('Texterkennung konnte nicht geladen werden (Internet?)'));
    document.head.appendChild(s);
  });
}
async function holeWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      await ladeSkript(TESSERACT_URL);
      return await window.Tesseract.createWorker('eng');
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}
function woerterAus(data) {
  if (Array.isArray(data.words) && data.words.length) return data.words;
  const out = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const w of l.words || []) out.push(w);
  return out;
}
export const tesseractOcr = {
  async woerter(canvas, psm) {
    const w = await holeWorker();
    await w.setParameters({ tessedit_pageseg_mode: String(psm) });
    const { data } = await w.recognize(canvas, {}, { blocks: true, text: true });
    return {
      text: data.text || '',
      woerter: woerterAus(data).filter(x => x.text && x.text.trim()).map(x => ({ t: x.text, x: x.bbox.x0, y: x.bbox.y0, w: x.bbox.x1 - x.bbox.x0, h: x.bbox.y1 - x.bbox.y0 }))
    };
  }
};

// ---------- Hilfsfunktionen ----------
function levRatio(a, b) {
  if (!a.length && !b.length) return 1;
  const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}
const nurBuchstaben = s => s.toUpperCase().replace(/Ü/g, 'U').replace(/[^A-Z]/g, '');
const schluessel = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function median(a) { const s = [...a].sort((x, y) => x - y); const n = s.length; if (!n) return 0; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
function perzentil(a, p) { // wie numpy (linear)
  const s = Array.from(a).sort((x, y) => x - y); if (!s.length) return 0;
  const k = (s.length - 1) * p / 100, f = Math.floor(k), c = Math.min(f + 1, s.length - 1);
  return s[f] + (s[c] - s[f]) * (k - f);
}
function polyfit1(xs, ys) { // Steigung, Achsenabschnitt
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx ? sxy / sxx : 0; return [b, my - b * mx];
}
function otsu(werte) {
  const h = new Float64Array(256); for (const v of werte) h[v]++;
  const tot = werte.length; let s = 0; for (let i = 0; i < 256; i++) s += i * h[i];
  let sb = 0, wb = 0, best = -1, t = 128;
  for (let i = 0; i < 256; i++) {
    wb += h[i]; if (!wb) continue; const wf = tot - wb; if (!wf) break;
    sb += i * h[i]; const mb = sb / wb, mf = (s - sb) / wf, b = wb * wf * (mb - mf) ** 2;
    if (b > best) { best = b; t = i; }
  }
  return t;
}
// Zusammenhängende Bereiche (4er-Nachbarschaft)
function bereiche(mask, w, h) {
  const lab = new Int32Array(w * h); const comps = []; let n = 0; const st = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!mask[i] || lab[i]) continue;
    n++; lab[i] = n; st.push(i); let cnt = 0, y0 = y, y1 = y, x0 = x, x1 = x;
    while (st.length) {
      const j = st.pop(); cnt++; const a = (j / w) | 0, b = j - a * w;
      if (a < y0) y0 = a; if (a > y1) y1 = a; if (b < x0) x0 = b; if (b > x1) x1 = b;
      if (a + 1 < h && mask[j + w] && !lab[j + w]) { lab[j + w] = n; st.push(j + w); }
      if (a - 1 >= 0 && mask[j - w] && !lab[j - w]) { lab[j - w] = n; st.push(j - w); }
      if (b + 1 < w && mask[j + 1] && !lab[j + 1]) { lab[j + 1] = n; st.push(j + 1); }
      if (b - 1 >= 0 && mask[j - 1] && !lab[j - 1]) { lab[j - 1] = n; st.push(j - 1); }
    }
    comps.push({ n, area: cnt, y0, y1, x0, x1 });
  }
  return { lab, comps };
}

// ---------- Ziffer erkennen ----------
// g: Uint8Array (1 = Tinte), gw × gh
export function ziffer(g, gw, gh) {
  const size = gw * gh;
  const bg = new Uint8Array(size); for (let i = 0; i < size; i++) bg[i] = g[i] ? 0 : 1;
  const { comps } = bereiche(bg, gw, gh);
  let hs = [];
  for (const c of comps) {
    if (c.y0 > 0 && c.x0 > 0 && c.y1 < gh - 1 && c.x1 < gw - 1 && c.area > 0.008 * size)
      hs.push({ x: (c.x0 + c.x1) / 2 / gw, y: (c.y0 + c.y1) / 2 / gh, a: c.area / size, hh: (c.y1 - c.y0 + 1) / gh });
  }
  if (hs.length >= 2) {
    hs = hs.sort((p, q) => q.a - p.a).slice(0, 2);
    const dx = Math.abs(hs[0].x - hs[1].x), dy = Math.abs(hs[0].y - hs[1].y);
    return dy > dx * 1.5 && dy > 0.25 ? '8' : '0';
  }
  if (hs.length === 1) {
    const { y, hh } = hs[0];
    if (hh > 0.55) return '0';
    if (y < 0.4) return '9';
    if (y > 0.58) return '6';
    return '4';
  }
  const ya = Math.floor(0.1 * gh), yb = Math.floor(0.9 * gh);
  const voll = [];
  for (let x = 0; x < gw; x++) {
    let s = 0, n = 0; for (let y = ya; y <= yb && y < gh; y++) { s += g[y * gw + x]; n++; }
    if (n && s / n >= 0.9) voll.push(x);
  }
  if (voll.length) { const m = (voll.reduce((a, b) => a + b, 0) / voll.length + 0.5) / gw; if (m >= 0.2 && m <= 0.7) return '1'; }
  const tinte = (yf, x0f, x1f) => {
    const yy = Math.floor(yf * (gh - 1)); const ys = Math.max(0, yy - 1), ye = Math.min(gh, yy + 2);
    const xa = Math.floor(x0f * gw), xb = Math.max(xa + 1, Math.round(x1f * gw));
    let s = 0, n = 0; for (let y = ys; y < ye; y++) for (let x = xa; x < xb && x < gw; x++) { s += g[y * gw + x]; n++; }
    return n ? s / n > 0.3 : false;
  };
  if (!tinte(0.75, 0.67, 1)) return tinte(0.95, 0.67, 1) ? '2' : '7';
  const s3 = (tinte(0.25, 0.67, 1) ? 1 : 0) + (tinte(0.5, 0, 0.33) ? 0 : 1);
  const s5 = (tinte(0.25, 0.67, 1) ? 0 : 1) + (tinte(0.5, 0, 0.33) ? 1 : 0);
  return s5 > s3 ? '5' : '3';
}

// ---------- Hauptfunktion ----------
// quelle: File/Blob oder HTMLImageElement/Canvas; ocr: Erkennungs-Anbieter (Standard Tesseract)
export async function erkenneFoto(quelle, fortschritt = () => {}, ocr = tesseractOcr) {
  fortschritt('Foto wird vorbereitet …');
  const bild = await ladeBild(quelle);
  const f = Math.min(1, 2000 / Math.max(bild.width, bild.height));
  const BW = Math.round(bild.width * f), BH = Math.round(bild.height * f);
  const cv = document.createElement('canvas'); cv.width = BW; cv.height = BH;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bild, 0, 0, BW, BH);
  const px = ctx.getImageData(0, 0, BW, BH).data;
  const W = new Uint8Array(BW * BH), G = new Uint8Array(BW * BH);
  for (let i = 0, j = 0; i < W.length; i++, j += 4) { const r = px[j], g = px[j + 1], b = px[j + 2]; G[i] = g; W[i] = r < g ? (r < b ? r : b) : (g < b ? g : b); }

  const grauCanvas = (arr, x0, y0, w, h, invert, skal) => {
    const c = document.createElement('canvas'); c.width = Math.round(w * skal); c.height = Math.round(h * skal);
    const t = document.createElement('canvas'); t.width = w; t.height = h;
    const tc = t.getContext('2d'); const id = tc.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = arr[(y0 + y) * BW + x0 + x]; if (invert) v = 255 - v;
      const k = (y * w + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255;
    }
    tc.putImageData(id, 0, 0);
    const cc = c.getContext('2d'); cc.imageSmoothingQuality = 'high'; cc.drawImage(t, 0, 0, c.width, c.height);
    return c;
  };

  // 1) Spaltenköpfe finden
  fortschritt('Spaltenköpfe werden gesucht …');
  const seite = await ocr.woerter(grauCanvas(G, 0, 0, BW, BH, false, 1), 11);
  const treffer = [];
  for (const w of seite.woerter) {
    const n = nurBuchstaben(w.t); if (n.length < 3) continue;
    for (let i = 0; i < KOPF.length; i++) {
      const k = KOPF[i];
      if (levRatio(n, k) >= (k.length <= 4 ? 0.75 : 0.7) || (n.length >= k.length && n.includes(k))) { treffer.push({ i, w }); break; }
    }
  }
  treffer.sort((a, b) => a.w.y - b.w.y);
  let gruppen = [];
  for (const t of treffer) {
    const yc = t.w.y + t.w.h / 2;
    const g = gruppen.find(g => Math.abs(g.y - yc) < Math.max(25, 2 * g.h));
    if (g) g.m.push(t); else gruppen.push({ y: yc, h: t.w.h, m: [t] });
  }
  for (const g of gruppen) {
    g.pts = {}; for (const { i, w } of g.m) if (!(i in g.pts)) g.pts[i] = w.x + w.w / 2;
    g.y = median(g.m.map(({ w }) => w.y + w.h / 2));
    const hs = g.m.filter(({ i }) => i < 4).map(({ w }) => w.h);
    g.h = hs.length ? perzentil(hs, 25) : 20;
  }
  gruppen = gruppen.filter(g => Object.keys(g.pts).length >= 2);
  if (!gruppen.length) return { zeilen: [], hinweise: ['Die Spaltenköpfe (Punktzahl, Tore …) wurden nicht gefunden. Bitte die Werte von Hand eintragen oder ein schärferes, geraderes Foto verwenden.'] };
  const beste = gruppen.reduce((a, b) => Object.keys(b.pts).length > Object.keys(a.pts).length ? b : a);
  const ks = Object.keys(beste.pts).map(Number);
  const [B] = polyfit1(ks, ks.map(i => beste.pts[i]));
  for (const g of gruppen) g.b = B, g.a = median(Object.entries(g.pts).map(([i, x]) => x - B * Number(i)));
  gruppen.sort((a, b) => a.y - b.y);

  // Zelle lesen
  const leseZelle = (xc, yc, hw, hh, lo = 0.75, hi = 1.35) => {
    const x0 = Math.max(0, Math.floor(xc - hw)), x1 = Math.min(BW, Math.floor(xc + hw));
    const y0 = Math.max(0, Math.floor(yc - 1.5 * hh)), y1 = Math.min(BH, Math.floor(yc + 1.5 * hh));
    const w = x1 - x0, h = y1 - y0; if (w <= 2 || h <= 2) return null;
    const zelle = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) zelle[y * w + x] = W[(y0 + y) * BW + x0 + x];
    let t = otsu(zelle); t = t + 0.25 * (perzentil(zelle, 97) - t);
    const mask = new Uint8Array(w * h); for (let i = 0; i < mask.length; i++) mask[i] = zelle[i] > t ? 1 : 0;
    const { lab, comps } = bereiche(mask, w, h);
    const gl = comps.filter(c => { const ch = c.y1 - c.y0 + 1; return ch >= lo * hh && ch <= hi * hh && (c.x1 - c.x0 + 1) <= 1.3 * ch; });
    if (!gl.length) return null;
    const cl = [];
    for (const c of gl.sort((p, q) => p.x0 - q.x0)) {
      const cy = y0 + (c.y0 + c.y1) / 2;
      const k = cl.find(k => Math.abs(k.y - cy) < 0.4 * hh);
      if (k) k.c.push(c); else cl.push({ y: cy, c: [c] });
    }
    const best = cl.reduce((a, b) => Math.abs(b.y - yc) < Math.abs(a.y - yc) ? b : a);
    if (Math.abs(best.y - yc) > hh) return null;
    let s = '';
    for (const c of best.c) {
      const gw = c.x1 - c.x0 + 1, gh = c.y1 - c.y0 + 1, gm = new Uint8Array(gw * gh);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) gm[y * gw + x] = lab[(c.y0 + y) * w + c.x0 + x] === c.n ? 1 : 0;
      s += ziffer(gm, gw, gh);
    }
    return { s, y: best.y, mh: median(best.c.map(c => c.y1 - c.y0 + 1)) };
  };

  // 2) Zeilen finden (Ziffern unter „Punktzahl“)
  fortschritt('Zeilen und Zahlen werden gelesen …');
  const zeilenRoh = [];
  gruppen.forEach((g, gi) => {
    const hh = g.h * 1.3; const ytop = g.y + g.h;
    let ylim = Math.min(BH - 1, g.y + 14 * hh);
    if (gi + 1 < gruppen.length) ylim = Math.min(ylim, gruppen[gi + 1].y - gruppen[gi + 1].h);
    const gefunden = [];
    for (let y = ytop + hh * 0.8; y < ylim; y += 0.4 * hh) {
      const r = leseZelle(g.a, y, 0.45 * g.b, g.h, 0.9, 2.2);
      if (r && r.s && Math.abs(r.y - y) <= 0.6 * hh && !gefunden.some(f => Math.abs(r.y - f.y) < 0.6 * r.mh)) gefunden.push(r);
    }
    gefunden.sort((a, b) => a.y - b.y).forEach(r => zeilenRoh.push({ y: r.y, h: r.mh, g }));
  });

  // Teamfarbe der Zeile
  const teamFarbe = (y, h, g) => {
    const x0 = Math.max(0, Math.floor(g.a - 0.9 * g.b)), x1 = Math.max(0, Math.floor(g.a - 0.55 * g.b));
    const y0 = Math.max(0, Math.floor(y - 0.3 * h)), y1 = Math.min(BH, Math.floor(y + 0.3 * h));
    let blau = 0, orange = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const j = (yy * BW + xx) * 4, r = px[j], gg = px[j + 1], b = px[j + 2]; n++;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      if (mx < 60 || mx - mn < 50) continue;
      if (b > r) blau++; else if (r > b && gg < r) orange++;
    }
    if (!n || Math.max(blau, orange) < 0.5 * n) return null;
    return blau > orange ? 'blau' : 'orange';
  };

  const zeilen = [];
  for (const z of zeilenRoh) {
    const team = teamFarbe(z.y, z.h, z.g); if (!team) continue;
    const werte = [], punkte = []; let y = z.y;
    for (let i = 0; i < 5; i++) {
      const xc = z.g.a + z.g.b * i;
      const r = leseZelle(xc, y, 0.45 * z.g.b, z.h);
      if (r) { werte.push(r.s); y = r.y; punkte.push([xc, r.y]); } else werte.push(null);
    }
    if (werte.filter(v => v).length < 4) continue;
    const p0 = punkte[0], p1 = punkte[punkte.length - 1];
    const winkel = p1[0] !== p0[0] ? Math.atan((p1[1] - p0[1]) / (p1[0] - p0[0])) : 0;
    zeilen.push({ ...z, team, werte, winkel });
  }

  // 3) Namen lesen (Zeile vorher gerade drehen)
  fortschritt('Spielernamen werden gelesen …');
  const invG = grauCanvas(G, 0, 0, BW, BH, true, 1);
  for (const z of zeilen) {
    const cx = z.g.a, cy = z.y;
    const x0 = Math.max(0, Math.floor(cx - 4.6 * z.g.b)), x1 = Math.max(x0 + 1, Math.floor(cx - 0.6 * z.g.b));
    const y0 = Math.floor(cy - 2.1 * z.h), y1 = Math.floor(cy + 0.4 * z.h);
    const c = document.createElement('canvas'); c.width = (x1 - x0) * 2; c.height = (y1 - y0) * 2;
    const k = c.getContext('2d'); k.fillStyle = '#fff'; k.fillRect(0, 0, c.width, c.height);
    k.imageSmoothingQuality = 'high';
    k.scale(2, 2); k.translate(-x0, -y0); k.translate(cx, cy); k.rotate(-z.winkel); k.translate(-cx, -cy);
    k.drawImage(invG, 0, 0);
    let r = await ocr.woerter(c, 6);
    z.score = namenWertung(r.text);
    if (Math.max(...Object.values(z.score)) < 0.75) {
      const r2 = await ocr.woerter(c, 11); const s2 = namenWertung(r2.text);
      for (const p of SPIELER) z.score[p] = Math.max(z.score[p], s2[p]);
    }
  }

  // 4) Zuordnung
  const ergebnis = [], hinweise = [];
  const freieZeilen = new Set(zeilen.map((_, i) => i)), freieSpieler = new Set(SPIELER);
  const paare = [];
  zeilen.forEach((z, i) => SPIELER.forEach(p => paare.push({ i, p, s: z.score[p] })));
  paare.sort((a, b) => b.s - a.s);
  for (const { i, p, s } of paare) {
    if (s < 0.6) break;
    if (!freieZeilen.has(i) || !freieSpieler.has(p)) continue;
    freieZeilen.delete(i); freieSpieler.delete(p);
    ergebnis.push({ spieler: p, zeile: zeilen[i], sicher: s >= 0.75 });
  }
  for (const e of ergebnis) if (!e.sicher) hinweise.push(`Der Name von ${e.spieler} wurde nicht sicher erkannt – bitte prüfen.`);
  if (freieZeilen.size === 1 && freieSpieler.size === 1) {
    const i = [...freieZeilen][0], p = [...freieSpieler][0];
    ergebnis.push({ spieler: p, zeile: zeilen[i], sicher: false });
    hinweise.push(`Der Name von ${p} wurde nicht sicher erkannt und über das Ausschlussverfahren zugeordnet – bitte prüfen.`);
    freieZeilen.clear(); freieSpieler.clear();
  }
  if (freieZeilen.size) hinweise.push(`${freieZeilen.size} Zeile(n) konnten keinem Spieler zugeordnet werden – bitte Werte prüfen.`);
  for (const p of freieSpieler) hinweise.push(`${p} wurde nicht gefunden – bitte Team und Werte von Hand eintragen.`);

  const aus = SPIELER.map(p => {
    const e = ergebnis.find(e => e.spieler === p);
    if (!e) return { spieler: p, team: '', werte: Object.fromEntries(WERTE.map(k => [k, ''])), gefunden: false };
    return {
      spieler: p, team: e.zeile.team, gefunden: true, sicher: e.sicher,
      werte: Object.fromEntries(WERTE.map((k, i) => [k, e.zeile.werte[i] ?? '']))
    };
  });
  for (const a of aus) for (const k of WERTE) if (a.gefunden && a.werte[k] === '') hinweise.push(`${a.spieler}: „${k}“ nicht lesbar – bitte eintragen.`);
  return { zeilen: aus, hinweise };
}

export function namenWertung(text) {
  const ws = text.split(/\s+/).map(schluessel).filter(Boolean);
  const kand = [...ws, ...ws.slice(0, -1).map((w, i) => w + ws[i + 1])];
  const out = {};
  for (const t of SPIELER) {
    const k = schluessel(t), kern = k.replace(/[0-9]/g, '');
    let best = 0;
    for (const c of kand) {
      if (c.length < 3) continue;
      const cb = c.replace(/[0-9]/g, '');
      let r = Math.max(levRatio(c, k), cb.length >= 3 ? levRatio(cb, kern) : 0);
      if (cb.length >= 5 && (kern.startsWith(cb) || cb.includes(kern))) r = Math.max(r, 0.95);
      best = Math.max(best, r);
    }
    out[t] = best;
  }
  return out;
}

async function ladeBild(q) {
  if (q instanceof HTMLImageElement || q instanceof HTMLCanvasElement) return q;
  const url = URL.createObjectURL(q);
  try {
    const img = new Image(); img.src = url; await img.decode(); return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
