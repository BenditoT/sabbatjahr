# TESTLOG — Sabbatjahr-Backend

> Ehrlicher Lokaltest, keine Behauptung. Alles unten ist tatsächlich gelaufen.

## Umgebung

| | |
|---|---|
| Datum | 30.07.2026 |
| Binary | **echte** PocketBase-Binary **v0.37.4** (`pocketbase_0.37.4_linux_arm64.zip` von GitHub Releases), verifiziert mit `./pocketbase --version` |
| Ort | Cloud-Sandbox der Cowork-Session, frische Wegwerf-Instanz je Lauf (`mktemp -d`) |
| Nicht getestet | `pb.tangojam.de` selbst — die Sandbox erreicht den Server nicht (Egress-Gateway). Deploy läuft über `RUNBOOK.md` in Norberts Terminal.app. |
| Testskript | `tests/pb-local-test.sh` (Passwörter zur Laufzeit zufällig, nichts davon im Repo) |

Sandbox-Fallen aus dem Playbook beachtet: `pkill -x pocketbase` (nie `pkill -f`),
Server im selben Bash-Call starten/testen/beenden, Ergebnisse zusätzlich in Dateien.

## 1. Migrationen

| Prüfung | Ergebnis |
|---|---|
| Frische Instanz, `serve --migrationsDir pb_migrations` | beide Migrationen angewandt, Server startet fehlerfrei |
| Collections danach | `sj_dreams`, `sj_events`, `sj_projects`, `sj_users`, `sj_weeks` |
| **Idempotenz:** Einträge aus `_migrations` gelöscht, Server neu gestartet → Migrationen laufen ERNEUT gegen bereits existierende Collections | fehlerfrei, keine doppelten Felder, Rules/Indizes identisch |
| `migrate down 2` | beide Migrationen sauber zurückgerollt (`sj_*` verschwunden) |
| danach wieder hoch | alle 5 Collections wieder da |

Der Zwei-Durchgänge-Aufbau war nötig: `sj_dreams.project` und `sj_projects.dream`
referenzieren sich gegenseitig, das geht beim Anlegen nicht in einem Rutsch.

## 2. Funktionstest (Auszug aus dem Lauf, 56 Prüfungen)

```
== 0. Migrationen
  PASS  alle 5 sj_-Collections angelegt
  PASS  Superuser-Login

== 1. Accounts (per Superuser, wie im Runbook)
  PASS  Superuser legt Norbert-Account an (HTTP 200)
  PASS  Superuser legt zweiten sj_users-Account an (HTTP 200)
  PASS  Passwort mit 8 Zeichen wird abgelehnt (min 12) (HTTP 400)
  PASS  Login Norbert (E-Mail + Passwort)
  PASS  Login zweiter Account

== 2. CRUD als Norbert
  PASS  create sj_dreams (HTTP 200)
  PASS  create sj_projects (HTTP 200)
  PASS  update sj_dreams + Cross-Relation dream->project (HTTP 200)
  PASS  update sj_projects + Cross-Relation project->dream (HTTP 200)
  PASS  create sj_events (HTTP 200)
  PASS  create sj_weeks (JSON-Felder) (HTTP 200)
  PASS  zweite Woche mit gleichem week_start abgelehnt (unique index) (HTTP 400)
  PASS  JSON-Feld liest sich als Objekt zurück
  PASS  list sj_dreams als Norbert -> 1 Treffer
  PASS  list sj_projects als Norbert -> 1 Treffer
  PASS  list sj_events als Norbert -> 1 Treffer
  PASS  list sj_weeks als Norbert -> 1 Treffer
  PASS  expand über Cross-Relation (HTTP 200)

== 3. Negativtest — anonym
  PASS  anonym list sj_dreams — HTTP 200, 0 Treffer
  PASS  anonym list sj_projects — HTTP 200, 0 Treffer
  PASS  anonym list sj_events — HTTP 200, 0 Treffer
  PASS  anonym list sj_weeks — HTTP 200, 0 Treffer
  PASS  anonym list sj_users — abgewiesen (HTTP 403)
  PASS  anonym view eines konkreten Traums verweigert (HTTP 404)
  PASS  anonym create verweigert (HTTP 400)
  PASS  Self-Signup verweigert (createRule = null) (HTTP 403)

== 4. Negativtest — zweiter sj_users-Account
  PASS  list sj_dreams als zweiter sj_users-Account — HTTP 200, 0 Treffer
  PASS  list sj_projects als zweiter sj_users-Account — HTTP 200, 0 Treffer
  PASS  list sj_events als zweiter sj_users-Account — HTTP 200, 0 Treffer
  PASS  list sj_weeks als zweiter sj_users-Account — HTTP 200, 0 Treffer
  PASS  Fremder kann Norberts Traum nicht lesen (HTTP 404)
  PASS  Fremder kann Norberts Traum nicht ändern (HTTP 404)
  PASS  Fremder kann Norberts Termin nicht löschen (HTTP 404)
  PASS  Fremder kann keinen Datensatz auf Norbert anlegen (HTTP 400)
  PASS  Fremder kann Norberts Benutzer-Record nicht lesen (HTTP 404)
  PASS  sj_users ist nicht auflistbar (listRule = null) (HTTP 403)

== 5. Negativtest — Owner-Übernahme durch Norbert selbst
  PASS  owner kann nicht auf fremden Account umgebogen werden (HTTP 404)
  PASS  owner unverändert nach Übernahmeversuch

== 6. Negativtest — fremde Auth-Collection auf derselben Instanz
  PASS  PocketBase verweigert doppelte Auth-Record-ID über Collection-Grenzen hinweg
  PASS  Auth-Record in fremder Collection 'users' angelegt (HTTP 200)
  PASS  Login als Nutzer einer fremden Auth-Collection
  PASS  fremde Auth-Collection list sj_dreams — HTTP 200, 0 Treffer
  PASS  fremde Auth-Collection list sj_projects — HTTP 200, 0 Treffer
  PASS  fremde Auth-Collection list sj_events — HTTP 200, 0 Treffer
  PASS  fremde Auth-Collection list sj_weeks — HTTP 200, 0 Treffer
  PASS  fremde Auth-Collection kann Norberts Traum nicht lesen (HTTP 404)
  PASS  fremde Auth-Collection kann nichts auf Norbert anlegen (HTTP 400)
  PASS  fremde Auth-Collection kann nichts auf sich selbst anlegen (HTTP 400)

== 6c. Beweis: @request.auth.collectionName unterscheidet wirklich
  PASS  Probe-Collection mit reiner collectionName-Rule angelegt (Rule-Syntax gültig)
  PASS  Probe-Datensatz angelegt (HTTP 200)
  PASS  sj_users-Token erfüllt collectionName-Rule (1 Treffer)
  PASS  Token aus fremder Auth-Collection erfüllt sie NICHT (0 Treffer)
  PASS  anonym erfüllt sie NICHT (0 Treffer)

== 7. Löschen als Eigentümer
  PASS  Norbert löscht eigenen Termin (HTTP 204)

==============================================
  PASS: 56   FAIL: 0
==============================================
```

