// Ananas – Spielregeln und Statistik (reine Logik, ohne Oberfläche)

export const SPIELER = ['Schlaggo_5', 'Lenoxx925', 'Rudy_Ratte', 'glueckspilz666'];
export const WERTE = ['punkte', 'tore', 'vorlagen', 'paraden', 'schuesse'];
export const WERTE_NAMEN = { punkte: 'Punkte', tore: 'Tore', vorlagen: 'Vorlagen', paraden: 'Paraden', schuesse: 'Schüsse' };
export const MAX_TOKEN = 2;

// ---------- Quartale ----------
export function quartalVon(datum) { // datum 'JJJJ-MM-TT'
  const j = Number(datum.slice(0, 4)), m = Number(datum.slice(5, 7));
  return `${j}-Q${Math.floor((m - 1) / 3) + 1}`;
}
export function quartalName(q) {
  const [j, n] = q.split('-Q');
  const mon = { 1: 'Jänner–März', 2: 'April–Juni', 3: 'Juli–September', 4: 'Oktober–Dezember' }[n];
  return `Q${n} ${j} (${mon})`;
}
export function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function datumText(d) { return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : ''; }

// ---------- Spiele ----------
// Paarung eines 2-gegen-2-Spiels: Partner von SPIELER[0]
export function paarungVon(spiel) {
  const team = spiel.blau.includes(SPIELER[0]) ? spiel.blau : spiel.orange;
  return team.find(p => p !== SPIELER[0]);
}
export function paarungText(partner) {
  const a = [SPIELER[0], partner];
  const b = SPIELER.filter(p => !a.includes(p));
  return `${a.join(' & ')} gegen ${b.join(' & ')}`;
}
export function spielArt(blau, orange) {
  if (blau.length === 2 && orange.length === 2) return 'normal';
  if ((blau.length === 1 && orange.length === 3) || (blau.length === 3 && orange.length === 1)) return 'weltmeister';
  return null;
}
export function siegerTeam(spiel) {
  return spiel[spiel.sieger] || [];
}
// Weltmeister-Angaben aus Spiel ableiten
export function wmAuswertung(spiel) {
  const solo = spiel.blau.length === 1 ? spiel.blau : spiel.orange;
  const trio = spiel.blau.length === 3 ? spiel.blau : spiel.orange;
  const champion = solo[0];
  const torschuetzen = trio.filter(p => (spiel.werte[p]?.tore || 0) > 0);
  const ohneTor = trio.filter(p => !((spiel.werte[p]?.tore || 0) > 0));
  const verlierer = spiel.wmVerlierer && trio.includes(spiel.wmVerlierer)
    ? spiel.wmVerlierer
    : (ohneTor.length === 1 ? ohneTor[0] : null);
  const gewonnen = trio.filter(p => p !== verlierer && (torschuetzen.includes(p) || verlierer));
  return { champion, trio, torschuetzen, ohneTor, verlierer, gewonnen };
}

// ---------- Gesamtrunde ----------
export function punkteFuerToken(anzahl) {
  return 2 ** Math.min(Math.max(anzahl || 0, 0), MAX_TOKEN);
}

export function auswertungRunde(runde) {
  const spiele = [...(runde.spiele || [])].sort((a, b) => (a.zeit || 0) - (b.zeit || 0));
  const duelle = {};
  for (const partner of SPIELER.slice(1)) {
    const team = [SPIELER[0], partner];
    duelle[partner] = { partner, teamA: team, teamB: SPIELER.filter(p => !team.includes(p)), siegeA: 0, siegeB: 0, sieger: null, spiele: [] };
  }
  const ueberzaehlig = [];
  const wmSpiele = [];
  for (const s of spiele) {
    if (s.art === 'weltmeister') { wmSpiele.push(s); continue; }
    const d = duelle[paarungVon(s)];
    if (!d) continue;
    if (d.sieger) { ueberzaehlig.push(s.id); continue; }
    const gewinner = siegerTeam(s);
    if (gewinner.includes(SPIELER[0])) d.siegeA++; else d.siegeB++;
    d.spiele.push(s.id);
    if (d.siegeA >= 2) d.sieger = d.teamA;
    else if (d.siegeB >= 2) d.sieger = d.teamB;
  }
  const liste = Object.values(duelle);
  const fertig = liste.every(d => d.sieger);
  const duellSiege = Object.fromEntries(SPIELER.map(p => [p, 0]));
  for (const d of liste) if (d.sieger) d.sieger.forEach(p => duellSiege[p]++);

  let typ = null, verlierer = null, champion = null, wm = null, status = 'läuft';
  if (fertig) {
    const alleVerloren = SPIELER.filter(p => duellSiege[p] === 0);
    const alleGewonnen = SPIELER.filter(p => duellSiege[p] === 3);
    if (alleVerloren.length === 1) {
      typ = 'komplett'; verlierer = alleVerloren[0]; status = 'abgeschlossen';
    } else if (alleGewonnen.length === 1) {
      typ = 'weltmeister'; champion = alleGewonnen[0];
      const wmSpiel = wmSpiele[0];
      if (wmSpiel) {
        wm = wmAuswertung(wmSpiel);
        if (wm.verlierer) { verlierer = wm.verlierer; status = 'abgeschlossen'; }
        else status = 'Weltmeister: Verlierer auswählen';
      } else status = 'Weltmeister ausstehend';
    }
  }
  const token = (runde.token || []).slice(0, MAX_TOKEN);
  let punkte = punkteFuerToken(token.length);
  const m = runde.manuell || {};
  let manuell = false;
  if (m.verlierer) { verlierer = m.verlierer; manuell = true; status = 'abgeschlossen'; if (!typ) typ = 'manuell'; }
  if (m.punkte !== undefined && m.punkte !== null && m.punkte !== '') { punkte = Number(m.punkte); manuell = true; }
  if (m.keinVerlierer) { verlierer = null; manuell = true; status = 'abgeschlossen'; }
  return { duelle: liste, fertig, duellSiege, typ, verlierer, champion, wm, wmSpiele: wmSpiele.map(s => s.id), punkte: verlierer ? punkte : 0, status, ueberzaehlig, manuell };
}

