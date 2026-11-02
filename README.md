# Ananas – Einrichtung

Web-App für die Rocket-League-Statistik (4 Spieler, 2 gegen 2, goldene Ananas pro Quartal).
Läuft auf GitHub Pages, Daten in Firebase (Gratis-Tarif Spark). Ohne Firebase-Daten läuft die App im Demo-Modus (nur auf dem Gerät).

## 1. Firebase (einmalig)
1. console.firebase.google.com → „Projekt erstellen“ → Name `ananas`, Google Analytics aus.
2. „Datenbanken & Speicher“ → „Firestore“ → „Datenbank erstellen“ → Edition „Standard“, Standort Europa (z. B. `eur3`), „Produktionsmodus“.
3. „Sicherheit“/„Build“ → „Authentication“ → „Jetzt starten“ → Anbieter „E-Mail/Passwort“ aktivieren.
4. Authentication → „Nutzer“ → „Nutzer hinzufügen“: deine E-Mail + ein Passwort. Danach die **Nutzer-UID** kopieren.
5. Firestore → Reiter „Regeln“: Inhalt der Datei `firestore.rules` einfügen, `ADMIN_UID` durch deine UID ersetzen → „Veröffentlichen“.
6. Projekteinstellungen (Zahnrad) → „Meine Apps“ → Web-Symbol `</>` → Name `Ananas`, Hosting nicht ankreuzen → „App registrieren“ → Block `const firebaseConfig = { … }` an Claude schicken (oder selbst in `firebase-config.js` statt `null` einsetzen).
7. Authentication → „Einstellungen“ → „Autorisierte Domains“ → `<github-name>.github.io` hinzufügen.

## 2. GitHub
1. Neues öffentliches Repository `ananas`.
2. ZIP entpacken → „Add file → Upload files“ → alle Dateien hineinziehen → „Commit changes“.
3. Settings → Pages → Branch `main`, Ordner `/ (root)` → Save. Nach 1–2 Minuten: `https://<github-name>.github.io/ananas/`.
4. Am iPhone in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Link an die Mitspieler schicken.

## Bedienung
- **Start:** Verliererpunkte, goldene Ananas, Ananas Auto, Token, Statistik je Quartal oder gesamt.
- **Spiele:** alle Gesamtrunden mit Duellen und Werten je Spiel.
- **Admin:** Foto vom Endstand hochladen → Werte prüfen → Speichern. Spiele bearbeiten/löschen, Token, Verlierer und Punkte je Runde ändern, Korrekturen der Verliererpunkte.

## Regeln in der App
- 2 gegen 2, jede der 3 Teamkombinationen spielt ein Duell auf 2 gewonnene Spiele (= Gesamtrunde).
- Sieger eines Spiels: Team mit mehr Toren (bei Gleichstand wählt der Admin).
- Verliert ein Spieler alle 3 Duelle → 1 Verliererpunkt + Ananas Auto im nächsten Spiel.
- Gewinnt ein Spieler alle 3 Duelle → Weltmeister (1 gegen 3): Er steht im Tor (Weltmeister-Champion), wer aus dem Dreierteam ein Tor schießt hat „Weltmeister gewonnen“, der Spieler ohne Tor bekommt den Verliererpunkt („Weltmeister verloren“).
- Token: 1 je Spieler und Quartal, höchstens 2 je Gesamtrunde → Verliererpunkte ×2 bzw. ×4.
- Quartale: Jän–Mär, Apr–Jun, Jul–Sep, Okt–Dez. Wer am Quartalsende die meisten Verliererpunkte hat, bekommt die goldene Ananas.