## 3. Negativtest-Beleg im Klartext

**Der Kern:** Ein zweiter, vollwertig eingeloggter Auth-Record sieht von Norberts
Daten **nichts** und kann **nichts** anlegen, ändern oder löschen — geprüft für alle
vier Collections, sowohl mit einem zweiten `sj_users`-Account als auch mit einem
Account aus einer **fremden Auth-Collection** (`users`), was die geteilte Instanz
`pb.tangojam.de` realistisch nachbildet.

Drei Dinge, die ich beim Testen gelernt und deshalb dokumentiert habe:

1. **`list` ohne Berechtigung ist HTTP 200 mit `totalItems: 0`, kein 403.** In
   PocketBase wirkt eine gesetzte `listRule` als Filter; nur `listRule = null` gibt
   403. Ein leeres Dashboard ist also das Symptom eines abgelaufenen Tokens — das
   steht jetzt so im Interface-Vertrag, damit Sonnet das richtig behandelt.
2. **PocketBase verweigert doppelte Auth-Record-IDs über Collection-Grenzen hinweg**
   (`validation_invalid_auth_id`). Der theoretische Angriff „fremde App legt einen
   Auth-Record mit exakt Norberts ID an, damit `owner = @request.auth.id` greift" ist
   auf Engine-Ebene ausgeschlossen. Getestet, nicht angenommen.
3. **`@request.auth.collectionName` wertet korrekt aus.** Damit die Klausel nicht bloß
   „sieht gut aus", habe ich eine Wegwerf-Collection angelegt, deren `listRule`
   ausschließlich `@request.auth.collectionName = "sj_users"` prüft: sj_users-Token
   sieht den Datensatz, fremdes Token und anonym sehen ihn nicht. Die Klausel ist also
   echte zweite Verteidigungslinie und nicht dekorativ.

## 4. Was NICHT getestet ist

- Der Produktivserver `pb.tangojam.de` (kein Netz aus der Sandbox). Nach dem Deploy
  laut `RUNBOOK.md` bitte einmal Schritt 5 des Runbooks fahren — das ist derselbe
  Login-Test gegen die echte Instanz.
- SMTP / Passwort-Reset per E-Mail: bewusst nicht konfiguriert, es gibt kein
  Reset-Formular. Passwort ändert Norbert über den Superuser (siehe Runbook).
