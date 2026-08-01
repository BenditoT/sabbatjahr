# Sabbatjahr-App — PocketBase-Backend (Interface-Vertrag)

> **Diese Datei ist die einzige Quelle für das Frontend.** Wenn hier etwas nicht
> steht, gibt es das im Backend nicht. Schema-Änderungen macht ausschließlich eine
> Opus-Session über `pb_migrations/` — nie von Hand im Admin-UI.
>
> Stand: 30.07.2026 · PocketBase **v0.37.4** · Instanz `https://pb.tangojam.de`

## Überblick

| | |
|---|---|
| Collections | `sj_users` (auth), `sj_dreams`, `sj_events`, `sj_projects`, `sj_weeks` |
| Auth | E-Mail + Passwort gegen `sj_users`, genau ein Account (Norbert) |
| Registrierung | **nicht möglich** (`createRule = null`) — Accounts legt nur der Superuser an |
| Zugriff | strikt owner-scoped: jeder Datensatz gehört über `owner` genau einem `sj_users`-Record |
| Server-Code | **keiner.** Keine Hooks, kein Goja-Bundle, kein Reducer. Nur Collections + Rules. |

**Warum eine eigene `sj_users`-Collection statt der zentralen `users`?**
Die Instanz `pb.tangojam.de` ist mit anderen Apps geteilt (z. B. Deutschlandreise mit
anonym erzeugten Auth-Records). Eine eigene Auth-Collection trennt die Apps sauber und
erlaubt eine Rule, die zusätzlich die Herkunfts-Collection prüft. Die zentrale
`users`-Collection bleibt unangetastet.

---

## Collections & Felder

Alle vier Daten-Collections haben zusätzlich die Systemfelder
`id` (15 Zeichen), `created`, `updated` (beide `autodate`, vom Server gesetzt —
niemals selbst schreiben).

### `sj_users` (Typ: auth)

| Feld | Typ | Anmerkung |
|---|---|---|
| `email` | email | Login-Identität |
| `password` | password | **min. 12 Zeichen** (gehärtet, PB-Default wäre 8) |
| `name` | text (max 200) | Anzeigename, optional |
| `verified` | bool | wird beim Anlegen auf `true` gesetzt |

Rules: `listRule = null`, `viewRule = "id = @request.auth.id"`, `createRule = null`,
`updateRule = "id = @request.auth.id"`, `deleteRule = null`.
→ Das Frontend kann den eigenen Record lesen und ändern (z. B. `name`), sonst nichts.

### `sj_dreams` — Träume & Bucketlist

| Feld | Typ | Pflicht | Werte / Grenzen |
|---|---|---|---|
| `owner` | relation → `sj_users` | ✅ | genau 1, cascadeDelete |
| `title` | text | ✅ | max 200 |
| `description` | text | | max 2000 |
| `category` | select (1) | | `reise` `musik` `tango` `familie` `lernen` `gesundheit` `sonstiges` |
| `status` | select (1) | | `idee` `geplant` `in_umsetzung` `erlebt` `verworfen` |
| `priority` | number | | Ganzzahl 1–3 |
| `target_month` | text | | Muster `YYYY-MM`, z. B. `2027-03` (max 7 Zeichen) |
| `project` | relation → `sj_projects` | | optional, kein cascadeDelete |
| `notes` | text | | max 5000 |

### `sj_events` — feste Termine

| Feld | Typ | Pflicht | Werte / Grenzen |
|---|---|---|---|
| `owner` | relation → `sj_users` | ✅ | |
| `title` | text | ✅ | max 200 |
| `date_start` | date | ✅ | |
| `date_end` | date | | |
| `all_day` | bool | | |
| `category` | select (1) | | `tango` `musik` `familie` `schule` `steuer` `reise` `sonstiges` |
| `location` | text | | max 300 |
| `url` | url | | muss eine gültige URL sein oder leer |
| `notes` | text | | max 5000 |

Index: `(owner, date_start)` — Sortieren/Filtern nach Datum ist billig.

### `sj_projects` — Scanner-Board

