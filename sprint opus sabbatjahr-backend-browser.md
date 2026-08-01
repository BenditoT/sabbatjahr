# Sprint Opus — Sabbatjahr-Backend als Browser-Import vorbereiten

> **Session-Typ:** Opus (Architektur/Sicherheit) — gestartet als Subagent von Fable, 01.08.2026
> **Projektordner:** `~/Downloads/Codex playground/sabbatjahr/`
> **Sandbox-Mount (bash):** `/sessions/sweet-serene-keller/mnt/Codex playground/sabbatjahr/`
> **Kanonischer Stand:** `HANDOVER.md` — zuerst lesen. Interface-Vertrag: `pocketbase/README.md`.

## Kontext

Die Sabbatjahr-App (Preact+htm Single-File, PocketBase-Backend) ist lokal fertig.
Das Backend-Schema existiert als 2 idempotente Migrationen in `pocketbase/pb_migrations/`
und wurde lokal gegen die echte PocketBase-Binary 0.37.4 mit 56/56 Tests verifiziert.

**Problem:** Kein SSH-Zugang zu pb.tangojam.de von diesem Mac (Schlüssel nicht in
`authorized_keys`, Passwort-Login aus). Norbert hat am 31.07. entschieden: Das Backend
wird **über die PocketBase-Admin-UI im Browser** ausgerollt, nicht per SSH.
Die Admin-UI kann Collections als JSON importieren („Import collections").

## Ziel

Eine **verifizierte** `pocketbase/import-collections.json`, die per Admin-UI-Import auf
pb.tangojam.de exakt dasselbe Schema erzeugt wie die Migrationen — bewiesen durch einen
lokalen Testlauf gegen die echte Binary, nicht durch Hoffnung.

## Aufgaben

1. **Import-JSON ableiten.** Aus `pocketbase/pb_migrations/*.js` die Datei
   `pocketbase/import-collections.json` im Format „Import collections" von
   PocketBase 0.37 erzeugen. Inhalt: die fünf Collections `sj_users` (auth),
   `sj_dreams`, `sj_events`, `sj_projects`, `sj_weeks` — mit ALLEN Feldern, Indizes
   und Rules exakt wie im Interface-Vertrag `pocketbase/README.md`.
   - `sj_users`: Auth-Collection, **kein Self-Signup**, Passwort-Mindestlänge 12.
   - Rules strikt owner-scoped: `owner = @request.auth.id` **und**
     `@request.auth.collectionName = "sj_users"` — auf allen vier Daten-Collections,
     für list/view/create/update/delete (create sinngemäß über `@request.body.owner`
     bzw. wie im Vertrag definiert).
2. **Lokal beweisen.** Echte PocketBase-Binary 0.37.4 in der Sandbox starten
   (Download nach `/tmp`, NICHT in den Mount), eine frische Instanz hochziehen,
   die JSON über die Import-API/CLI einspielen und
   `pocketbase/tests/pb-local-test.sh` dagegen laufen lassen.
   **Akzeptanz: 56/56 grün, inklusive Negativtests.** Rot → Ursache fixen in der
   JSON, erneut laufen lassen. Ergebnis in `pocketbase/TESTLOG.md` ergänzen
   (neuer Abschnitt, Datum 01.08.2026, Import-Weg).
3. **Rules-Äquivalenz + Sicherheits-Kurzcheck.** Feld-für-Feld-Abgleich
   JSON ↔ Interface-Vertrag ↔ Migrationen. Explizit prüfen und im TESTLOG
   dokumentieren: kein Self-Signup möglich, keine offene `listRule` (besonders
   `sj_weeks` — persönliche Reflexion!), keine Rule leer/`null` wo sie scharf sein muss.
4. **RUNBOOK erweitern.** `pocketbase/RUNBOOK.md`: neuen Abschnitt **„Variante A —
   Browser-Import (empfohlen)"** VOR dem SSH-Weg einfügen. Nummerierte Schritte für
   Norbert bzw. Claude in Chrome: Login `https://pb.tangojam.de/_/` → Settings →
   Import collections → Datei wählen → Review → Confirm. Danach: App-Account in
   `sj_users` anlegen (E-Mail, Passwort ≥12 Zeichen, `verified` an), Auto-Backup in
   Settings aktivieren. SSH-Weg als **Variante B** stehen lassen (mit Hinweis, dass
   der MacBook-Schlüssel `macbook-air-nk` erst in `authorized_keys` muss).
   **RUNBOOK.md nicht löschen, nichts entfernen.**

## Scope-Grenze

Mach NUR diese Aufgaben. NICHT anfassen: `index.html`, `tests/`, CI/Deploy
(macht der Sonnet-Sprint), keine „Verbesserungen" an Migrationen oder Schema.
Keine Secrets/Passwörter in irgendeine Datei. Kein `git init`, keine Git-Operationen.
Keine Netzzugriffe auf pb.tangojam.de (aus der Sandbox ohnehin nicht erreichbar —
nicht dagegen ankämpfen).

## Operative Hinweise

- Binary-Download + `pb_data` der Testinstanz nach `/tmp`, nicht in den Mount
  (der Mount kann keine Lock-/Tempdateien löschen).
- PocketBase im Hintergrund starten: `nohup … > /tmp/pb.log 2>&1 &`, dann Log tailen.
- Falls der Binary-Download scheitert: GitHub-Releases-URL für
  `pocketbase_0.37.4_linux_amd64.zip` verwenden; scheitert auch das, im Abschluss
  klar als Blocker melden statt zu raten.

## Abschlusspflicht

Am Ende: `HANDOVER.md` aktualisieren (Abschnitt „Stand" — Backend-Import-JSON
verifiziert, Testergebnis, was noch offen ist). Kurze Abschlussmeldung mit:
Testergebnis (x/56), Pfad der JSON, geänderte Dateien, offene Punkte.
