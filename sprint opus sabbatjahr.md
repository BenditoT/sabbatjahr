# Sprint Opus — Sabbatjahr-App: Backend (PocketBase)

> **Session-Typ:** Opus (Architektur, Sicherheit, Rules)
> **Projektordner:** `~/Downloads/Codex playground/sabbatjahr/`
> **Erstellt:** 30.07.2026 von Fable (Orchestrator)

## Kontext (ohne Chat-Historie lesbar)

Norbert hat vom **30.07.2026 bis 11.09.2027** (Ende Sommerferien BW 2027) Sabbatjahr.
Er baut eine **private Single-User-Web-App** zur Organisation dieses Jahres mit vier
Modulen: Träume/Bucketlist, feste Termine auf Jahres-Timeline, Projektübersicht
(Scanner-Board mit WIP-Limit) und Wochenrhythmus/Reflexion.

Entschieden (nicht neu diskutieren):

| Entscheidung | Wert |
|---|---|
| Backend | **PocketBase selbst gehostet** (pb.tangojam.de, STRATO, v0.37.4) |
| Frontend | Preact+htm Single-File `index.html` (macht **Sonnet**, nicht du) |
| Hosting Frontend | GitHub Pages, Account BenditoT, Repo public (nur Code, keine Daten) |
| Zugangsschutz | **PocketBase-Login ist das Gate** (E-Mail + Passwort, ein User: Norbert). KEIN separates client-seitiges Passwort-Gate — wäre Scheinsicherheit. |
| Nutzer | Genau einer (Norbert), aber die PB-Instanz ist **geteilt** mit anderen Apps (z. B. Deutschlandreise mit anonymen Auth-Records) → Rules müssen owner-scoped sein, `@request.auth.id != ""` allein reicht NICHT. |

Wichtige Skills VOR der Arbeit lesen:
- `projekt-nach-pocketbase-bringen` (Fahrplan + Gotcha-Checkliste)
- `sicherheitscheck`
- Referenz-Muster im Repo: `deutschlandreise digital/pocketbase/` (Migrations-Stil, README-Aufbau)

**Vereinfachung gegenüber Deutschlandreise:** Diese App ist reines CRUD eines
einzelnen Users. **Keine Hooks, kein Reducer, kein Goja-Bundle nötig.** Der ganze
Server-Teil besteht aus Collections + Rules + Migrationen. Nicht überbauen.

## Ziel

Fertiges, lokal getestetes PocketBase-Schema (Migrationen) + Deploy-Runbook für die
Terminal.app + dokumentierter Interface-Vertrag für das Sonnet-Frontend.

## Aufgaben

### 1. Datenmodell als Migrationen (`pocketbase/pb_migrations/`)

Präfix `sj_` für alle Collections. Vorschlag (Feinheiten darfst du verbessern,
Felder aber nicht ersatzlos streichen — das Frontend baut darauf):

**`sj_users`** (Auth-Collection, oder begründet die zentrale `users`-Collection —
entscheide du; wichtig ist nur: Norbert hat genau einen Account, kein Self-Signup,
`createRule = null`).

