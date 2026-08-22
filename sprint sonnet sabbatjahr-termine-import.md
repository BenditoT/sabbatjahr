# Sprint Sonnet — Termine-Import aus JSON-Datei

> **Session-Typ:** Sonnet — gestartet als Subagent von Fable, 20.08.2026
> **Projektordner:** `~/Downloads/Codex playground/sabbatjahr/`
> **Sandbox-Mount (bash):** `/sessions/sweet-serene-keller/mnt/Codex playground/sabbatjahr/`
> **Kanonischer Stand:** `HANDOVER.md` — zuerst lesen.

## Kontext & Problem

Norbert hat 22 Konzerttermine (12.09.2026–23.07.2027) geliefert. Sie liegen fertig
konvertiert in `termine-events.json` (Schema = `sj_events` laut
`pocketbase/README.md`: `title`, `date_start`, `date_end`, `all_day`, `category`,
`location`, `url`, `notes` — **ohne** `owner`, der wird beim Anlegen gesetzt).

Er will sie **jetzt** in der Timeline sehen. Zwei Hindernisse:

1. Das PocketBase-Backend ist noch nicht ausgerollt (Superuser-Passwort-Thema).
2. Die Datei darf **nicht** ins Repo — `BenditoT/sabbatjahr` ist **public**, ein
   privater Terminkalender gehört da nicht hin. Sie steht bereits in `.gitignore`.

## Ziel

Ein Import-Knopf in der App: Norbert wählt `termine-events.json` von seiner Platte,
die Termine erscheinen in der Timeline. Funktioniert **im Demo-Modus ohne Backend**
und später genauso gegen PocketBase. Die Datei verlässt seinen Rechner nie.

## Aufgaben

1. **Import-UI in der Timeline-Ansicht** (`index.html`), neben „+ Neuer Termin":
   Button **„Termine importieren"** → verstecktes `<input type="file" accept=".json,application/json">`.
   Nach Auswahl: Datei clientseitig per `FileReader` lesen, JSON parsen.
2. **Validieren, bevor irgendetwas übernommen wird.** Erwartet wird ein Array von
   Objekten mit mindestens `title` (nicht leer) und `date_start` (Muster `YYYY-MM-DD`).
   Unbekannte Felder ignorieren; `category` nur übernehmen, wenn sie zu den erlaubten
   Werten gehört (`tango musik familie schule steuer reise sonstiges`), sonst
   `sonstiges`. Bei kaputter Datei: verständliche Fehlermeldung im UI, **nichts** importieren.
3. **Vorschau-Dialog vor dem Übernehmen:** „X Termine gefunden, Y werden übersprungen
   (bereits vorhanden)" plus die ersten ~5 Titel mit Datum. Erst auf Bestätigung importieren.
   Abbrechen muss möglich sein (auch per ESC — Modal-Muster der App verwenden,
   `useLayoutEffect`, siehe ESC-Bug in `HANDOVER.md`).
4. **Duplikat-Schutz:** Ein Termin gilt als vorhanden, wenn `title` **und** `date_start`
   identisch mit einem bestehenden sind. Solche werden übersprungen, nicht doppelt angelegt.
   Damit ist ein zweiter Import derselben Datei gefahrlos.
5. **Beide Modi bedienen:** Im Demo-Modus in den Mock-State schreiben (wie „+ Neuer
   Termin"); im `pocketbase`-Modus über dieselbe DataService-Methode wie das normale
   Anlegen, damit `owner` korrekt gesetzt wird. **Keine Sonderpfade am DataService vorbei.**
6. **Rückmeldung** nach dem Import über das vorhandene Toast-/Meldungsmuster:
   „18 Termine importiert, 4 übersprungen." Danach zeigt die Timeline sie sofort
   (kein manueller Reload nötig).
7. **Ein Playwright-Smoke-Test** in `tests/e2e/`: im Demo-Modus eine **generische**
   Fixture-JSON (2–3 erfundene Termine, KEINE echten Daten von Norbert) hochladen,
   prüfen dass sie in der Timeline erscheinen, und dass ein zweiter Import derselben
   Datei nichts dupliziert. Fixture unter `tests/fixtures/` ablegen.
8. **Versionsnummer** (`SJ_VERSION`) erhöhen, falls die App eine führt.

## Scope-Grenze

Mach NUR diese Aufgaben. NICHT anfassen: `pocketbase/` (Backend/Migrationen/Runbook),
`.github/workflows/ci.yml`, die Demo-Beispieldaten (bleiben generisch!), keine
weiteren Features, kein Redesign. **`termine-events.json` NICHT ins Repo aufnehmen**
und nicht aus `.gitignore` entfernen. Kein `git init`, keine Git-Operationen, kein Push.

## Operative Hinweise

- Datei-Tools (Read/Write/Edit) nutzen Mac-Pfade; bash sieht denselben Ordner unter
  dem Mount-Pfad oben. Absolute Pfade, kein cwd-Carryover.
- Die App ist Preact+htm via CDN, `React.createElement`-frei, Single-File — Stil und
  vorhandene Komponenten (Modal, Toast, Buttons) wiederverwenden, nichts Neues erfinden.
- Playwright kann in der Sandbox **nicht** laufen (kein Chromium). Test trotzdem
  sauber schreiben — er läuft in GitHub Actions. Syntax/Logik sorgfältig prüfen,
  Selektoren an den bestehenden Specs orientieren (`tests/fixtures/app.ts`).
- Für Datei-Uploads in Playwright `setInputFiles` verwenden.

## Abschlusspflicht

`HANDOVER.md` aktualisieren (neues Feature, wie Norbert es benutzt, Test-Stand).
Abschlussmeldung mit: geänderte Dateien, wie der Import bedient wird (2–3 Sätze),
Testname, offene Punkte.
