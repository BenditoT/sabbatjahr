# HANDOVER — Sabbatjahr-App

> Kanonische Übergabedatei dieses Projekts. Immer HIER aktualisieren, keine neuen Versions-Dateien.
> Letztes Update: **21.08.2026, Sonnet-Session (Termine-Import aus JSON-Datei, `SJ_VERSION` 1.1.0)**

## Projekt

Private Single-User-Web-App für Norberts Sabbatjahr (**30.07.2026 – 11.09.2027**,
Ende Sommerferien BW 2027). Vier Module: Träume/Bucketlist, Termine-Timeline,
Scanner-Projektboard (WIP-Limit 3), Wochenrhythmus/Reflexion.

**Ziel / Fertig wenn:** Norbert loggt sich auf der Pages-URL mit seinem
PocketBase-Account ein und pflegt alle vier Module produktiv.

## Entscheidungen (30.07.2026, mit Norbert geklärt)

| Thema | Entscheidung |
|---|---|
| Backend | PocketBase selbst gehostet (pb.tangojam.de) — kein Supabase, kein localStorage-only |
| Frontend | Preact+htm Single-File `index.html`, kein Build-Tool |
| Hosting | GitHub Pages, Account BenditoT, Repo `sabbatjahr` |
| Zugang | PocketBase-Login (1 User Norbert) statt client-seitigem Passwort-Gate |
| Scope v1 | KEIN PWA/Offline, keine Notifications, kein Kalender-Sync |

## Stand

- [x] Planung, Modell-Split, Sprint-Dateien (Fable, 30.07.)
- [x] **Backend (Opus, 30.07.):** PocketBase-Schema, owner-scoped Rules, 2 idempotente
      Migrationen, Lokaltest 56/56 grün, Interface-Vertrag, Sicherheitscheck, Runbook → `pocketbase/`
- [x] **Frontend (Sonnet, 31.07.):** `index.html` (88 KB) mit 5 Ansichten,
      DataService `demo`/`pocketbase`, Bordeaux/Gold-Design, Playwright-Smokes in `tests/e2e/`
- [x] **Rote Tests analysiert und gefixt (Opus, 31.07.)** — siehe nächster Abschnitt
- [x] **Backend als Browser-Import verifiziert (Opus, 01.08.):** `pocketbase/import-collections.json`
      aus den Migrationen abgeleitet, Schema Feld für Feld identisch, **56/56 grün** gegen
      eine Instanz, die ausschließlich aus diesem Import entstanden ist → `pocketbase/TESTLOG.md`
- [x] **CI-Gate + GitHub Pages Deploy vorbereitet (Sonnet, 01.08.):** `.github/workflows/ci.yml`
      geschrieben, Repo `BenditoT/sabbatjahr` + Pages-Source „GitHub Actions" per Claude in
      Chrome angelegt → Details im nächsten Abschnitt