**`sj_dreams`** — Träume & Bucketlist
- `owner` (relation → Auth-Collection, required)
- `title` (text, required), `description` (text)
- `category` (select: reise, musik, tango, familie, lernen, gesundheit, sonstiges)
- `status` (select: idee, geplant, in_umsetzung, erlebt, verworfen; default idee)
- `priority` (number 1–3), `target_month` (text `YYYY-MM`, optional)
- `project` (relation → sj_projects, optional — „Traum wurde zu Projekt")
- `notes` (text)

**`sj_events`** — feste Termine
- `owner`, `title` (required), `date_start` (date, required), `date_end` (date, optional)
- `all_day` (bool, default true)
- `category` (select: tango, musik, familie, schule, steuer, reise, sonstiges)
- `location` (text), `url` (url), `notes` (text)

**`sj_projects`** — Scanner-Board
- `owner`, `title` (required)
- `status` (select: idee, aktiv, pausiert, abgeschlossen, verworfen; default idee)
- `area` (select wie dreams-category)
- `next_action` (text — der EINE nächste Schritt, zentral fürs Anti-Verzetteln)
- `definition_of_done` (text — woran erkenne ich „fertig"?)
- `dream` (relation → sj_dreams, optional), `started_at`/`finished_at` (date), `notes` (text)
- WIP-Limit (max. 3 aktiv) wird im **Frontend** soft erzwungen — kein Hook dafür.

**`sj_weeks`** — Wochenplan + Review
- `owner`, `week_start` (date, Montag; unique zusammen mit owner)
- `plan` (json: `{top3: string[], frog: string, fokus_projekt_id: string|null}`)
- `review` (json: `{gelungen: string, haengt: string, gelernt: string, freude: string}`)
- `mood` (number 1–5, optional)

Migrations-Gotchas aus dem Playbook beachten: Back-Relation-Rules in **zwei
Durchgängen** (erst Collections mit `null`-Rules, dann Rules setzen); JSON-Felder
werden als Bytes gelesen (nur Doku-relevant fürs Frontend, keine Hooks hier).

### 2. Rules (Kern deiner Sicherheitsarbeit)

- Alle vier Daten-Collections: `list/view/create/update/delete` strikt owner-scoped
  (`owner = @request.auth.id`, beim Create Owner-Bindung erzwingen — korrekte
  v0.37-Syntax verifizieren, z. B. via `@request.body`).
- Kein anonymer Zugriff, keine offene Registrierung (`createRule = null` auf Auth).
- Kurzer schriftlicher **Sicherheitscheck** (Skill `sicherheitscheck`): Was sieht ein
  fremder/anonymer Client dieser geteilten Instanz? Muss lauten: nichts.

### 3. Ehrlich lokal testen

Echte PB-Binary in der Cloud bauen/laden (wie im Playbook), Migrationen einspielen,
dann per HTTP-API durchtesten: User anlegen (superuser), Login, CRUD auf allen vier
Collections, **Negativtest** (zweiter Auth-Record sieht/ändert nichts von Norberts
Daten, anonym erst recht nicht). `pkill -x pocketbase` beachten. Ergebnisse in
`pocketbase/TESTLOG.md` festhalten.

### 4. Deploy-Runbook + Doku

- `pocketbase/README.md`: Interface-Vertrag fürs Frontend (Collection-Namen, Felder,
  Select-Werte, Beispiel-SDK-Aufrufe, Login-Flow) — das ist Sonnets einzige Quelle.
- Copy-Paste-**Runbook für Terminal.app** (Cloud-Bash erreicht den Server NICHT,
  Skill `cowork-cloud-kein-netz-ssh-runbook`): scp `pb_migrations` nach
  `/opt/pocketbase`, Restart, Anlage des Norbert-Users. **Keine Secrets in Dateien;
  Passwort setzt Norbert selbst** (`read -s`-Muster in zsh, dann `unset`).

## Akzeptanzkriterien

- [ ] Migrationen laufen auf frischer lokaler PB-Instanz fehlerfrei durch (idempotent)
- [ ] Owner-Scoping durch Negativtest belegt (TESTLOG.md)
- [ ] Kein Hook, kein unnötiger Server-Code
- [ ] README.md mit vollständigem Interface-Vertrag für Sonnet
- [ ] Terminal-Runbook vorhanden, ohne Secrets

## Scope-Grenze

**Mach NUR diese Aufgaben.** Kein Frontend, kein HTML/CSS, kein Deploy des
Frontends — das ist Sonnets Sprint (`sprint sonnet sabbatjahr.md`). Nichts
Zusätzliches „verbessern".

## Abschlusspflicht

Am Ende: (1) `sprint sonnet sabbatjahr.md` um einen Abschnitt „Übergabe von Opus"
ergänzen (Schema-Abweichungen, Interface-Vertrag-Pfad, was getestet ist),
(2) `HANDOVER.md` aktualisieren, (3) Session-Abschluss nach Norberts Format:
klickbare Links, max. 1 Terminal-Befehl, Abschnitt „Was Norbert jetzt tut".