| Feld | Typ | Pflicht | Werte / Grenzen |
|---|---|---|---|
| `owner` | relation → `sj_users` | ✅ | |
| `title` | text | ✅ | max 200 |
| `status` | select (1) | | `idee` `aktiv` `pausiert` `abgeschlossen` `verworfen` |
| `area` | select (1) | | gleiche Werte wie `sj_dreams.category` |
| `next_action` | text | | max 500 — der EINE nächste Schritt |
| `definition_of_done` | text | | max 1000 |
| `dream` | relation → `sj_dreams` | | optional, kein cascadeDelete |
| `started_at` | date | | |
| `finished_at` | date | | |
| `notes` | text | | max 5000 |

**WIP-Limit (max. 3 × `status = "aktiv"`) ist bewusst NICHT serverseitig erzwungen.**
Es gibt keinen Hook. Das Frontend setzt es soft durch (Dialog), so wie im Sonnet-Sprint
beschrieben. Wer es umgeht, betrügt nur sich selbst.

### `sj_weeks` — Wochenplan + Review

| Feld | Typ | Pflicht | Werte / Grenzen |
|---|---|---|---|
| `owner` | relation → `sj_users` | ✅ | |
| `week_start` | date | ✅ | Montag der Woche, 00:00 UTC |
| `plan` | json | | max 20 KB |
| `review` | json | | max 20 KB |
| `mood` | number | | Ganzzahl 1–5 |

**Unique-Index `(owner, week_start)`** — pro Person und Montag genau ein Datensatz.
Ein zweiter Create mit demselben `week_start` schlägt mit HTTP 400 fehl. Das Frontend
soll deshalb „finde oder lege an" machen (siehe Rezept unten), nicht blind anlegen.

JSON-Struktur (Konvention, vom Server NICHT validiert — halte dich trotzdem daran):

```jsonc
// plan
{ "top3": ["…", "…", "…"], "frog": "…", "fokus_projekt_id": "abc123…" }   // fokus_projekt_id: string | null

// review
{ "gelungen": "…", "haengt": "…", "gelernt": "…", "freude": "…" }
```

Über die REST-API/das JS-SDK kommen JSON-Felder als **echte Objekte** zurück (getestet).
Die „JSON = Bytes"-Falle aus dem Playbook betrifft nur Goja-Hooks — hier gibt es keine.

---

## Rules (was der Server erzwingt)

Für alle vier Daten-Collections gilt:

```
list   = @request.auth.id != "" && @request.auth.collectionName = "sj_users" && owner = @request.auth.id
view   = (identisch zu list)
create = @request.auth.id != "" && @request.auth.collectionName = "sj_users"
         && @request.body.owner = @request.auth.id && owner = @request.auth.id
update = list-Regel
         && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)
delete = (identisch zu list)
```

Konsequenzen fürs Frontend:

1. **`owner` MUSS beim Anlegen mitgeschickt werden** und muss die eigene User-ID sein.
   `pb.authStore.record.id` benutzen. Ohne `owner` → HTTP 400.
2. **`owner` bei Updates einfach weglassen.** Ein Update, das `owner` auf eine fremde ID
   setzt, wird abgelehnt (404/400).
3. `created`/`updated` nie senden.
4. Ein `list` ohne gültigen Login liefert **HTTP 200 mit `totalItems: 0`**, keinen Fehler.
   Das ist normales PocketBase-Verhalten (die Rule wirkt als Filter). Ein „leerer
   Dashboard-Bildschirm" ist also das Symptom eines abgelaufenen Tokens — bitte auf
   `pb.authStore.isValid` prüfen und sonst zum Login-Screen.

---

## Login-Flow & SDK-Rezepte

Das JS-SDK `pocketbase` **auf feste Version pinnen** (kein `@latest` — Skill
`cdn-resilience`). Geprüft am 30.07.2026: aktuelle Version ist **0.27.0**, sie kennt
`authStore.record`, `pb.filter()`, `authWithPassword()`, `getFullList()`.

```js
import PocketBase from "https://esm.sh/pocketbase@0.27.0";

const pb = new PocketBase("https://pb.tangojam.de");
// Standard: authStore in localStorage, überlebt Reload.

// --- Login -----------------------------------------------------------------
await pb.collection("sj_users").authWithPassword(email, password);
const me = pb.authStore.record;   // { id, email, name, ... }
const uid = me.id;

// eingeloggt? (nach Reload)
if (!pb.authStore.isValid) { /* Login-Screen zeigen */ }

// --- Logout ----------------------------------------------------------------
pb.authStore.clear();
```

