# Sprint Fable — Sabbatjahr-App bis zum Live-Gang orchestrieren

> **Session-Typ:** Fable 5 (Orchestrator — implementiert NIE selbst)
> **Projektordner:** `~/Downloads/Codex playground/sabbatjahr/`
> **Erstellt:** 01.08.2026 von Opus, nach der Fehlersuche am ESC-Bug und am SSH-Zugang
> **Kanonischer Stand:** `HANDOVER.md` im selben Ordner — als erstes lesen.

## Auftrag in einem Satz

Bring die Sabbatjahr-App von „Frontend fertig, Backend nicht ausgerollt" zu
„Norbert loggt sich auf der Pages-URL ein und trägt echte Daten ein" — und zwar so,
dass Norbert dabei so wenig wie irgend möglich selbst tun muss.

## Norberts Interaktions-Budget (die wichtigste Regel dieses Sprints)

Norberts Aufmerksamkeit ist die knappste Ressource im Projekt. Daraus folgt hart:

| Regel | Bedeutung |
|---|---|
| **Keine Rückfragen** | Bei mehreren gangbaren Wegen: den empfohlenen nehmen, Entscheidung im Handover begründen. Nur fragen, wenn eine Entscheidung ohne Norbert **fachlich unmöglich** ist (Geld, Recht, Passwörter, echte Außenwirkung). |
| **Terminal nur, wenn unvermeidbar** | Alles, was per Browser-Automation (Claude in Chrome), MCP oder Sandbox geht, macht der Agent selbst. Bleibt etwas übrig: **genau EIN** Copy-Paste-Block am Ende, nicht drei. |
| **Selbst verifizieren** | Nach jeder Aktion das Ergebnis prüfen (HTTP-Status, Actions-Lauf, Live-URL, Screenshot) und ohne Rückfrage weiterarbeiten. Nicht „soll ich fortfahren?" fragen. |
| **Nicht auf Bestätigung warten** | Norbert liest die Zusammenfassung am Ende, nicht jeden Zwischenschritt. |
| **Was nur Norbert kann** | Passwörter tippen, sich irgendwo einloggen, MFA bestätigen, GitHub-/PocketBase-Zugangsdaten eingeben. Solche Punkte sammeln und **gebündelt am Ende** stellen, nicht verteilt über die Session. |

## Ausgangslage (Stand 01.08.2026)

**Fertig:** PocketBase-Schema + Rules + 2 Migrationen (lokal 56/56 grün),
`index.html` (Preact+htm, 5 Ansichten, DataService `demo`/`pocketbase`),
3 Playwright-Smoke-Specs. ESC-Race-Condition gefunden und per `useLayoutEffect`
behoben (Details in `HANDOVER.md`).

**Drei Blocker, alle bereits diagnostiziert:**

1. **E2E laufen nirgends automatisch.** Die Cowork-Sandbox kann kein Chromium starten
   (fehlende Systembibliotheken), auf dem MacBook fehlt der Browser-Download.
   *Konsequenz: Der ESC-Fix ist bisher nur unter jsdom verifiziert, nicht im echten Browser.*
2. **Kein Git-Repo, kein Deploy.** Projekt liegt nur lokal. (Ein in der Sandbox
   versehentlich angelegtes `.git` wurde bewusst wieder entfernt — die Sandbox kann
   Lock-Dateien nicht löschen, ein `index.lock` wäre zurückgeblieben.)
3. **Kein SSH-Zugang zu pb.tangojam.de von diesem Mac.** Der MacBook-Schlüssel
   (`macbook-air-nk`, `SHA256:E8RCnRpp…`) liegt nicht in `authorized_keys` des Servers;
   Passwort-Login ist aus. Das Backend-Runbook (`pocketbase/RUNBOOK.md`) ist damit
   von hier aus nicht ausführbar.

**Von Norbert am 31.07. entschieden:** Blocker 3 wird **nicht** über SSH gelöst,
sondern **über die PocketBase-Admin-Oberfläche im Browser**.

## Empfohlener Plan (so umsetzen, nicht neu diskutieren)

### Blocker 1 + 2 zusammen lösen: CI statt lokalem Testlauf

Statt Norbert Browser installieren und Tests laufen zu lassen — **GitHub Actions**
übernimmt beides. Der Linux-Runner hat alles, was der Sandbox fehlt.

- Workflow `.github/workflows/ci.yml`: `playwright install --with-deps chromium` →
  `npm ci` → `npx playwright test` → **nur bei grün** Deploy auf GitHub Pages.
  Muster: Skill `playwright-webapp-testing` (Test-Gate + Auto-Deploy).