- Realtime-Subscriptions: v1 braucht keine (Single-User, ein Gerät zur Zeit).
  Falls Sonnet sie doch nutzt: sie werten dieselbe `viewRule` aus, sind also
  ebenfalls owner-scoped.

---

# Nachtrag 01.08.2026 — Browser-Import (`import-collections.json`)

> Anlass: Kein SSH-Zugang zu pb.tangojam.de. Das Backend wird über die Admin-UI
> („Import collections") ausgerollt. Frage, die hier beantwortet wird: **Erzeugt der
> Import exakt dasselbe Schema wie die Migrationen?** Antwort: ja, bewiesen, nicht gehofft.

## A. Umgebung

| | |
|---|---|
| Datum | 01.08.2026 |
| Binary | **echte** PocketBase **v0.37.4**, `pocketbase_0.37.4_linux_arm64.zip` von GitHub Releases, `./pocketbase --version` → `pocketbase version 0.37.4`, SHA256 `0f1026d0a72e47ef2e5be3e190c5d032908cb015cb1dee6a17f3fbb81a3ca21d` |
| Ort | Cowork-Cloud-Sandbox (aarch64), Wegwerf-Instanzen unter `/tmp`, je Lauf frisch |
| Nicht getestet | `pb.tangojam.de` selbst (kein Netz aus der Sandbox) |

Die amd64-Binary lässt sich hier nicht ausführen (`Exec format error`, Sandbox ist
aarch64) — deshalb arm64, gleiche Version, gleicher Code.

## B. Wie die JSON entstanden ist

Nicht von Hand geschrieben, sondern **aus den Migrationen abgeleitet**:

1. Frische Instanz, `serve --migrationsDir pb_migrations` → beide Migrationen laufen.
2. `GET /api/collections` als Superuser → die fünf `sj_*`-Collections exportiert.
3. Nur die Collection-Metadaten `created`/`updated` entfernt (die Admin-UI verwirft sie
   beim Import ohnehin: `delete n.created, delete n.updated`), Reihenfolge
   `sj_users, sj_dreams, sj_projects, sj_events, sj_weeks`.

Ergebnis: `pocketbase/import-collections.json` (23.725 Bytes, SHA256
`4c3c09d305c4dea50ed2bc7e39390a159c053c319fff62f54b1c5494815eb7b2`).
Die Collection-IDs (`pbc_…`) stehen mit in der Datei — der Import legt die Collections
also mit denselben IDs an, und die Relationen (`owner`, `project`, `dream`) zeigen
danach auf dieselben Ziele wie bei den Migrationen.

## C. Schema-Äquivalenz — Feld für Feld

Zweite frische Instanz, **ohne** Migrationen. Die Datei über genau den Endpunkt
eingespielt, den die Admin-UI benutzt:

```
PUT /api/collections/import   { "collections": [...], "deleteMissing": false }   → HTTP 204
```

Danach beide Instanzen exportiert und rekursiv verglichen (jedes Feld, jede Option,
jeder Index, jede Rule, jedes Auth-Setting):

```
IDENTISCH: Schema aus Import-JSON == Schema aus Migrationen
           (alle 5 sj_-Collections, Feld für Feld)
```

## D. Funktionstest: **56 / 56 grün** über den Import-Weg

Das unveränderte `tests/pb-local-test.sh` (byte-identische Kopie, `diff -q` geprüft)
lief gegen eine Instanz, deren Schema **ausschließlich** aus dem HTTP-Import stammt —
der Migrations-Ordner war leer. Damit ist der Testlauf ein echter Beweis für die JSON
und nicht bloß eine Wiederholung des Migrations-Tests.

```
== 0. Migrationen
  PASS  alle 5 sj_-Collections angelegt
  …
== 7. Löschen als Eigentümer
  PASS  Norbert löscht eigenen Termin (HTTP 204)

==============================================
  PASS: 56   FAIL: 0
==============================================
```

Alle 56 Prüfungen sind dieselben wie am 30.07. (Liste oben in Abschnitt 2),
inklusive der Negativtests: anonym, zweiter `sj_users`-Account, fremde
Auth-Collection, Owner-Übernahme, Self-Signup, `collectionName`-Beweis.

*Wie das technisch ging:* Die Instanz wurde vorab per HTTP-Import bespielt; das
Testskript bekam dieses `pb_data`-Verzeichnis über einen `mktemp`-Wrapper im `PATH`
untergeschoben. Das Skript selbst wurde **nicht** verändert.

## E. Rules-Äquivalenz + Sicherheits-Kurzcheck

Automatisierter Abgleich `import-collections.json` ↔ Interface-Vertrag (`README.md`)
↔ Migrationen: **160 Prüfungen, 0 Abweichungen.** Die sicherheitsrelevanten davon:

| Prüfung | Ergebnis |
|---|---|
| `sj_users.createRule = null` | ✅ **kein Self-Signup** möglich (im Lauf zusätzlich live geprüft: HTTP 403) |
| `sj_users.listRule = null` | ✅ Benutzerliste nicht abrufbar (HTTP 403) |
| `sj_users.deleteRule` / `manageRule = null` | ✅ kein Selbstlöschen, keine Fremdverwaltung |
| `sj_users.viewRule` / `updateRule` | ✅ exakt `id = @request.auth.id` — nur der eigene Record |
| `sj_users.password.min` | ✅ **12** (PocketBase-Default wäre 8) |
| `sj_users.authRule` | `""` — PocketBase-Default, heißt „angelegte Accounts dürfen sich einloggen". Nicht `null` setzen, sonst ist Login gesperrt. Öffnet keinen Datenzugriff. |
| OAuth2 / OTP / MFA | ✅ alle drei `enabled: false` |
| `sj_dreams`, `sj_projects`, `sj_events`, **`sj_weeks`**: `listRule` | ✅ **keine offene Rule** — überall `@request.auth.id != "" && @request.auth.collectionName = "sj_users" && owner = @request.auth.id`. Besonders geprüft für `sj_weeks` (persönliche Reflexion). |
| dieselben vier: `viewRule`, `deleteRule` | ✅ identisch owner-scoped |
| dieselben vier: `createRule` | ✅ prüft zusätzlich `@request.body.owner = @request.auth.id` |
| dieselben vier: `updateRule` | ✅ verbietet die Owner-Übergabe (`@request.body.owner:isset = false \|\| …`) |
| Rule leer oder `null`, wo sie scharf sein muss | ✅ **keine** — alle 20 Daten-Rules (4 Collections × 5) sind gesetzt und nicht der leere String |
| Felder, Grenzen, `select`-Werte, `pattern`, Indizes | ✅ identisch zum Interface-Vertrag, inkl. Unique-Index `(owner, week_start)` |

Ein leerer String `""` als Rule wäre in PocketBase „für alle Eingeloggten offen" —
das gibt es hier an keiner Stelle. `null` bedeutet „nur Superuser"; das steht bewusst
nur bei `sj_users.listRule/createRule/deleteRule/manageRule`.

## F. Geteilte Instanz — der gefährliche Schalter

Die Import-Seite der Admin-UI sendet **`deleteMissing: true`**. Ob das schadet, hängt
allein am Schalter **„Merge with the existing collections"**, und der ist beim Öffnen
der Seite **ausgeschaltet** (im Binary nachgelesen: `mergeWithOldCollections:!1`,
`deleteMissing:!0`; bei „Merge an" schickt die UI alte + neue Collections zusammen).

Nachgestellt auf einer Wegwerf-Instanz mit einer Fremd-App:

| Lauf | vorher | nachher |
|---|---|---|
| Import mit „Merge" **AUS** (`deleteMissing: true`) | `dr_stops`, `users` | **weg** — nur noch die fünf `sj_*` |
| Import mit „Merge" **AN** (`deleteMissing: false`) | `dr_users`, `dr_stops` (+ 1 Datensatz), `users` | **alles unverändert erhalten**, `sj_*` zusätzlich angelegt |

Das ist der Grund für die Warnung in `RUNBOOK.md`, Variante A, Schritt 5.

## G. Idempotenz

Zweimal hintereinander importiert (beide Male HTTP 204). Danach erneut gegen das
Migrations-Schema gediffed: **identisch**. Fremde Collections und deren Datensätze
haben beide Läufe überlebt. Der Import darf also gefahrlos wiederholt werden.

## H. Was auch dieser Nachtrag NICHT beweist

- Den Produktivserver `pb.tangojam.de` — aus der Sandbox nicht erreichbar. Nach dem
  Import bitte Schritt 9 und 12 des Runbooks als Sichtprüfung fahren.
- Die Admin-UI selbst wurde **nicht** geklickt, sondern der Endpunkt aufgerufen, den
  sie aufruft (`PUT /api/collections/import`). Die UI-Texte in Variante A stammen aus
  den eingebetteten Assets der Binary 0.37.4, nicht aus einer Vermutung.
- Nichts an `index.html` oder den Playwright-Tests — dieser Sprint hat sie nicht angefasst.

---

## Testlauf wiederholen

```bash
# in der Sandbox / auf einem Linux-Rechner mit PocketBase-Binary
bash pocketbase/tests/pb-local-test.sh /pfad/zu/pocketbase
```

Exit-Code 0 = alles grün. Das Skript legt eine frische Instanz an und räumt den
Server am Ende selbst wieder ab.
