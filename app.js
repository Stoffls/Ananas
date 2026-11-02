// Ananas – Oberfläche
import {
  SPIELER, WERTE, WERTE_NAMEN, MAX_TOKEN, quartalVon, quartalName, heute, datumText, paarungVon, paarungText,
  spielArt, wmAuswertung, auswertungRunde, statistik, tokenVerbraucht, ananasAuto, alleQuartale, rangliste, sortierteRunden, punkteFuerToken
} from './logik.js';
import * as D from './daten.js';
import { erkenneFoto } from './erkennung.js';

const VERSION = '1.0.1';
const S = {
  runden: [], korrekturen: [], geladen: false, fehler: null,
  admin: null, tab: 'start', quartal: quartalVon(heute()),
  offen: {}, review: null, meldung: null, beschaeftigt: false
};
const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const zahl = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('de-AT', { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- Start ----------
D.starte(daten => {
  S.runden = daten.runden || []; S.korrekturen = daten.korrekturen || []; S.geladen = true; S.fehler = null; zeichne();
}, e => { S.fehler = D.fehlerText(e); S.geladen = true; zeichne(); }).catch(e => { S.fehler = 'App konnte nicht starten: ' + D.fehlerText(e); S.geladen = true; zeichne(); });
D.beobachteAdmin(u => { S.admin = u; zeichne(); }).catch(e => { S.fehler = 'Anmeldung nicht verfügbar: ' + D.fehlerText(e); zeichne(); });

function meldung(text, art = 'ok') { S.meldung = { text, art }; zeichne(); clearTimeout(meldung.t); meldung.t = setTimeout(() => { S.meldung = null; zeichne(); }, 4500); }

// ---------- Zeichnen ----------
function zeichne() {
  const tabs = [['start', 'Start'], ['runden', 'Spiele'], ['admin', S.admin ? 'Admin ✓' : 'Admin']];
  app.innerHTML = `
    <header class="kopf">
      <div class="marke"><img src="icon-192.png" alt=""><div><h1>Ananas</h1><small>Wer holt sich die goldene Ananas?</small></div></div>
      ${D.demo ? '<span class="demo">Demo</span>' : ''}
    </header>
    <nav class="tabs">${tabs.map(([k, t]) => `<button data-aktion="tab" data-wert="${k}" class="${S.tab === k ? 'aktiv' : ''}">${t}</button>`).join('')}</nav>
    ${S.meldung ? `<div class="meldung ${S.meldung.art}">${esc(S.meldung.text)}</div>` : ''}
    ${S.fehler ? `<div class="meldung fehler">${esc(S.fehler)}</div>` : ''}
    <main>${!S.geladen ? '<p class="leer">Daten werden geladen …</p>' : S.tab === 'start' ? startSeite() : S.tab === 'runden' ? rundenSeite() : adminSeite()}</main>
    <footer>Ananas v${VERSION}${D.demo ? ' · Demo-Modus: Daten nur auf diesem Gerät' : ''}</footer>`;
}

function quartalWahl() {
  const qs = alleQuartale(S.runden, S.korrekturen);
  return `<div class="chips">${qs.map(q => `<button data-aktion="quartal" data-wert="${q}" class="${S.quartal === q ? 'aktiv' : ''}">${esc(q.replace('-', ' '))}</button>`).join('')}
    <button data-aktion="quartal" data-wert="alle" class="${S.quartal === 'alle' ? 'aktiv' : ''}">Gesamt</button></div>`;
}

function startSeite() {
  const q = S.quartal === 'alle' ? null : S.quartal;
  const st = statistik(S.runden, S.korrekturen, q);
  const rl = rangliste(st);
  const aktuell = quartalVon(heute());
  const vorbei = q && q < aktuell;
  const max = rl[0].punkte;
  const fuehrende = rl.filter(r => r.punkte === max && max > 0).map(r => r.spieler);
  const auto = ananasAuto(S.runden);

  // Rangliste
  let html = quartalWahl();
  html += `<section class="karte gold">
    <h2>🍍 Verliererpunkte ${q ? '· ' + esc(quartalName(q)) : '· Gesamt'}</h2>
    ${fuehrende.length ? `<p class="hinweis">${vorbei ? 'Goldene Ananas' : 'Anwärter auf die goldene Ananas'}: <b>${fuehrende.map(esc).join(', ')}</b></p>` : '<p class="hinweis">Noch keine Verliererpunkte.</p>'}
    <ol class="rang">${rl.map(r => `<li class="${fuehrende.includes(r.spieler) ? 'vorne' : ''}"><span>${esc(r.spieler)}</span><b>${fmt(r.punkte)}</b></li>`).join('')}</ol>
  </section>`;

  // Ananas Auto
  html += `<section class="karte">
    <h2>🚗 Ananas Auto</h2>
    ${auto.letzteKomplett
      ? `${auto.pflicht ? `<p class="gross"><b>${esc(auto.letzteKomplett.spieler)}</b> fährt im nächsten Spiel das Ananas Auto.</p>` : ''}
         <p>Letzte komplett verlorene Gesamtrunde: <b>${esc(auto.letzteKomplett.spieler)}</b> am ${datumText(auto.letzteKomplett.runde.datum)}</p>`
      : '<p>Noch keine komplett verlorene Gesamtrunde.</p>'}
  </section>`;

  // Token
  if (q) {
    html += `<section class="karte"><h2>🎟️ Token ${esc(q.replace('-', ' '))}</h2><div class="token">
      ${SPIELER.map(p => { const weg = tokenVerbraucht(S.runden, q, p, null); return `<div class="${weg ? 'weg' : 'da'}"><span>${esc(p)}</span><b>${weg ? 'eingesetzt' : 'verfügbar'}</b></div>`; }).join('')}
    </div></section>`;
  }

  // Statistik
  const zeilen = [
    ['Verliererpunkte', p => fmt(st[p].verliererpunkte), p => -st[p].verliererpunkte, 'min'],
    ['Tore', p => fmt(st[p].tore), p => st[p].tore],
    ['Vorlagen', p => fmt(st[p].vorlagen), p => st[p].vorlagen],
    ['Paraden', p => fmt(st[p].paraden), p => st[p].paraden],
    ['Schüsse', p => fmt(st[p].schuesse), p => st[p].schuesse],
    ['Ø Punkte je Spiel', p => fmt(st[p].schnitt, 1), p => st[p].schnitt],
    ['Spiele', p => fmt(st[p].spiele), null],
    ['Spiele gewonnen', p => fmt(st[p].siege), p => st[p].siege],
    ['Duelle gewonnen', p => `${fmt(st[p].duelleGewonnen)} / ${fmt(st[p].duelle)}`, p => st[p].duelleGewonnen],
    ['Gesamtrunden komplett verloren', p => fmt(st[p].rundenKomplettVerloren), p => -st[p].rundenKomplettVerloren],
    ['Weltmeister-Champion', p => fmt(st[p].wmChampion), p => st[p].wmChampion],
    ['Weltmeister gewonnen', p => fmt(st[p].wmGewonnen), p => st[p].wmGewonnen],
    ['Weltmeister verloren', p => fmt(st[p].wmVerloren), p => -st[p].wmVerloren]
  ];
  html += `<section class="karte"><h2>📊 Statistik</h2>
    <div class="tabelle-wrap"><table class="stat"><thead><tr><th></th>${SPIELER.map(p => `<th>${esc(p)}</th>`).join('')}</tr></thead><tbody>
    ${zeilen.map(([t, f, w]) => {
      let beste = null;
      if (w) { const ws = SPIELER.map(w); const m = Math.max(...ws); if (ws.some(x => x !== m)) beste = m; }
      return `<tr><th>${t}</th>${SPIELER.map(p => `<td class="${beste !== null && w(p) === beste ? 'top' : ''}">${f(p)}</td>`).join('')}</tr>`;
    }).join('')}
    </tbody></table></div>
    <p class="klein">Tore, Vorlagen, Paraden, Schüsse und Ø Punkte zählen aus den 2-gegen-2-Spielen; Weltmeister wird extra geführt.</p>
  </section>`;

  // Historie goldene Ananas
  const vergangen = alleQuartale(S.runden, S.korrekturen).filter(x => x < aktuell);
  if (vergangen.length) {
    html += `<section class="karte"><h2>🏆 Goldene Ananas – Historie</h2><ul class="liste">
      ${vergangen.map(x => { const r = rangliste(statistik(S.runden, S.korrekturen, x)); const m = r[0].punkte; const w = r.filter(y => y.punkte === m && m > 0).map(y => y.spieler); return `<li><span>${esc(quartalName(x))}</span><b>${w.length ? w.map(esc).join(', ') + ` (${fmt(m)})` : '–'}</b></li>`; }).join('')}
    </ul></section>`;
  }
  return html;
}

// ---------- Runden ----------
function teamText(s, team) { return s[team].map(esc).join(' & '); }
function spielTabelle(s) {
  const zeile = p => {
    const team = s.blau.includes(p) ? 'blau' : 'orange'; const w = s.werte[p] || {};
    return `<tr><th><i class="punkt ${team}"></i>${esc(p)}</th>${WERTE.map(k => `<td>${esc(w[k] ?? '')}</td>`).join('')}</tr>`;
  };
  return `<div class="tabelle-wrap"><table class="spiel"><thead><tr><th>Spieler</th><th>Pkt</th><th>Tore</th><th>Vorl.</th><th>Par.</th><th>Schü.</th></tr></thead>
    <tbody>${[...s.blau, ...s.orange].map(zeile).join('')}</tbody></table></div>`;
}
function toreTeam(s, team) { return s[team].reduce((a, p) => a + Number(s.werte[p]?.tore || 0), 0); }

function rundenSeite() {
  const rs = sortierteRunden(S.runden).reverse();
  if (!rs.length) return '<p class="leer">Noch keine Spiele eingetragen.</p>';
  return rs.map(r => rundenKarte(r)).join('');
}
function rundenKarte(r) {
  const a = auswertungRunde(r);
  const offen = S.offen[r.id];
  const spiele = [...(r.spiele || [])].sort((x, y) => (x.zeit || 0) - (y.zeit || 0));
  const statusKlasse = a.status === 'abgeschlossen' ? 'fertig' : 'laeuft';
  let html = `<section class="karte runde">
    <div class="runde-kopf" data-aktion="auf" data-wert="${r.id}">
      <div><h2>Gesamtrunde ${datumText(r.datum)}</h2><small>${esc(quartalName(r.quartal))}</small></div>
      <span class="status ${statusKlasse}">${esc(a.status)}</span>
    </div>`;
  if (a.verlierer) html += `<p class="ergebnis">🍍 Verlierer: <b>${esc(a.verlierer)}</b> · ${fmt(a.punkte)} Verliererpunkt${a.punkte === 1 ? '' : 'e'}${a.typ === 'komplett' ? ' · alle Duelle verloren → Ananas Auto' : ''}${a.typ === 'weltmeister' ? ' · im Weltmeister' : ''}${a.manuell ? ' · von Admin festgelegt' : ''}</p>`;
  else if (a.manuell && r.manuell?.keinVerlierer) html += `<p class="ergebnis">Kein Verlierer (von Admin festgelegt)</p>`;
  if (a.champion) html += `<p class="ergebnis">👑 Weltmeister-Champion: <b>${esc(a.champion)}</b></p>`;
  if ((r.token || []).length) html += `<p class="ergebnis">🎟️ Token: ${r.token.map(esc).join(', ')} → ×${punkteFuerToken(r.token.length)}</p>`;
  html += `<ul class="duelle">${a.duelle.map(d => `<li class="${d.sieger ? 'entschieden' : ''}">
      <span class="${d.sieger === d.teamA ? 'sieg' : ''}">${d.teamA.map(esc).join(' & ')}</span>
      <b>${d.siegeA}:${d.siegeB}</b>
      <span class="${d.sieger === d.teamB ? 'sieg' : ''}">${d.teamB.map(esc).join(' & ')}</span></li>`).join('')}</ul>`;
  if (offen) {
    html += spiele.map((s, i) => {
      const ue = a.ueberzaehlig.includes(s.id);
      let titel;
      if (s.art === 'weltmeister') {
        const w = wmAuswertung(s);
        titel = `Weltmeister · Champion ${esc(w.champion)} · Verlierer ${w.verlierer ? esc(w.verlierer) : 'offen'}`;
      } else {
        titel = `<span class="blau-t">${teamText(s, 'blau')}</span> <b>${toreTeam(s, 'blau')}:${toreTeam(s, 'orange')}</b> <span class="orange-t">${teamText(s, 'orange')}</span>`;
      }
      return `<div class="spielblock ${ue ? 'ue' : ''}"><div class="spielkopf">Spiel ${i + 1}${ue ? ' · zählt nicht (Duell war schon entschieden)' : ''}</div>
        <div class="spieltitel">${titel}</div>${spielTabelle(s)}
        ${S.admin ? `<div class="knoepfe"><button data-aktion="spiel-bearbeiten" data-runde="${r.id}" data-wert="${s.id}">Bearbeiten</button><button class="gefahr" data-aktion="spiel-loeschen" data-runde="${r.id}" data-wert="${s.id}">Löschen</button></div>` : ''}
      </div>`;
    }).join('') || '<p class="leer">Noch keine Spiele in dieser Runde.</p>';
    if (S.admin) html += rundeBearbeiten(r, a);
  }
  html += `<button class="mehr" data-aktion="auf" data-wert="${r.id}">${offen ? 'Weniger anzeigen ▲' : `${spiele.length} Spiel${spiele.length === 1 ? '' : 'e'} anzeigen ▼`}</button></section>`;
  return html;
}

function rundeBearbeiten(r, a) {
  const m = r.manuell || {};
  const verlWert = m.keinVerlierer ? '-' : (m.verlierer || '');
  return `<div class="bearbeiten" data-runde="${r.id}">
    <h3>Runde bearbeiten (Admin)</h3>
    <label>Datum <input type="date" name="datum" value="${esc(r.datum)}"></label>
    <fieldset><legend>Token (höchstens ${MAX_TOKEN}, 1 je Spieler und Quartal)</legend>
      ${SPIELER.map(p => {
        const anderswo = tokenVerbraucht(S.runden, r.quartal, p, r.id);
        return `<label class="check"><input type="checkbox" name="token" value="${esc(p)}" ${(r.token || []).includes(p) ? 'checked' : ''}> ${esc(p)}${anderswo ? ' <em>(im Quartal schon eingesetzt)</em>' : ''}</label>`;
      }).join('')}
    </fieldset>
    <label>Verlierer <select name="verlierer">
      <option value="" ${verlWert === '' ? 'selected' : ''}>Automatisch${a.verlierer && !a.manuell ? ' (' + esc(a.verlierer) + ')' : ''}</option>
      ${SPIELER.map(p => `<option value="${esc(p)}" ${verlWert === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
      <option value="-" ${verlWert === '-' ? 'selected' : ''}>Kein Verlierer</option>
    </select></label>
    <label>Verliererpunkte <input type="number" name="punkte" min="0" step="1" inputmode="numeric" placeholder="Automatisch (${punkteFuerToken((r.token || []).length)})" value="${m.punkte ?? ''}"></label>
    <div class="knoepfe"><button class="haupt" data-aktion="runde-speichern" data-wert="${r.id}">Speichern</button>
    <button class="gefahr" data-aktion="runde-loeschen" data-wert="${r.id}">Runde löschen</button></div>
  </div>`;
}

// ---------- Admin ----------
function adminSeite() {
  if (!S.admin) {
    return `<section class="karte"><h2>Admin-Anmeldung</h2>
      ${D.demo ? '<p class="hinweis">Demo-Modus: Einfach auf „Anmelden“ tippen.</p>' : ''}
      <form data-form="login">
        ${D.demo ? '' : `<label>E-Mail <input type="email" name="email" autocomplete="username" required></label>
        <label>Passwort <input type="password" name="passwort" autocomplete="current-password" required></label>`}
        <button class="haupt" type="submit" ${S.beschaeftigt ? 'disabled' : ''}>Anmelden</button>
      </form>
      <p class="klein">Spielergebnisse ansehen kann jeder – eintragen und ändern nur der Admin.</p></section>`;
  }
  if (S.review) return reviewSeite();
  const offeneRunde = aktuelleRunde();
  return `<section class="karte">
      <h2>Spiel eintragen</h2>
      <p class="hinweis">${offeneRunde ? `Aktuelle Gesamtrunde: ${datumText(offeneRunde.datum)} (${esc(auswertungRunde(offeneRunde).status)})` : 'Keine laufende Gesamtrunde – beim Speichern wird eine neue angelegt.'}</p>
      <label class="haupt dateiknopf">📷 Foto aufnehmen / auswählen<input type="file" accept="image/*" data-aktion="foto" hidden></label>
      <button data-aktion="manuell">Spiel von Hand eintragen</button>
      <p class="klein">Tipp: Foto vom Endstand möglichst gerade und scharf aufnehmen, ohne Spiegelungen.</p>
    </section>
    <section class="karte">
      <h2>Verliererpunkte korrigieren</h2>
      <form data-form="korrektur" class="raster">
        <label>Quartal <select name="quartal">${alleQuartale(S.runden, S.korrekturen).map(q => `<option value="${q}">${esc(q.replace('-', ' '))}</option>`).join('')}</select></label>
        <label>Spieler <select name="spieler">${SPIELER.map(p => `<option>${esc(p)}</option>`).join('')}</select></label>
        <label>Punkte (+/−) <input type="number" name="punkte" step="1" inputmode="numeric" required></label>
        <label>Grund <input type="text" name="grund" maxlength="120"></label>
        <button class="haupt" type="submit">Korrektur speichern</button>
      </form>
      <ul class="liste">${[...S.korrekturen].sort((a, b) => (b.erstellt || 0) - (a.erstellt || 0)).map(k => `<li><span>${esc(k.quartal.replace('-', ' '))} · ${esc(k.spieler)} · ${k.punkte > 0 ? '+' : ''}${fmt(k.punkte)}${k.grund ? ' · ' + esc(k.grund) : ''}</span><button class="gefahr klein" data-aktion="korrektur-loeschen" data-wert="${k.id}">×</button></li>`).join('') || '<li class="leer">Keine Korrekturen.</li>'}</ul>
      <p class="klein">Token, Verlierer und Punkte einer Runde änderst du unter „Spiele“ → Runde öffnen → „Runde bearbeiten“.</p>
    </section>
    <section class="karte"><p>Angemeldet als ${esc(S.admin.email || '')}</p><button data-aktion="abmelden">Abmelden</button></section>`;
}

function aktuelleRunde() {
  const rs = sortierteRunden(S.runden).reverse();
  return rs.find(r => auswertungRunde(r).status !== 'abgeschlossen') || null;
}

function leereZeilen() { return SPIELER.map(p => ({ spieler: p, team: '', werte: Object.fromEntries(WERTE.map(k => [k, ''])) })); }

function reviewSeite() {
  const rv = S.review;
  if (rv.laeuft) {
    return `<section class="karte"><h2>Foto wird ausgewertet …</h2>
      ${rv.bild ? `<img class="vorschau" src="${rv.bild}" alt="Foto">` : ''}
      <p class="hinweis">${esc(rv.fortschritt || '')}</p><div class="balken"><div></div></div>
      <p class="klein">Beim ersten Mal wird die Texterkennung geladen (einige MB), das dauert etwas länger.</p></section>`;
  }
  const rs = sortierteRunden(S.runden).reverse();
  return `<section class="karte">
    <h2>${rv.spielId ? 'Spiel bearbeiten' : 'Ergebnis prüfen'}</h2>
    ${rv.bild ? `<img class="vorschau" src="${rv.bild}" alt="Foto">` : ''}
    ${rv.hinweise && rv.hinweise.length ? `<ul class="warnungen">${rv.hinweise.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    ${rv.bild && !(rv.hinweise || []).length ? '<p class="hinweis ok">Alles erkannt – bitte trotzdem kurz mit dem Foto vergleichen.</p>' : ''}
    <form data-form="review">
      ${rv.spielId ? '' : `<label>Gesamtrunde <select name="runde">
        <option value="neu" ${rv.runde === 'neu' ? 'selected' : ''}>Neue Gesamtrunde</option>
        ${rs.map(r => `<option value="${r.id}" ${rv.runde === r.id ? 'selected' : ''}>${datumText(r.datum)} – ${esc(auswertungRunde(r).status)}</option>`).join('')}
      </select></label>
      <label class="${rv.runde === 'neu' ? '' : 'versteckt'}" data-feld="datum">Datum der neuen Runde <input type="date" name="datum" value="${esc(rv.datum)}"></label>`}
      <div class="tabelle-wrap"><table class="eingabe"><thead><tr><th>Spieler</th><th>Team</th>${WERTE.map(k => `<th>${WERTE_NAMEN[k]}</th>`).join('')}</tr></thead><tbody>
      ${rv.zeilen.map((z, i) => `<tr class="${z.team}"><th>${esc(z.spieler)}</th>
        <td><select name="team-${i}"><option value="" ${!z.team ? 'selected' : ''}>–</option><option value="blau" ${z.team === 'blau' ? 'selected' : ''}>Blau</option><option value="orange" ${z.team === 'orange' ? 'selected' : ''}>Orange</option></select></td>
        ${WERTE.map(k => `<td><input type="number" min="0" step="1" inputmode="numeric" name="w-${i}-${k}" value="${esc(z.werte[k])}"></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div id="review-info">${reviewInfo()}</div>
      <div class="knoepfe"><button class="haupt" type="submit">Speichern</button><button type="button" data-aktion="review-abbrechen">Abbrechen</button></div>
    </form></section>`;
}

function reviewDaten() {
  const rv = S.review;
  const blau = rv.zeilen.filter(z => z.team === 'blau').map(z => z.spieler);
  const orange = rv.zeilen.filter(z => z.team === 'orange').map(z => z.spieler);
  const art = spielArt(blau, orange);
  const werte = Object.fromEntries(rv.zeilen.map(z => [z.spieler, Object.fromEntries(WERTE.map(k => [k, zahl(z.werte[k])]))]));
  const fehlend = rv.zeilen.some(z => (blau.includes(z.spieler) || orange.includes(z.spieler)) && WERTE.some(k => zahl(z.werte[k]) === null || zahl(z.werte[k]) < 0 || !Number.isInteger(zahl(z.werte[k]))));
  return { blau, orange, art, werte, fehlend };
}

function reviewInfo() {
  const rv = S.review; const d = reviewDaten();
  if (!d.art) return `<p class="warnung">Teams wählen: 2 gegen 2 (normales Spiel) oder 1 gegen 3 (Weltmeister).</p>`;
  if (d.art === 'normal') {
    const tb = d.blau.reduce((a, p) => a + (d.werte[p].tore || 0), 0), to = d.orange.reduce((a, p) => a + (d.werte[p].tore || 0), 0);
    const auto = tb > to ? 'blau' : to > tb ? 'orange' : '';
    const partner = paarungVon({ blau: d.blau, orange: d.orange });
    return `<p><b>2 gegen 2</b> · Duell: ${esc(paarungText(partner))}</p>
      <p>Tore: <span class="blau-t">Blau ${tb}</span> : <span class="orange-t">${to} Orange</span></p>
      <label>Sieger <select name="sieger">
        <option value="" ${!rv.sieger ? 'selected' : ''}>${auto ? `Automatisch: ${auto === 'blau' ? 'Blau' : 'Orange'} (mehr Tore)` : 'Bitte wählen (Gleichstand)'}</option>
        <option value="blau" ${rv.sieger === 'blau' ? 'selected' : ''}>Blau (${d.blau.map(esc).join(' & ')})</option>
        <option value="orange" ${rv.sieger === 'orange' ? 'selected' : ''}>Orange (${d.orange.map(esc).join(' & ')})</option>
      </select></label>`;
  }
  const w = wmAuswertung({ blau: d.blau, orange: d.orange, werte: Object.fromEntries(Object.entries(d.werte).map(([p, v]) => [p, { tore: v.tore || 0 }])) });
  return `<p><b>Weltmeister</b> · im Tor (Champion): <b>${esc(w.champion)}</b></p>
    <p>Tor geschossen: ${w.torschuetzen.length ? w.torschuetzen.map(esc).join(', ') : 'niemand'}</p>
    <label>Verlierer (kein Tor) <select name="wmVerlierer">
      <option value="" ${!rv.wmVerlierer ? 'selected' : ''}>${w.ohneTor.length === 1 ? `Automatisch: ${esc(w.ohneTor[0])}` : 'Bitte wählen'}</option>
      ${w.trio.map(p => `<option value="${esc(p)}" ${rv.wmVerlierer === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
    </select></label>`;
}

// ---------- Aktionen ----------
app.addEventListener('click', async e => {
  const el = e.target.closest('[data-aktion]'); if (!el || el.tagName === 'INPUT') return;
  const a = el.dataset.aktion, w = el.dataset.wert;
  if (a === 'tab') { S.tab = w; if (w !== 'admin') { /* Prüfung bleibt erhalten */ } zeichne(); window.scrollTo(0, 0); }
  else if (a === 'quartal') { S.quartal = w; zeichne(); }
  else if (a === 'auf') { S.offen[w] = !S.offen[w]; zeichne(); }
  else if (a === 'abmelden') { await D.abmelden(u => { S.admin = u; zeichne(); }); }
  else if (a === 'manuell') { S.review = { zeilen: leereZeilen(), hinweise: [], runde: aktuelleRunde()?.id || 'neu', datum: heute(), sieger: '', wmVerlierer: '' }; zeichne(); }
  else if (a === 'review-abbrechen') { if (S.review?.bild) URL.revokeObjectURL(S.review.bild); S.review = null; zeichne(); }
  else if (a === 'spiel-bearbeiten') {
    const r = S.runden.find(x => x.id === el.dataset.runde); const s = r?.spiele.find(x => x.id === w); if (!s) return;
    S.review = {
      spielId: s.id, runde: r.id, datum: r.datum, sieger: s.art === 'normal' ? (s.siegerManuell ? s.sieger : '') : '', wmVerlierer: s.wmVerlierer || '', hinweise: [],
      zeilen: SPIELER.map(p => ({ spieler: p, team: s.blau.includes(p) ? 'blau' : s.orange.includes(p) ? 'orange' : '', werte: Object.fromEntries(WERTE.map(k => [k, s.werte[p]?.[k] ?? ''])) }))
    };
    S.tab = 'admin'; zeichne(); window.scrollTo(0, 0);
  }
  else if (a === 'spiel-loeschen') {
    const r = S.runden.find(x => x.id === el.dataset.runde); if (!r || !confirm('Dieses Spiel wirklich löschen?')) return;
    await schreibe(() => D.speichereRunde({ ...r, spiele: r.spiele.filter(x => x.id !== w) }), 'Spiel gelöscht.');
  }
  else if (a === 'runde-speichern') {
    const r = S.runden.find(x => x.id === w); if (!r) return;
    const box = el.closest('.bearbeiten');
    const token = [...box.querySelectorAll('input[name=token]:checked')].map(i => i.value);
    if (token.length > MAX_TOKEN) return meldung(`Höchstens ${MAX_TOKEN} Token pro Gesamtrunde.`, 'fehler');
    const doppelt = token.filter(p => tokenVerbraucht(S.runden, r.quartal, p, r.id) && !(r.token || []).includes(p));
    if (doppelt.length && !confirm(`${doppelt.join(', ')} hat im Quartal schon einen Token eingesetzt. Trotzdem eintragen?`)) return;
    const datum = box.querySelector('[name=datum]').value || r.datum;
    const v = box.querySelector('[name=verlierer]').value; const p = box.querySelector('[name=punkte]').value;
    const manuell = {};
    if (v === '-') manuell.keinVerlierer = true; else if (v) manuell.verlierer = v;
    if (p !== '') manuell.punkte = Number(p);
    await schreibe(() => D.speichereRunde({ ...r, datum, quartal: quartalVon(datum), token, manuell }), 'Runde gespeichert.');
  }
  else if (a === 'runde-loeschen') {
    const r = S.runden.find(x => x.id === w); if (!r) return;
    if (!confirm(`Gesamtrunde vom ${datumText(r.datum)} mit ${r.spiele.length} Spiel(en) wirklich löschen?`)) return;
    await schreibe(() => D.loescheRunde(w), 'Runde gelöscht.');
  }
  else if (a === 'korrektur-loeschen') {
    if (!confirm('Korrektur löschen?')) return;
    await schreibe(() => D.loescheKorrektur(w), 'Korrektur gelöscht.');
  }
});

app.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.aktion === 'foto' && t.files && t.files[0]) {
    const datei = t.files[0];
    const bild = URL.createObjectURL(datei);
    S.review = { bild, laeuft: true, fortschritt: 'Start …', zeilen: leereZeilen(), hinweise: [], runde: aktuelleRunde()?.id || 'neu', datum: heute(), sieger: '', wmVerlierer: '' };
    zeichne();
    try {
      const r = await erkenneFoto(datei, txt => { if (S.review) { S.review.fortschritt = txt; const p = app.querySelector('.karte .hinweis'); if (p) p.textContent = txt; } });
      if (!S.review) return;
      S.review.zeilen = r.zeilen.map(z => ({ spieler: z.spieler, team: z.team, werte: z.werte }));
      S.review.hinweise = r.hinweise;
    } catch (err) {
      if (!S.review) return;
      S.review.hinweise = ['Texterkennung fehlgeschlagen: ' + D.fehlerText(err) + ' – bitte von Hand eintragen.'];
    }
    S.review.laeuft = false; zeichne();
    return;
  }
  if (t.closest('form[data-form=review]')) reviewEingabe(t, true);
});
app.addEventListener('input', e => { if (e.target.closest('form[data-form=review]')) reviewEingabe(e.target, false); });

function reviewEingabe(t, geaendert) {
  const rv = S.review; if (!rv) return;
  const n = t.name;
  if (n === 'runde') { rv.runde = t.value; const f = app.querySelector('[data-feld=datum]'); if (f) f.classList.toggle('versteckt', t.value !== 'neu'); return; }
  if (n === 'datum') { rv.datum = t.value; return; }
  if (n === 'sieger') { rv.sieger = t.value; return; }
  if (n === 'wmVerlierer') { rv.wmVerlierer = t.value; return; }
  let m;
  if ((m = n.match(/^team-(\d)$/))) { rv.zeilen[+m[1]].team = t.value; t.closest('tr').className = t.value; rv.sieger = ''; rv.wmVerlierer = ''; }
  else if ((m = n.match(/^w-(\d)-(\w+)$/))) { rv.zeilen[+m[1]].werte[m[2]] = t.value; }
  else return;
  if (geaendert || n.startsWith('w-')) { const info = document.getElementById('review-info'); if (info) info.innerHTML = reviewInfo(); }
}

app.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, art = f.dataset.form;
  if (art === 'login') {
    S.beschaeftigt = true; zeichne();
    try { await D.anmelden(f.email?.value || '', f.passwort?.value || '', u => { S.admin = u; }); }
    catch (err) { S.beschaeftigt = false; meldung(D.fehlerText(err), 'fehler'); return; }
    S.beschaeftigt = false; zeichne();
  }
  else if (art === 'korrektur') {
    const k = { id: D.neueId(), quartal: f.quartal.value, spieler: f.spieler.value, punkte: Number(f.punkte.value), grund: f.grund.value.trim(), erstellt: Date.now() };
    if (!Number.isInteger(k.punkte) || k.punkte === 0) return meldung('Bitte eine ganze Zahl ungleich 0 eingeben.', 'fehler');
    await schreibe(() => D.speichereKorrektur(k), 'Korrektur gespeichert.');
  }
  else if (art === 'review') await reviewSpeichern();
});

async function reviewSpeichern() {
  const rv = S.review; const d = reviewDaten();
  if (!d.art) return meldung('Teams ungültig: 2 gegen 2 oder 1 gegen 3.', 'fehler');
  if (d.fehlend) return meldung('Bitte bei allen Spielern alle Werte als ganze Zahlen eintragen.', 'fehler');
  const werte = {}; [...d.blau, ...d.orange].forEach(p => werte[p] = d.werte[p]);
  let spiel;
  if (d.art === 'normal') {
    const tb = d.blau.reduce((a, p) => a + werte[p].tore, 0), to = d.orange.reduce((a, p) => a + werte[p].tore, 0);
    const sieger = rv.sieger || (tb > to ? 'blau' : to > tb ? 'orange' : '');
    if (!sieger) return meldung('Gleichstand bei den Toren – bitte den Sieger auswählen.', 'fehler');
    spiel = { art: 'normal', blau: d.blau, orange: d.orange, werte, sieger, siegerManuell: !!rv.sieger };
  } else {
    spiel = { art: 'weltmeister', blau: d.blau, orange: d.orange, werte, sieger: null };
    const w = wmAuswertung(spiel);
    const verl = rv.wmVerlierer || (w.ohneTor.length === 1 ? w.ohneTor[0] : '');
    if (!verl) return meldung('Bitte den Weltmeister-Verlierer auswählen.', 'fehler');
    if (rv.wmVerlierer) spiel.wmVerlierer = rv.wmVerlierer;
  }

  let runde;
  if (rv.spielId) {
    runde = S.runden.find(x => x.id === rv.runde); if (!runde) return meldung('Runde nicht gefunden.', 'fehler');
    const alt = runde.spiele.find(x => x.id === rv.spielId);
    spiel = { ...spiel, id: rv.spielId, zeit: alt?.zeit || Date.now() };
    runde = { ...runde, spiele: runde.spiele.map(x => x.id === rv.spielId ? spiel : x) };
  } else {
    spiel = { ...spiel, id: D.neueId(), zeit: Date.now() };
    if (rv.runde === 'neu') {
      const datum = rv.datum || heute();
      runde = { id: D.neueId(), datum, quartal: quartalVon(datum), token: [], spiele: [], manuell: {}, erstellt: Date.now() };
    } else {
      runde = S.runden.find(x => x.id === rv.runde); if (!runde) return meldung('Runde nicht gefunden.', 'fehler');
    }
    const a = auswertungRunde(runde);
    if (spiel.art === 'normal') {
      const duell = a.duelle.find(x => x.partner === paarungVon(spiel));
      if (duell?.sieger && !confirm('Dieses Duell ist in der Runde schon entschieden (2 Siege). Spiel trotzdem speichern? Es zählt dann nicht.')) return;
    } else if (a.typ !== 'weltmeister' && !confirm('In dieser Runde ist (noch) kein Weltmeister fällig. Trotzdem speichern?')) return;
    else if (a.wmSpiele.length && !confirm('In dieser Runde gibt es schon ein Weltmeister-Spiel. Trotzdem ein weiteres speichern? Gewertet wird das erste.')) return;
    runde = { ...runde, spiele: [...(runde.spiele || []), spiel] };
  }
  const ok = await schreibe(() => D.speichereRunde(runde), 'Spiel gespeichert.');
  if (ok) {
    if (rv.bild) URL.revokeObjectURL(rv.bild);
    S.review = null; S.offen[runde.id] = true;
    const a = auswertungRunde(runde);
    if (a.status === 'Weltmeister ausstehend') meldung(`Alle Duelle gespielt: ${a.champion} hat alles gewonnen – jetzt kommt der Weltmeister!`);
    else if (a.status === 'abgeschlossen' && a.verlierer) meldung(`Gesamtrunde beendet: ${a.verlierer} bekommt ${a.punkte} Verliererpunkt${a.punkte === 1 ? '' : 'e'}.`);
    zeichne();
  }
}

async function schreibe(fn, text) {
  try { await fn(); meldung(text); return true; }
  catch (err) { meldung(D.fehlerText(err), 'fehler'); return false; }
}

zeichne();