- Repo `BenditoT/sabbatjahr` anlegen und Pages aktivieren: **per Claude in Chrome**
  (Skill `github-pages-deploy-via-browser`), nicht per Terminal, nicht per Token.
- Damit schrumpft Norberts Terminal-Anteil auf **einen einzigen Push-Block** —
  `git init` bis `git push` in einem Rutsch (SSH-Key für GitHub liegt im
  Schlüsselbund und funktioniert, siehe Skill `git-deploy`).
- Danach: Actions-Lauf **selbst im Browser kontrollieren**. Rot → Ursache suchen
  (Skill `flaky-ci-echter-bug-diagnose`, niemals Timeouts hochsetzen), fixen, erneut
  pushen lassen. Grün → Live-URL abrufen und mit einem Screenshot belegen.

### Blocker 3: Backend ohne SSH ausrollen

- Aus `pocketbase/pb_migrations/*.js` eine **Import-Datei für die Admin-UI**
  ableiten (`pocketbase/import-collections.json`, Format „Import collections",
  PocketBase 0.37). Die fünf `sj_*`-Collections samt Feldern, Indizes und
  owner-scoped Rules müssen **exakt** dem Interface-Vertrag in
  `pocketbase/README.md` entsprechen — inklusive `sj_users` als eigene
  Auth-Collection, kein Self-Signup, Passwort-Mindestlänge 12.
- **Vorher lokal beweisen, nicht hoffen:** echte PocketBase-Binary 0.37.4 in der
  Sandbox starten, die JSON importieren, `pocketbase/tests/pb-local-test.sh`
  dagegen laufen lassen (Ziel: wieder 56/56, inkl. Negativtests). Erst wenn das
  grün ist, geht die Datei an Norbert bzw. in die Browser-Automation.
- Der Import selbst läuft in `https://pb.tangojam.de/_/`. **Einloggen muss Norbert
  selbst** (Superuser-Passwort — das tippt kein Agent). Ist die Sitzung offen, kann
  Claude in Chrome den Import und die Kontrolle übernehmen.
- **Anlegen des App-Accounts:** Collection `sj_users` → „New record" → E-Mail,
  Passwort (mind. 12 Zeichen), `verified` an. Passwort tippt Norbert.
- `pocketbase/RUNBOOK.md` um den Browser-Weg als gleichwertige Variante A ergänzen
  (SSH-Weg als Variante B behalten, mit dem Hinweis, dass der MacBook-Schlüssel erst
  in `authorized_keys` muss). **`RUNBOOK.md` nicht löschen.**

### Reihenfolge

1. Backend (Blocker 3) — die App ist ohne Collections nicht benutzbar.
2. Repo + CI + Deploy (Blocker 1 + 2).
3. Live-Test: einloggen, je einen Traum/Termin/Projekt/Wochen-Eintrag anlegen,
   Reload prüfen (Falle „Normalizer-Drift": Feld nach Reload weg —
   Skill `normalizer-drift-reload-bug`).

## Sprint-Aufteilung

Genau zwei Subagenten, sequenziell (der Sonnet-Sprint braucht das Ergebnis des
Opus-Sprints nicht zwingend, aber der Backend-Teil ist der kritische Pfad).

| Sprint | Modell | Inhalt |
|---|---|---|
| `sprint opus sabbatjahr-backend-browser.md` | **Opus** | Import-JSON aus den Migrationen ableiten, lokal gegen echte PB-Binary verifizieren (Ziel 56/56), Rules-Äquivalenz zum Interface-Vertrag prüfen, Sicherheits-Kurzcheck (kein Self-Signup, keine offene List-Rule), RUNBOOK um Variante A erweitern. |
| `sprint sonnet sabbatjahr-deploy.md` | **Sonnet** | `.github/workflows/ci.yml` (Test-Gate + Pages-Deploy), `.gitignore` prüfen, Repo-Anlage + Pages-Aktivierung per Claude in Chrome, den EINEN Push-Block formulieren, nach dem Push den Actions-Lauf und die Live-URL verifizieren. |