// ---------- Statistik ----------
function leer() {
  return {
    spiele: 0, siege: 0, punkte: 0, tore: 0, vorlagen: 0, paraden: 0, schuesse: 0,
    duelle: 0, duelleGewonnen: 0, runden: 0, rundenKomplettVerloren: 0,
    wmChampion: 0, wmGewonnen: 0, wmVerloren: 0, wmSpiele: 0,
    verliererpunkte: 0, tokenGenutzt: 0
  };
}
export function sortierteRunden(runden) {
  return [...runden].sort((a, b) => (a.datum || '').localeCompare(b.datum || '') || (a.erstellt || 0) - (b.erstellt || 0));
}
// quartal: 'JJJJ-Qn' oder null = alle
export function statistik(runden, korrekturen, quartal) {
  const st = Object.fromEntries(SPIELER.map(p => [p, leer()]));
  const rs = sortierteRunden(runden).filter(r => !quartal || r.quartal === quartal);
  for (const r of rs) {
    const a = auswertungRunde(r);
    const gezaehlt = new Set();
    for (const d of a.duelle) {
      if (!d.sieger) continue;
      for (const p of [...d.teamA, ...d.teamB]) { st[p].duelle++; if (d.sieger.includes(p)) st[p].duelleGewonnen++; }
    }
    for (const s of r.spiele || []) {
      if (s.art === 'weltmeister') {
        const w = wmAuswertung(s);
        if (w.champion) st[w.champion].wmChampion++;
        w.trio.forEach(p => st[p].wmSpiele++);
        w.gewonnen.forEach(p => st[p].wmGewonnen++);
        if (w.verlierer) st[w.verlierer].wmVerloren++;
        continue;
      }
      if (a.ueberzaehlig.includes(s.id)) continue;
      for (const p of [...s.blau, ...s.orange]) {
        const w = s.werte[p] || {};
        st[p].spiele++;
        if (siegerTeam(s).includes(p)) st[p].siege++;
        for (const k of WERTE) st[p][k] += Number(w[k] || 0);
        gezaehlt.add(p);
      }
    }
    if (a.fertig || a.manuell) SPIELER.forEach(p => st[p].runden++);
    if (a.typ === 'komplett' && a.verlierer && !r.manuell?.verlierer) st[a.verlierer].rundenKomplettVerloren++;
    if (a.verlierer) st[a.verlierer].verliererpunkte += a.punkte;
    (r.token || []).forEach(p => { if (st[p]) st[p].tokenGenutzt++; });
  }
  for (const k of korrekturen || []) {
    if (quartal && k.quartal !== quartal) continue;
    if (st[k.spieler]) st[k.spieler].verliererpunkte += Number(k.punkte || 0);
  }
  for (const p of SPIELER) {
    const s = st[p];
    s.schnitt = s.spiele ? s.punkte / s.spiele : 0;
  }
  return st;
}

// Token: pro Spieler und Quartal 1 Token
export function tokenVerbraucht(runden, quartal, spieler, ausserRundeId) {
  return runden.some(r => r.quartal === quartal && r.id !== ausserRundeId && (r.token || []).includes(spieler));
}

// Ananas Auto: Verlierer der letzten komplett verlorenen Runde
export function ananasAuto(runden) {
  const rs = sortierteRunden(runden);
  let letzteKomplett = null, letzteFertig = null;
  for (const r of rs) {
    const a = auswertungRunde(r);
    if (a.status === 'abgeschlossen') letzteFertig = r;
    if (a.status === 'abgeschlossen' && a.typ === 'komplett' && a.verlierer) letzteKomplett = { runde: r, spieler: a.verlierer };
  }
  const offen = rs.some(r => auswertungRunde(r).status !== 'abgeschlossen' && (r.spiele || []).length > 0);
  const pflicht = letzteKomplett && letzteFertig && letzteKomplett.runde.id === letzteFertig.id;
  return { letzteKomplett, pflicht: !!pflicht, rundeLaeuft: offen };
}

export function alleQuartale(runden, korrekturen) {
  const s = new Set([quartalVon(heute())]);
  runden.forEach(r => r.quartal && s.add(r.quartal));
  (korrekturen || []).forEach(k => k.quartal && s.add(k.quartal));
  return [...s].sort().reverse();
}

// Rangliste Verliererpunkte (höchste zuerst)
export function rangliste(st) {
  return SPIELER.map(p => ({ spieler: p, punkte: st[p].verliererpunkte })).sort((a, b) => b.punkte - a.punkte || a.spieler.localeCompare(b.spieler));
}
