# Sprint Sonnet — Sabbatjahr-App: Frontend + Deploy

> **Session-Typ:** Sonnet (Standardarbeit nach klarer Vorgabe)
> **Projektordner:** `~/Downloads/Codex playground/sabbatjahr/`
> **Voraussetzung:** Opus-Sprint abgeschlossen (siehe Abschnitt „Übergabe von Opus" unten — fehlt der, zuerst `sprint opus sabbatjahr.md` in einer Opus-Session ausführen lassen)
> **Erstellt:** 30.07.2026 von Fable (Orchestrator)

## Kontext (ohne Chat-Historie lesbar)

Norbert (Lehrer, Musiker, Tangolehrer, Scanner-Typ: viele parallele Projekte,
Abschließen schwer) hat vom **30.07.2026 bis 11.09.2027** Sabbatjahr. Die App hilft
ihm, dieses eine Jahr bewusst zu gestalten: träumen, Fixpunkte sehen, Projekte
WIRKLICH abschließen, wöchentlich reflektieren.

Entschieden (nicht neu diskutieren):

| Entscheidung | Wert |
|---|---|
| Stack | **Preact+htm Single-File `index.html`**, kein Build-Tool (Skill `preact-webapp`) |
| Backend | PocketBase pb.tangojam.de, Schema von Opus fertig — Interface-Vertrag in `pocketbase/README.md` |
| Auth | PocketBase-Login (E-Mail+Passwort, ein User). Kein separates Passwort-Gate. |
| Deploy | GitHub Pages, Account **BenditoT**, Repo `sabbatjahr`, token-frei per SSH (Skill `git-deploy`) |
| Design | Mobile-first (App wird viel am iPhone genutzt), warm/persönlich — Bordeaux/Gold-Palette wie Norberts Reise-Seiten (Skill `marken-zentrale` prüfen), KEINE Schul-/KRS-Optik |

Skills VOR der Arbeit lesen: `preact-webapp`, `mobile-touch-a11y-quickwins`,
`toast-system`, `git-deploy`, `krs-projekt-playbook` (Fallen-Index, v. a.
Stale-Closure bei Modals und Normalizer-Drift beim Mapping DB→State).

**DataService-Muster (aus `preact-webapp`):** Abstraktionslayer mit zwei Modi —
`?forceMode=demo` = Mock-Daten ohne Backend (für Entwicklung + Tests),
Standard = PocketBase-JS-SDK (via esm.sh, mit CDN-Fallback, Skill `cdn-resilience`).

## Ziel

Fertige, getestete, deployte App unter der BenditoT-Pages-URL, gegen die Norbert
sich einloggen und alle vier Module produktiv nutzen kann.

## Die fünf Ansichten

### 1. Dashboard (Startansicht nach Login)
- **Countdown-Kopf:** „Tag X von 409" + verbleibende Tage bis 11.09.2027 +
  Fortschrittsbalken des Sabbatjahrs (Start 30.07.2026). Ehrlich, nicht dramatisch.
- Nächste 3 Termine, die max. 3 aktiven Projekte mit ihrem `next_action`,
  Frosch der Woche (aus aktuellem `sj_weeks`-Eintrag), 1 zufälliger Traum mit
  Status „idee" als Inspiration („Schon mal drüber nachgedacht?").

### 2. Träume & Bucketlist (`sj_dreams`)
- Karten-Grid, filterbar nach Kategorie/Status; Status-Chips (idee → geplant →
  in_umsetzung → erlebt / verworfen).
- Aktion „→ Projekt daraus machen": legt `sj_projects`-Eintrag an, verlinkt beide.
- Zähler oben: „X geträumt · Y geplant · Z erlebt".

### 3. Timeline (`sj_events`)
- Vertikaler Jahres-Zeitstrahl 30.07.2026–11.09.2027, Monatsmarker, „Heute"-Linie,
  Vergangenes gedimmt. Kategorie-Farben + Filter. Countdown „in N Tagen" je Event.