- [x] **Push ausgeführt (Norbert, 02.08.):** Commit `107ee43`, 24 Dateien. CI-Lauf
      [#30722751190](https://github.com/BenditoT/sabbatjahr/actions/runs/30722751190)
      **grün** (Playwright im echten Chromium ✅, Pages-Deploy ✅). Live-URL
      [benditot.github.io/sabbatjahr](https://benditot.github.io/sabbatjahr/) antwortet
      mit 200, Login-Maske per Screenshot verifiziert (Fable, 02.08.)
- [ ] **Backend ausrollen: `pocketbase/RUNBOOK.md`, Variante A** (Admin-UI → Import
      collections → App-Account in `sj_users` → Auto-Backup). ⚠️ Schalter „Merge with the
      existing collections" MUSS an sein — sonst löscht der Import die anderen Apps.
- [ ] Gemeinsamer Live-Test (Login, echte Daten eintragen)
- [x] **Termine-Import aus JSON-Datei (Sonnet, 21.08.):** Timeline-Ansicht kann
      `termine-events.json` (oder jede kompatible Datei) direkt einlesen — siehe Abschnitt
      unten. Funktioniert in Demo- und PocketBase-Modus, `SJ_VERSION` → `1.1.0`.

## Was am 21.08.2026 passiert ist (Sonnet, Termine-Import aus JSON-Datei)

Norbert hatte 22 Konzerttermine fertig in `termine-events.json` liegen (Schema exakt
`sj_events`), aber das Backend ist noch nicht ausgerollt. Er wollte die Termine trotzdem
**sofort** in der Timeline sehen, ohne dass die Datei je das Repo oder gar seinen
Rechner verlässt.

**Bedienung:** Timeline-Ansicht → Knopf **„Termine importieren"** neben „+ Neuer
Termin" öffnet den nativen Datei-Dialog (verstecktes `<input type="file"
accept=".json,application/json">`). Die gewählte Datei wird ausschließlich clientseitig
per `FileReader` gelesen — es gibt keinen Upload, keinen Netzwerk-Request für die Datei
selbst. Danach erscheint ein Vorschau-Modal („X Termine gefunden, Y werden übersprungen
(bereits vorhanden)" + die ersten 5 Titel mit Datum), erst ein Klick auf „N Termine
übernehmen" schreibt sie wirklich. Abbrechen geht per Knopf oder ESC.

**Was dabei umgesetzt wurde:**
1. **Strikte Validierung vor jeder Übernahme** (`parseImportEvents`): Datei muss ein
   JSON-Array sein, jeder Eintrag braucht ein nicht-leeres `title` und ein `date_start`
   im Muster `JJJJ-MM-TT`. Schon der erste ungültige Eintrag bricht die gesamte Datei
   ab — „validieren, bevor irgendetwas übernommen wird" heißt hier bewusst alles-oder-
   nichts, nicht zeilenweise überspringen. Fehlermeldung kommt als Toast, verständlich
   auf Deutsch, mit Eintrags-Nummer. Unbekannte `category`-Werte fallen automatisch auf
   `sonstiges` zurück, unbekannte Felder werden ignoriert.
2. **Duplikat-Schutz** (`eventDedupeKey` = `title.trim() + date_start`): vergleicht
   gegen die aktuell geladenen Termine UND gegen bereits im selben Import gesehene
   Einträge. Ein zweiter Import derselben Datei überspringt dadurch alles — gefahrlos
   wiederholbar.
3. **Beide Modi über denselben Weg:** Der Import ruft pro neuem Termin ganz normal
   `dataService.createEvent(payload)` auf — exakt dieselbe Methode wie „+ Neuer
   Termin". Kein Sonderpfad am DataService vorbei, `owner` wird im PocketBase-Modus
   also korrekt gesetzt, im Demo-Modus landet der Termin im selben Mock-State.
4. **ESC-Muster wiederverwendet:** Das Vorschau-Modal ist ein ganz normaler Aufruf von
   `<Modal escRegister=...>` — dieselbe `useLayoutEffect`-Registrierung, die den
   ESC-Bug vom 31.07. behebt (siehe Abschnitt oben). Kein neuer Modal-Code, keine neue
   Falle.
5. **Rückmeldung** über das vorhandene Toast-System: „18 Termine importiert, 4
   übersprungen." Die Timeline zeigt neue Termine sofort (State-Update über
   `onEventsChange`, kein Reload).

**Verifiziert ohne Chromium** (Sandbox kann keinen Browser starten): Das komplette
Modul-Skript aus `index.html` wurde extrahiert und mit `node --check` auf Syntaxfehler
geprüft (grün). Die Validierungs- und Dedup-Logik (`parseImportEvents`,
`eventDedupeKey`) wurde 1:1 aus der Datei kopiert und mit `node -e` gegen mehrere
Fälle durchgespielt: gültige generische Fixture (3 Termine, ein unbekannter
Kategoriewert fällt korrekt auf „sonstiges" zurück), Duplikat-Erkennung gegen
bestehende Termine, zweiter Import derselben Datei (0 neue, 3 übersprungen — keine
Duplikate), interne Duplikate innerhalb einer Datei, sowie fünf kaputte
Datei-Varianten (kein JSON, kein Array, leeres Array, fehlender Titel, falsches
Datumsformat) — alle liefern die erwartete deutsche Fehlermeldung statt eines
Absturzes. Zusätzlich lässt `npx playwright test --list` den neuen Spec sauber
kompilieren und listet beide neuen Tests korrekt auf (bestätigt: kein TS-/Syntaxfehler
im Testfile) — der tatsächliche Chromium-Lauf bleibt wie beim Rest des Projekts GitHub
Actions vorbehalten.

**Neuer Test:** `tests/e2e/smoke-termine-import.spec.ts` (2 Tests) mit generischer
Fixture `tests/fixtures/termine-import.json` (3 erfundene Termine, keine echten Daten).
Test 1 importiert die Fixture, prüft die Vorschau-Zahlen und die drei Titel in der
Timeline, importiert dieselbe Datei ein zweites Mal und prüft, dass alle 3 als
Duplikate erkannt werden (Bestätigen-Knopf zeigt „0 Termine übernehmen" und ist
deaktiviert) und kein Titel doppelt in der Timeline auftaucht. Test 2 lädt kaputtes
JSON (per Buffer, keine echte Datei nötig) und prüft die Fehlermeldung sowie dass
nichts importiert wurde.

**Offen:** Der echte Chromium-Lauf in GitHub Actions steht noch aus (läuft automatisch
beim nächsten Push). `termine-events.json` bleibt wie gehabt außerhalb des Repos.

## Was am 31.07. passiert ist (Opus)

Zwei Playwright-Tests waren rot: „ESC schließt das Traum-Modal" und „ESC schließt
zuerst den WIP-Dialog". Kein Timeout hochgesetzt — Ursache gesucht und gefunden:

**Echter Bug (Race Condition):** Das Modal registrierte seinen ESC-Handler in einem
`useEffect`. Preact führt `useEffect` **nach dem Paint** aus. Zwischen „Modal steht im
DOM / ist sichtbar" und „ESC-Handler ist registriert" lag also ein Frame. Playwright
wartet nur auf „sichtbar" und drückt sofort ESC — dieser Tastendruck fiel ins Leere,
und danach drückt der Test kein zweites Mal. Ein Mensch trifft dieses Fenster selten,
aber es ist ein echter Fehler, kein Test-Problem.

**Fix:** `Modal` registriert jetzt per `useLayoutEffect` (läuft synchron nach dem
DOM-Update, vor dem Paint). Begründung steht als Kommentar im Code.
Zusätzlich behoben: Die Überschrift zeigte wörtlich „Träume &amp; Bucketlist" — eine
HTML-Entity in einem htm-Textknoten wird nicht interpretiert.

**Wie verifiziert — und was das NICHT beweist:** In der Cowork-Sandbox lässt sich kein
Chromium starten (fehlende Systembibliotheken), Playwright läuft dort also nicht.
Stattdessen wurde die App unter **jsdom** geladen (Imports auf lokale preact/htm-Pakete
umgebogen) und beides nachgestellt:

| Szenario | vor dem Fix | nach dem Fix |
|---|---|---|
| ESC sofort nach dem Öffnen (wie Playwright) — Traum-Modal | bleibt offen ❌ | schließt ✅ |
| ESC sofort nach dem Öffnen — WIP-Dialog | bleibt offen ❌ | schließt ✅, Board bleibt „Aktiv (3/3)" |
| ESC nach 200 ms (wie ein Mensch) | schließt ✅ | schließt ✅ |

Das reproduziert die Ursache sauber, **ersetzt aber nicht den echten Chromium-Lauf**.
Der fehlt noch und ist der nächste Schritt.

Aufgeräumt: Debug-Dateien und veraltete `test-results/` entfernt, `.pw-browsers/` in
`.gitignore` ergänzt. Das Projekt ist **noch kein Git-Repo** (ein hier versehentlich
angelegtes `.git` wurde vollständig entfernt, weil die Sandbox keine Lock-Dateien
löschen kann und ein `index.lock` zurückgeblieben wäre — genau die bekannte Falle).

## Was am 01.08. passiert ist (Opus, Backend-Browser-Import)

Ziel war eine Import-Datei für die PocketBase-Admin-UI, die **nachweislich** dasselbe
Schema erzeugt wie die Migrationen — nicht eine, die plausibel aussieht.

1. **Abgeleitet, nicht getippt:** Migrationen auf eine frische 0.37.4-Instanz angewandt,
   die fünf `sj_*`-Collections per API exportiert → `pocketbase/import-collections.json`.
2. **Verglichen:** Zweite frische Instanz ohne Migrationen, Datei über genau den
   Endpunkt der Admin-UI eingespielt (`PUT /api/collections/import`). Rekursiver Diff
   beider Schemata: **identisch**, Feld für Feld, inklusive Rules, Indizes und
   Auth-Optionen.
3. **Getestet:** Das unveränderte `pocketbase/tests/pb-local-test.sh` lief gegen eine
   Instanz, deren Schema ausschließlich aus dem Import stammt → **56/56 grün**,
   inklusive aller Negativtests.
4. **Sicherheits-Kurzcheck:** 160 automatische Prüfungen gegen den Interface-Vertrag,
   0 Abweichungen. Kein Self-Signup, keine offene `listRule` (auch `sj_weeks` nicht),
   keine leere oder fehlende Rule, Passwort-Minimum 12.

**Der eine Fund, der wirklich zählt:** Die Import-Seite der Admin-UI schickt
`deleteMissing: true`, und der Schalter „Merge with the existing collections" ist beim
Öffnen **aus**. Auf der geteilten Instanz `pb.tangojam.de` würde ein Import mit
ausgeschaltetem Schalter **alle anderen Apps löschen** — im Test waren `users` und eine
Fremd-Collection danach weg. Mit eingeschaltetem Schalter bleibt alles erhalten
(auch nachgestellt und geprüft). Das steht als Schritt 5 mit Warnung im Runbook.

## Was am 01.08. passiert ist (Sonnet, CI-Gate + Deploy)

1. **`.github/workflows/ci.yml` geschrieben** (2 Jobs):
   - Job `test`: Ubuntu, Node 20, `npm ci`, `npx playwright install --with-deps chromium`,
     `npx playwright test` (Config unverändert — kein Timeout/Retry erhöht). Bei Rot lädt
     `actions/upload-artifact` den `playwright-report/` als Artifact hoch (`if: failure()`).
   - Job `deploy`: `needs: test`, läuft nur bei grünem Test-Job. Kopiert nur `index.html`
     in ein schlankes `_site/`-Verzeichnis (kein `node_modules` im Artifact), dann
     `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`
     mit `permissions: pages: write, id-token: write`.
   - Trigger: `push` auf `main` + `workflow_dispatch`.
2. **`.gitignore` geprüft:** `node_modules/`, `.pw-browsers/`, `/test-results/`,
   `/playwright-report/`, `.DS_Store` waren bereits vollständig drin — keine Änderung nötig.
3. **Secrets-Grep:** nach `password|token|secret|api[_-]?key` über alle Textdateien
   (außer `node_modules`) gesucht. Alle Treffer sind Feldnamen, Variablennamen in
   Shell-Snippets (`$SU_PW`, `$APP_PW` — interaktiv einzugeben, nicht hartkodiert) oder
   Dokumentationstext. **Keine echten Secrets im Ordner.**
4. **`playwright.config.ts` + Fixtures geprüft, nichts geändert:** `webServer` startet
   `npm run serve` (http-server, als devDependency vorhanden), `reuseExistingServer:
   !process.env.CI` sorgt dafür, dass der Runner immer einen frischen Server startet,
   alle 3 Specs laufen gegen `?forceMode=demo` (keine PocketBase-Verbindung nötig, kein
   externes Netzwerk). `package-lock.json` mit `package.json` synchron geprüft (nötig
   für `npm ci`).
5. **Repo + Pages per Claude in Chrome angelegt** (Skill `github-pages-deploy-via-browser`,
   Browser-Verbindung bestand):
   - `https://github.com/BenditoT/sabbatjahr` neu erstellt: **public, leer** (README/
     .gitignore/License bewusst aus — sonst divergiert die Historie beim ersten Push).
   - Settings → Pages → Source auf **„GitHub Actions"** umgestellt, Bestätigung
     „GitHub Pages source saved." erhalten.
   - Datei-Upload/Erstinhalt bewusst NICHT über den Browser gemacht — das übernimmt
     Norberts Push-Block unten (sauberer, eine Quelle der Wahrheit).

## Backend-Fakten (Kurzfassung, Details in `pocketbase/README.md`)

| | |
|---|---|
| Collections | `sj_users` (auth, kein Self-Signup), `sj_dreams`, `sj_events`, `sj_projects`, `sj_weeks` |
| Auth | eigene `sj_users`-Collection statt zentraler `users` — die Instanz ist mit anderen Apps geteilt |
| Rules | strikt owner-scoped (`owner = @request.auth.id` **plus** `@request.auth.collectionName = "sj_users"`) |
| Server-Code | **keiner** — keine Hooks, kein Goja-Bundle. Nur Collections + Rules. |
| WIP-Limit | bewusst nur im Frontend, nicht serverseitig |
| Getestet gegen | echte PocketBase-Binary v0.37.4, frische lokale Instanz. Produktivserver noch nicht bespielt. |

## Blocker-Stand 01.08.2026

| Blocker | Befund | Entscheidung |
|---|---|---|
| E2E laufen nirgends | Sandbox kann kein Chromium starten (fehlende Systembibliotheken), auf dem MacBook fehlt der Browser-Download | Tests laufen künftig in **GitHub Actions** (Linux-Runner) als Deploy-Gate, nicht lokal |
| Kein Repo / kein Deploy | Projekt liegt nur lokal | ✅ gelöst: Repo `BenditoT/sabbatjahr` (public, leer) + Pages-Source „GitHub Actions" per Claude in Chrome angelegt (01.08.). `ci.yml` liegt bereit. Fehlt nur noch: Norberts Push-Block unten |
| Kein SSH zu pb.tangojam.de | MacBook-Schlüssel (`macbook-air-nk`, `SHA256:E8RCnRpp…`) steht nicht in `authorized_keys`, Passwort-Login aus | ✅ gelöst: Backend wird **über die PocketBase-Admin-UI im Browser** ausgerollt (Norbert-Entscheidung 31.07.). Import-Datei fertig und verifiziert (01.08.), SSH-Weg bleibt als Variante B im Runbook |

## Norberts Push-Block (der einzige Handgriff für CI + Deploy)

Terminal.app (zsh) öffnen, diesen einen Block einfügen und Enter drücken. Er
initialisiert das lokale Projekt als Git-Repo, committet alles und pusht es zum
bereits vorbereiteten leeren GitHub-Repo. Der SSH-Key im Schlüsselbund
(Account BenditoT) übernimmt die Authentifizierung automatisch — kein Passwort,
kein Token nötig.

```zsh
cd "$HOME/Downloads/Codex playground/sabbatjahr" && git init -b main && git add -A && git commit -m "Initial commit: Sabbatjahr-App (Frontend, Tests, CI-Gate, Pages-Deploy)" && git remote add origin git@github.com:BenditoT/sabbatjahr.git && git push -u origin main
```

Danach automatisch, ohne weiteres Zutun:
1. GitHub Actions startet den Workflow `ci.yml` (Job `test`).
2. Playwright installiert echtes Chromium und lässt alle 3 Smoke-Specs laufen.
3. Bei Grün startet Job `deploy` automatisch und veröffentlicht `index.html` auf
   GitHub Pages.
4. Bei Rot bleibt Pages unverändert, und der `playwright-report/` steht als
   Artifact im fehlgeschlagenen Actions-Lauf zum Download bereit.

## Verifikationsplan nach dem Push

1. Actions-Lauf beobachten: [github.com/BenditoT/sabbatjahr/actions](https://github.com/BenditoT/sabbatjahr/actions)
   — gelber Punkt = läuft, grüner Haken = fertig, rotes X = Report-Artifact prüfen.
2. Nach grünem Deploy-Job: Live-URL öffnen
   [benditot.github.io/sabbatjahr/](https://benditot.github.io/sabbatjahr/)
   — Demo-Login sollte erscheinen (App lädt automatisch im `demo`-Modus, solange
   kein PocketBase-Backend konfiguriert ist).
3. Repo-Ansicht zur Kontrolle: [github.com/BenditoT/sabbatjahr](https://github.com/BenditoT/sabbatjahr)
   — `.github/workflows/ci.yml` muss sichtbar sein, `node_modules/` NICHT (per `.gitignore`).

## Reihenfolge

1. ~~Opus: Backend~~ ✅ · ~~Sonnet: Frontend~~ ✅ · ~~Opus: ESC-Bug~~ ✅ ·
   ~~Sonnet: CI-Gate + Pages-Setup~~ ✅
2. ~~Norbert: Push-Block~~ ✅ 02.08. — CI grün im echten Chromium, Pages live.
3. **Backend ausrollen:** `pocketbase/RUNBOOK.md`, Variante A — Norbert loggt sich in
   `https://pb.tangojam.de/_/` ein, Claude in Chrome übernimmt Import (⚠️ Merge-Schalter
   AN) und Kontrolle; App-Passwort tippt Norbert.
4. Gemeinsamer Live-Test (Login auf der Pages-URL, je ein Datensatz pro Modul,
   Reload-Prüfung — Falle `normalizer-drift-reload-bug`)

## Dateien

- `index.html` — die App (Preact+htm, Single-File)
- `tests/e2e/` — 4 Smoke-Specs (inkl. `smoke-termine-import.spec.ts`), `tests/fixtures/app.ts`
  (Login-Helper, `?forceMode=demo`), `tests/fixtures/termine-import.json` (generische Import-Fixture)
- `.github/workflows/ci.yml` — Test-Gate (echtes Chromium) + Pages-Deploy bei Grün
- `sprint sonnet sabbatjahr.md` — Frontend-Sprint (Deploy-Teil noch offen)
- `sprint sonnet sabbatjahr-deploy.md` — CI/Deploy-Sprint (erledigt, dieses Update)
- `sprint opus sabbatjahr.md` — Backend-Sprint (erledigt)
- `pocketbase/README.md` — **Interface-Vertrag**, einzige Quelle fürs Frontend
- `pocketbase/import-collections.json` — Schema für den Admin-UI-Import (Variante A), verifiziert
- `pocketbase/RUNBOOK.md` — Variante A (Browser-Import, empfohlen) + Variante B (Terminal.app/SSH)
- `pocketbase/TESTLOG.md` / `SICHERHEITSCHECK.md` / `pb_migrations/` / `tests/`

## Offene Punkte / vor dem Live-Gang

- **Norberts Push-Block ausführen** (oben) — einziger offener Schritt für CI + Deploy.
- Starkes, einzigartiges Superuser-Passwort auf `pb.tangojam.de` (nicht identisch mit
  dem App-Passwort) — der Superuser darf alles.
- **Auto-Backup** in den PocketBase-Settings einschalten. `pb_data/data.db` ist die
  einzige Kopie eines ganzen Sabbatjahrs an Reflexion.

## Konzerttermine vorbereitet (20.08.2026)

Norbert hat `Termine.csv` (Export aus seinem Kalender) geliefert: **23 Auftritte**
vom 12.09.2026 bis 23.07.2027. Konvertiert nach `termine-events.json` — importfertig
für `sj_events`, sobald das Backend steht (`owner` wird beim Import gesetzt).

Konvertierungs-Entscheidungen (bewusst so, nicht raten):

| Punkt | Entscheidung |
|---|---|
| Uhrzeiten | landen in `notes`, **nicht** in `date_start`. Grund: Modell und UI (`<input type="date">`, `isoDateOnly`) arbeiten datumsgenau — Uhrzeiten in Date-Feldern hätten einen Zeitzonen-Versatz erzeugt. |
| `title` | `Formation — Ort/Venue` (z. B. „Cuarteto Bien Porteño — Mannheim, Tabakfabrik") |
| `category` | `musik` für alle Auftritte, **`tango`** für den Bendito-Marathon (30.10.–01.11.) |
| Mehrtägig | Spannen aus der CSV als `date_start`/`date_end` übernommen (Wochenend-/Anreisefenster) |
| Schreibweisen | Formationsnamen normalisiert (Bien Porteño, Männer ohne Nerven, Bando Solo …) |

⚠️ **Datenschutz:** `termine-events.json` und `Termine.csv` stehen in `.gitignore` —
das Repo `BenditoT/sabbatjahr` ist **public**, Norberts Terminkalender gehört da nicht hin.

**Von Norbert geklärt (20.08.2026) und eingearbeitet → jetzt 22 Events:**

1. **Nürtingen war eine Doublette.** Auftritt ist **So, 13.12.2026**, der Samstag davor
   sind Proben vor Ort. Beide Zeilen zu EINEM Event 12.–13.12. zusammengeführt, der
   Ablauf steht in den `notes`.
2. **Durlach (18.04.2027) ist unbestätigt** — im Titel als „(unbestätigt)" markiert
   und in den `notes` mit Stand-Datum vermerkt.

## Wunschliste v2 (nicht v1!)

- PWA/Offline, Erinnerung „Wochen-Review fällig" (Scheduled Task), Foto-Upload zu
  erlebten Träumen, Jahres-Rückblick-Export als PDF am Ende des Sabbatjahrs
- Falls sensiblere Einträge dazukommen: E2E-Verschlüsselung der `sj_weeks.review`-Felder
  (bewusster v1-Trade-off, siehe `pocketbase/SICHERHEITSCHECK.md`)

## Einstiegs-Prompt für die nächste Session

> Lies `~/Downloads/Codex playground/sabbatjahr/HANDOVER.md` und führe den nächsten
> offenen Punkt aus der Reihenfolge aus. (Stand 01.08.: CI-Gate + Repo/Pages fertig,
> es fehlt nur noch Norberts Push-Block, dann Backend-Rollout per RUNBOOK.md.)
