// Ananas – Datenspeicher: Firebase (online) oder Demo (nur dieses Gerät)
import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/12.19.0/';
export const demo = !firebaseConfig || !firebaseConfig.apiKey || String(firebaseConfig.apiKey).startsWith('HIER');

let fs = null, db = null, auth = null, au = null;

// ---------- Demo ----------
const DEMO_KEY = 'ananas-demo-v1';
let demoListener = null;
function demoLesen() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || { runden: [], korrekturen: [] }; } catch { return { runden: [], korrekturen: [] }; }
}
function demoSchreiben(d) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch { /* Speicher voll oder gesperrt */ }
  demoListener && demoListener(structuredClone(d));
}

// ---------- Start ----------
export async function starte(onDaten, onFehler) {
  if (demo) {
    demoListener = onDaten;
    onDaten(demoLesen());
    return;
  }
  const app = await import(FB + 'firebase-app.js');
  fs = await import(FB + 'firebase-firestore.js');
  au = await import(FB + 'firebase-auth.js');
  const fbApp = app.initializeApp(firebaseConfig);
  db = fs.getFirestore(fbApp);
  auth = au.getAuth(fbApp);
  const stand = { runden: null, korrekturen: null };
  const melde = () => { if (stand.runden && stand.korrekturen) onDaten({ runden: stand.runden, korrekturen: stand.korrekturen }); };
  fs.onSnapshot(fs.collection(db, 'runden'), snap => { stand.runden = snap.docs.map(d => d.data()); melde(); }, e => onFehler(e));
  fs.onSnapshot(fs.collection(db, 'korrekturen'), snap => { stand.korrekturen = snap.docs.map(d => d.data()); melde(); }, e => onFehler(e));
}

// ---------- Schreiben ----------
export async function speichereRunde(r) {
  if (demo) { const d = demoLesen(); d.runden = d.runden.filter(x => x.id !== r.id).concat([r]); demoSchreiben(d); return; }
  await fs.setDoc(fs.doc(db, 'runden', r.id), JSON.parse(JSON.stringify(r)));
}
export async function loescheRunde(id) {
  if (demo) { const d = demoLesen(); d.runden = d.runden.filter(x => x.id !== id); demoSchreiben(d); return; }
  await fs.deleteDoc(fs.doc(db, 'runden', id));
}
export async function speichereKorrektur(k) {
  if (demo) { const d = demoLesen(); d.korrekturen = d.korrekturen.filter(x => x.id !== k.id).concat([k]); demoSchreiben(d); return; }
  await fs.setDoc(fs.doc(db, 'korrekturen', k.id), k);
}
export async function loescheKorrektur(id) {
  if (demo) { const d = demoLesen(); d.korrekturen = d.korrekturen.filter(x => x.id !== id); demoSchreiben(d); return; }
  await fs.deleteDoc(fs.doc(db, 'korrekturen', id));
}

// ---------- Admin-Anmeldung ----------
export function beobachteAdmin(cb) {
  if (demo) { cb(sessionStorage.getItem('ananas-demo-admin') ? { email: 'Demo-Admin' } : null); return; }
  au.onAuthStateChanged(auth, u => cb(u ? { email: u.email, uid: u.uid } : null));
}
export async function anmelden(email, passwort, cb) {
  if (demo) { sessionStorage.setItem('ananas-demo-admin', '1'); cb({ email: 'Demo-Admin' }); return; }
  await au.signInWithEmailAndPassword(auth, email, passwort);
}
export async function abmelden(cb) {
  if (demo) { sessionStorage.removeItem('ananas-demo-admin'); cb(null); return; }
  await au.signOut(auth);
}

export function neueId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function fehlerText(e) {
  const c = e && e.code || '';
  if (c.includes('permission-denied')) return 'Keine Berechtigung: Nur der Admin darf ändern (Anmeldung oder Firestore-Regeln prüfen).';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email')) return 'E-Mail oder Passwort falsch.';
  if (c.includes('too-many-requests')) return 'Zu viele Versuche – bitte später erneut probieren.';
  if (c.includes('unavailable') || c.includes('network')) return 'Keine Verbindung zum Server – Internet prüfen.';
  return (e && e.message) || String(e);
}