- Einfache CRUD-Modals. **Stale-Closure-Falle beachten** (funktionale setState-Updates).

### 4. Scanner-Board (`sj_projects`)
- Spalten: Idee / **Aktiv (max. 3!)** / Pausiert / Abgeschlossen (+ Verworfen eingeklappt).
- WIP-Limit soft: Verschieben nach Aktiv bei 3 vorhandenen → freundlich-direkter
  Dialog: „Erst eins abschließen oder pausieren — du kennst dich." (Toast/Modal)
- Jede Karte zeigt `next_action` prominent; leeres `next_action` bei aktivem
  Projekt = sichtbare Warnmarkierung („offenes Ende").
- Abschluss-Feier: Projekt auf „abgeschlossen" → kleines Konfetti/✓-Moment. Ernst
  gemeint: Abschließen ist für Norbert der schwere Teil, das darf sich gut anfühlen.

### 5. Woche (`sj_weeks`)
- Aktuelle Woche (Mo–So): Top-3 der Woche, „Frosch" (die eine unangenehme Sache),
  optional Fokus-Projekt.
- Wochen-Review (4 Felder): Was ist gelungen? Was hängt? Was habe ich gelernt?
  Worauf freue ich mich? + Stimmung 1–5.
- Rückblick-Liste vergangener Wochen (read-only aufklappbar).

## Aufgaben

1. `index.html` bauen (Ansichten wie oben, Login-Screen davor, Tab-Navigation
   unten mobile / Sidebar Desktop, 44px-Touch-Targets, ESC schließt Modals).
2. DataService mit Demo-Modus (realistische, aber fiktive Mock-Daten — Norberts
   echte Träume kommen NICHT ins Repo) + PocketBase-Modus exakt nach
   `pocketbase/README.md`. **Normalizer vollständig halten** — jedes Feld, das
   gespeichert wird, muss auch im Load-Mapping stehen (Skill `normalizer-drift-reload-bug`).
3. Playwright-Smoke-Tests im Demo-Modus (Login-Bypass via forceMode, je Ansicht:
   rendert + Kern-Interaktion; WIP-Limit-Dialog testen). Bei rotem Test: Screenshot
   auswerten, NIE Timeouts hochsetzen.
4. Repo `BenditoT/sabbatjahr` anlegen, Pages aktivieren, per SSH pushen
   (Skill `git-deploy`), Live-URL verifizieren.
5. Manueller Testlauf gegen echtes PocketBase (Login mit Norberts Account) —
   erst danach gilt der Sprint als fertig (Qualität vor Präsentation).

## Akzeptanzkriterien

- [ ] App lädt auf iPhone-Viewport sauber, alle 5 Ansichten bedienbar
- [ ] Demo-Modus funktioniert komplett ohne Backend
- [ ] PB-Modus: Login, CRUD in allen 4 Collections, Daten überleben Reload
- [ ] WIP-Limit-Dialog erscheint beim 4. aktiven Projekt
- [ ] Playwright-Smoke grün (Log im Repo)
- [ ] Live auf GitHub Pages, Countdown zeigt korrekte Tageszahl (Europa/Berlin)
- [ ] Keine echten persönlichen Daten im Repo

## Scope-Grenze

**Mach NUR diese Aufgaben.** Kein Ändern von PocketBase-Schema, Rules oder
Migrationen — bei Schema-Problemen: Handover schreiben, Opus-Session. Keine
Zusatzfeatures (kein PWA/Offline, keine Push-Notifications, kein Kalender-Sync)
— v1 klein halten, Wunschliste in HANDOVER.md notieren.

## Übergabe von Opus

> **Status: erledigt am 30.07.2026.** Backend steht, lokal getestet (56/56 grün),
> Deploy-Runbook liegt bereit. Der Opus-Sprint hat KEIN Frontend angefasst.

### Interface-Vertrag — deine einzige Quelle

**`pocketbase/README.md`** — dort stehen alle Collections, Felder, Select-Werte,
Rules-Konsequenzen, fertige SDK-Rezepte (Login, CRUD, „Traum → Projekt",
`getOrCreateWeek`), das Datumsformat und eine Fehlerbild-Tabelle.
Wenn etwas dort nicht steht, gibt es das im Backend nicht.

Weitere Dateien: `pocketbase/RUNBOOK.md` (Deploy, macht Norbert),
`pocketbase/TESTLOG.md` (was geprüft ist), `pocketbase/SICHERHEITSCHECK.md`.

### Finale Collection- und Feldnamen

| Collection | Felder (zusätzlich immer `id`, `created`, `updated`) |
|---|---|
| `sj_users` (auth) | `email`, `password`, `name`, `verified` |
| `sj_dreams` | `owner`, `title`, `description`, `category`, `status`, `priority`, `target_month`, `project`, `notes` |
| `sj_events` | `owner`, `title`, `date_start`, `date_end`, `all_day`, `category`, `location`, `url`, `notes` |
| `sj_projects` | `owner`, `title`, `status`, `area`, `next_action`, `definition_of_done`, `dream`, `started_at`, `finished_at`, `notes` |
| `sj_weeks` | `owner`, `week_start`, `plan` (json), `review` (json), `mood` |

Select-Werte:
- `sj_dreams.category` / `sj_projects.area`: `reise` `musik` `tango` `familie` `lernen` `gesundheit` `sonstiges`
- `sj_dreams.status`: `idee` `geplant` `in_umsetzung` `erlebt` `verworfen`
- `sj_projects.status`: `idee` `aktiv` `pausiert` `abgeschlossen` `verworfen`
- `sj_events.category`: `tango` `musik` `familie` `schule` `steuer` `reise` `sonstiges`

### Abweichungen vom Sprint-Vorschlag (alle Felder erhalten, nichts gestrichen)

1. **Auth-Collection heißt `sj_users`**, nicht die zentrale `users`. Begründung: die
   Instanz `pb.tangojam.de` ist mit anderen Apps geteilt (Deutschlandreise legt dort
   anonyme Auth-Records an). Eine eigene Collection trennt sauber und erlaubt eine
   Rule, die zusätzlich die Herkunfts-Collection prüft. `createRule = null`, also
   **kein Self-Signup und kein Registrieren-Formular bauen**.
2. **Kein `status`-Default gesetzt.** PocketBase-Select-Felder haben in v0.37 keinen
   sinnvollen Default-Mechanismus für die API. Das Frontend schickt beim Anlegen also
   explizit `status: "idee"` mit — bitte nicht vergessen, sonst bleibt das Feld leer.
3. **`all_day` hat keinen Default `true`.** Gleicher Grund. Beim Anlegen von Terminen
   `all_day: true` explizit mitschicken, wenn das die Voreinstellung im Formular ist.
4. **Zusätzliche Längenlimits** (Sicherheit/Validierung, keine Feature-Änderung):
   `title` ≤ 200, `description` ≤ 2000, `notes` ≤ 5000, `next_action` ≤ 500,
   `definition_of_done` ≤ 1000, `location` ≤ 300, JSON-Felder ≤ 20 KB.
   Bitte `maxlength` in den Formularen spiegeln, damit kein 400 beim Speichern kommt.
5. **Passwort-Mindestlänge 12** (PB-Default wäre 8). Nur relevant, falls du im
   Login-Screen eine clientseitige Mindestlänge anzeigst.
6. **Zusätzliche Indizes:** `sj_dreams(owner)`, `sj_projects(owner)`,
   `sj_events(owner, date_start)` und — wichtig für dich —
   **`sj_weeks(owner, week_start)` UNIQUE**.
7. `created`/`updated` sind `autodate`-Felder. **Nie mitsenden.**

### Drei Dinge, die dich sonst Zeit kosten

1. **`owner` MUSS beim Create mitgeschickt werden** (`pb.authStore.record.id`).
   Ohne `owner` → HTTP 400. Bei Updates `owner` **weglassen** — ein Update, das
   `owner` verändert, wird abgelehnt.
2. **Ein `list` ohne gültigen Login gibt HTTP 200 mit `totalItems: 0`, keinen Fehler.**
   Das ist normales PocketBase-Verhalten (die Rule wirkt als Filter). Ein leeres
   Dashboard ist also das Symptom eines abgelaufenen Tokens → auf
   `pb.authStore.isValid` prüfen und sonst zum Login-Screen, nicht „keine Daten" zeigen.
3. **`sj_weeks` ist unique pro `(owner, week_start)`.** Blind anlegen gibt 400.
   Nimm das Rezept `getOrCreateWeek()` aus `pocketbase/README.md`.

### Was getestet ist (Details in `pocketbase/TESTLOG.md`)

Gegen die **echte** PocketBase-Binary v0.37.4 auf einer frischen lokalen Instanz,
56 Prüfungen, 0 Fehler:

- Migrationen laufen fehlerfrei durch, sind **idempotent** (Historie gelöscht,
  erneut gelaufen → identisches Schema) und **reversibel** (`migrate down 2` + wieder hoch).
- CRUD auf allen vier Collections inkl. Cross-Relation `dream ↔ project` und `expand`.
- JSON-Felder (`plan`, `review`) kommen als echte Objekte zurück.
- Unique-Index auf `sj_weeks` greift.
- **Negativtests:** anonym sieht/kann nichts; ein zweiter eingeloggter Account sieht
  0 Datensätze und bekommt 404/400 auf alles; ein Account aus einer **fremden
  Auth-Collection** (Szenario „andere App auf derselben Instanz") ebenso;
  Owner-Übernahme per Update wird abgelehnt; Self-Signup wird abgelehnt.

### Bekannte Einschränkungen

- **Der Produktivserver `pb.tangojam.de` ist noch nicht bespielt.** Die Sandbox
  erreicht ihn nicht. Norbert führt vorher `pocketbase/RUNBOOK.md` aus. Läuft dein
  PB-Modus-Test ins Leere, ist wahrscheinlich das noch nicht passiert — dann im
  Demo-Modus weiterarbeiten und es am Ende gemeinsam mit Norbert nachziehen.
- **Kein Passwort-Reset, keine Registrierung** (kein SMTP konfiguriert). Baue im
  Login-Screen also weder „Registrieren" noch „Passwort vergessen" ein — höchstens
  einen Hinweis „Passwort ändert Norbert im PocketBase-Admin".
- **Kein WIP-Limit im Backend.** Max. 3 aktive Projekte erzwingst du im Frontend.
- **Keine Hooks, kein Server-Code.** Alles, was mehr als CRUD ist, muss ins Frontend
  oder zurück in eine Opus-Session.
- Realtime-Subscriptions sind nicht getestet (v1 braucht keine). Sie würden dieselbe
  `viewRule` auswerten, wären also ebenfalls owner-scoped.
- **Schema-Änderungen sind tabu.** Fehlt dir ein Feld: in `HANDOVER.md` notieren,
  Opus-Session — nicht im Admin-UI von Hand anlegen (sonst driftet der Server von
  den Migrationen weg).

## Abschlusspflicht

Am Ende: (1) `HANDOVER.md` aktualisieren (kanonische Datei, keine neuen
Versions-Dateien), (2) Session-Abschluss nach Norberts Format: klickbare Links
(Live-URL!), max. 1 Terminal-Befehl als 1-Klick-Codeblock, Abschnitt
„Was Norbert jetzt tut" mit genau EINER Handlung.