Beide Dateien selbsterklärend schreiben (Kontext, Ziel, Aufgaben mit
Akzeptanzkriterien, **Scope-Grenze**: „nur diese Aufgaben, nichts zusätzlich
verbessern", **Abschlusspflicht**: `HANDOVER.md` aktualisieren).
Dann per Agent-Tool direkt starten (Skill `fable-direkt-orchestrierung`),
nicht Norbert öffnen lassen. Bricht ein Subagent ab: `agentId` merken und per
SendMessage fortsetzen, nicht neu starten.

## Vorher lesen (Fallen, die in diesem Projekt real zugebissen haben)

`krs-projekt-playbook` · `playwright-webapp-testing` · `github-pages-deploy-via-browser` ·
`git-deploy` · `projekt-nach-pocketbase-bringen` · `supabase-nach-pocketbase-portieren` ·
`flaky-ci-echter-bug-diagnose` · `normalizer-drift-reload-bug` · `live-gang-testlauf-protokoll`

Konkret in diesem Projekt schon passiert und nicht zu wiederholen:
- Ein „flaky" Test war ein **echter** Race-Condition-Bug (ESC-Handler erst nach dem
  Paint registriert). Rote Tests werden diagnostiziert, nie weggewartet.
- Die Sandbox kann weder Chromium starten noch Dateien im Mount löschen noch
  fremde Hosts erreichen. Nicht dagegen ankämpfen — Arbeit dorthin verlagern, wo
  sie läuft (CI-Runner, Browser-Automation).
- Kein `git init` aus der Sandbox heraus im gemounteten Ordner (Lock-Dateien
  bleiben liegen). Git-Operationen gehören in den einen Terminal-Block.

## Sicherheit / Datenschutz (kurz, aber verbindlich)

- **Keine Passwörter, Tokens oder Superuser-Zugangsdaten** in Dateien, Repos,
  Prompts oder Sprint-Dateien. Norbert tippt sie, Agenten nie.
- Die App enthält **keine Schülerdaten** — sie gehört bewusst auf die private
  PocketBase-Instanz, nicht auf die KRS-Supabase.
- Rules bleiben strikt owner-scoped (`owner = @request.auth.id` **und**
  `@request.auth.collectionName = "sj_users"`). Eine versehentlich offene
  `listRule` auf `sj_weeks` würde ein Jahr persönlicher Reflexion öffentlich machen —
  das ist das einzige echte Sicherheitsrisiko dieses Projekts.
- Vor dem Live-Gang: Auto-Backup in den PocketBase-Settings einschalten
  (`pb_data/data.db` ist die einzige Kopie).

## Fertig ist der Sprint, wenn — Stand 01.08.2026, Fable-Session

- [ ] Die fünf `sj_*`-Collections stehen auf pb.tangojam.de, Rules geprüft.
      → **Agent-Anteil fertig:** `import-collections.json` verifiziert (56/56, Schema-Diff
      identisch, 160 Sicherheitsprüfungen). Wartet nur noch auf Norberts PB-Admin-Login
      (Runbook Variante A — Merge-Schalter AN!).
- [ ] Norberts App-Account existiert, Login-Test erfolgreich.
      → Wartet auf denselben PB-Admin-Login (Passwort tippt Norbert).
- [x] `BenditoT/sabbatjahr` existiert, CI gelaufen: Lauf #30722751190 **grün im echten
      Chromium** (Push `107ee43`, Norbert 02.08.).
- [x] Pages-URL live (HTTP 200) und per Screenshot verifiziert (Fable, 02.08.).
- [ ] Ein echter Datensatz je Modul, Reload-Prüfung — nach Backend-Rollout + Deploy.
- [x] `HANDOVER.md` und Dashboard-Eintrag (`"id": "sabbatjahr"`) aktualisiert.
- [x] Abschluss an Norbert: klickbare Links, EIN Terminal-Befehl, „Was Norbert jetzt tut".

**Fazit:** Alles, was Agenten ohne Norberts Passwörter tun können, ist erledigt und
verifiziert. Die offenen Häkchen hängen ausschließlich an den drei vorhergesagten
Norbert-Handgriffen (PB-Login, App-Passwort, Push-Block) — kein vierter ist entstanden.

## Was am Ende voraussichtlich bei Norbert bleibt (Ziel: höchstens diese drei)

1. Einmal in `https://pb.tangojam.de/_/` einloggen (Superuser-Passwort).
2. App-Passwort beim Anlegen seines Accounts tippen.
3. Einen Push-Block im Terminal ausführen.

Alles andere erledigen die Agenten selbst. Wenn ein vierter Punkt entsteht, ist das
ein Zeichen, dass ein Weg falsch gewählt wurde — dann Weg wechseln, nicht Norbert fragen.

## Einstiegs-Prompt für die Fable-Session

> Lies `~/Downloads/Codex playground/sabbatjahr/HANDOVER.md` und
> `sprint fable sabbatjahr.md` und orchestriere den Sprint bis „Fertig ist der
> Sprint, wenn" abgehakt ist. Starte die Subagenten selbst, frag mich nicht
> zwischendurch, entscheide nach der Empfehlung.