**Es gibt keine Registrierung und kein Passwort-Reset per Formular** (kein SMTP
konfiguriert). Beides macht Norbert über den Superuser (siehe `RUNBOOK.md`).

```js
// --- Laden -----------------------------------------------------------------
const dreams = await pb.collection("sj_dreams").getFullList({
  sort: "-priority,title",
});
const events = await pb.collection("sj_events").getFullList({
  sort: "date_start",
});
const projects = await pb.collection("sj_projects").getFullList({
  sort: "status,title",
  expand: "dream",
});

// --- Anlegen (owner nicht vergessen!) --------------------------------------
const dream = await pb.collection("sj_dreams").create({
  owner: uid,
  title: "Tango in Buenos Aires",
  category: "tango",
  status: "idee",
  priority: 1,
  target_month: "2027-03",
});

// --- Ändern (owner weglassen) ----------------------------------------------
await pb.collection("sj_dreams").update(dream.id, { status: "geplant" });

// --- Traum -> Projekt ------------------------------------------------------
const project = await pb.collection("sj_projects").create({
  owner: uid,
  title: dream.title,
  status: "idee",
  area: dream.category,
  dream: dream.id,
});
await pb.collection("sj_dreams").update(dream.id, { project: project.id });

// --- Woche: finden ODER anlegen (Unique-Index!) ----------------------------
async function getOrCreateWeek(mondayIso) {          // mondayIso: "2026-08-03"
  const filter = pb.filter("owner = {:o} && week_start = {:w}", {
    o: uid, w: mondayIso,
  });
  const found = await pb.collection("sj_weeks").getList(1, 1, { filter });
  if (found.items.length) return found.items[0];
  return pb.collection("sj_weeks").create({
    owner: uid,
    week_start: `${mondayIso} 00:00:00.000Z`,
    plan: { top3: ["", "", ""], frog: "", fokus_projekt_id: null },
    review: { gelungen: "", haengt: "", gelernt: "", freude: "" },
  });
}

// --- Löschen ---------------------------------------------------------------
await pb.collection("sj_events").delete(id);
```

### Datums-Format

PocketBase liefert Datumsfelder als `"2026-10-02 00:00:00.000Z"` (Leerzeichen statt `T`).
Beim Schreiben werden sowohl `"2026-10-02"` als auch `"2026-10-02 00:00:00.000Z"`
akzeptiert. Fürs Rechnen im Frontend: `new Date(v.replace(" ", "T"))`.
Leere Datumsfelder kommen als `""` zurück, nicht als `null`.

### Fehlerbilder

| HTTP | Bedeutung | Was das Frontend tun soll |
|---|---|---|
| 400 mit `data.owner` | `owner` fehlt oder ist fremd | eigene `uid` setzen |
| 400 mit `data.week_start` | Woche existiert schon | `getOrCreateWeek` benutzen |
| 401/403 | Token abgelaufen/ungültig | `authStore.clear()`, Login-Screen |
| 404 bei view/update/delete | Datensatz existiert nicht **oder gehört jemand anderem** | wie „nicht gefunden" behandeln |

---

## Dateien in diesem Ordner

| Datei | Zweck |
|---|---|
| `pb_migrations/1785436800_sj_collections.js` | Durchgang 1: Collections anlegen |
| `pb_migrations/1785436900_sj_relations_rules.js` | Durchgang 2: Cross-Relationen, Indizes, Rules |
| `import-collections.json` | dasselbe Schema als Admin-UI-Import („Import collections"), aus den Migrationen abgeleitet und gegen sie verifiziert — **Deploy-Weg ohne SSH** |
| `RUNBOOK.md` | Deploy + Account anlegen: Variante A (Browser-Import), Variante B (Terminal.app/SSH) |
| `TESTLOG.md` | Ergebnis des ehrlichen Lokaltests |
| `SICHERHEITSCHECK.md` | Sicherheitsbewertung nach der 7-Punkte-Liste |
| `tests/pb-local-test.sh` | reproduzierbarer Lokaltest gegen eine frische PB-Instanz |
