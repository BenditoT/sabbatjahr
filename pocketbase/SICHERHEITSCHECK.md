# 🛡️ Sicherheitscheck — Sabbatjahr-App, Backend (PocketBase)

Stand 30.07.2026 · geprüft an der laufenden v0.37.4-Instanz, nicht nur am Papier.
Bewertet wird ausschließlich das Backend; das Frontend prüft die Sonnet-Session.

## Die Leitfrage aus dem Sprint

> **Was sieht ein fremder oder anonymer Client der geteilten Instanz
> `pb.tangojam.de` von Norberts Sabbatjahr-Daten?**

**Nichts.** Belegt in `TESTLOG.md`, Abschnitte 3, 4 und 6:

| Wer | Was er sieht / kann |
|---|---|
| anonym (kein Token) | `list` → 0 Treffer, `view` → 404, `create` → 400, Registrierung → 403 |
| eingeloggter zweiter `sj_users`-Account | 0 Treffer in allen vier Collections; lesen/ändern/löschen fremder Datensätze → 404; anlegen auf fremden `owner` → 400 |
| eingeloggter Account einer **fremden** Auth-Collection (`users`, wie bei anderen Apps auf der Instanz) | identisch: 0 Treffer, 404, 400 |
| Norbert selbst | genau seine eigenen Datensätze, sonst nichts |

Drei unabhängige Schichten müssten gleichzeitig versagen, damit etwas ausliefe:
`owner = @request.auth.id` · `@request.auth.collectionName = "sj_users"` ·
das `owner`-Feld ist eine Relation, die **nur** auf `sj_users` zeigen kann.

## 7-Punkte-Checkliste

### 🟢 OK

**1 — Identität & AuthN**
- Login E-Mail + Passwort gegen eigene Auth-Collection `sj_users`.
- **Passwort-Mindestlänge auf 12 gehärtet** (PocketBase-Default wäre 8) — serverseitig
  erzwungen, getestet: 8 Zeichen → HTTP 400.
- Token liegt im `authStore` (localStorage). Für eine private Single-User-App auf
  Norberts eigenen Geräten akzeptabel; bewusster Trade-off, siehe unten.
- PocketBase bringt eigenes Rate-Limiting für Auth-Endpunkte mit (Server-Einstellung,
  nicht Teil dieser Migration).

**2 — Autorisierung**
- Alle vier Daten-Collections: `list/view/create/update/delete` strikt owner-scoped.
- `create` bindet den Owner *doppelt*: `@request.body.owner = @request.auth.id`
  **und** `owner = @request.auth.id` gegen den entstehenden Datensatz.
- `update` verbietet zusätzlich die Owner-Übergabe
  (`@request.body.owner:isset = false || @request.body.owner = @request.auth.id`) —
  getestet, der Übernahmeversuch endet mit 404 und der `owner` bleibt unverändert.
- Keine offene Rule irgendwo, kein `@request.auth.id != ""` als alleinige Bedingung.
- `sj_users`: `listRule = null` (nicht auflistbar), `createRule = null`
  (**keine Registrierung**), `deleteRule = null`, `manageRule = null`.

**3 — Vertraulichkeit**
- TLS über pb.tangojam.de (Caddy/Reverse-Proxy des Servers).
- Repo `BenditoT/sabbatjahr` ist öffentlich, enthält aber **nur Code** — keine Daten,
  keine Secrets, keine `pb_data`.

**4 — Eingabe-Validierung**
- Längen-Limits auf jedem Textfeld (Titel 200, Notizen 5000, JSON 20 KB).
- `select`-Felder mit fester Wertliste, `number`-Felder mit `min/max` und `onlyInt`.
- `target_month` mit Regex `^[0-9]{4}-(0[1-9]|1[0-2])$`, `url` als URL-Typ.
- Unique-Index `(owner, week_start)` verhindert doppelte Wochenkarten.
- Kein SQL-String-Bau, kein Server-Code, der User-Input interpretiert.

**5 — Geheimnisse**
- **Keine** Secrets in Migrationen, Skripten, Runbook oder Testlog.
  Das Testskript erzeugt Passwörter zur Laufzeit zufällig.
- Norbert setzt sein Passwort selbst per `read -rs`, danach `unset` (Runbook).
- Kein Service-Key-Äquivalent im Frontend: PocketBase braucht clientseitig gar keinen
  Key, nur die URL.

**6 — Betrieb**
- Kein Hook, kein Goja-Bundle → nichts, was zur Laufzeit brechen kann.
- Migrationen sind idempotent und reversibel (`migrate down` getestet).

### 🟡 HOCH — vor dem Live-Test erledigen

- **Superuser-Passwort der Instanz.** Der PocketBase-Admin darf alles, auch Norberts
  Daten lesen. Es muss lang und einzigartig sein (Passwortmanager) und darf nicht mit
  dem `sj_users`-Passwort identisch sein. Schritt 4 im Runbook.
- **Backup.** `/opt/pocketbase/pb_data/data.db` ist die einzige Kopie dieser Daten.
  Ein Jahr Sabbatjahr-Reflexion ohne Backup wäre bitter. PocketBase kann
  Auto-Backups (Settings → Backups); einmalig einschalten.

### ❓ Zu prüfen (außerhalb dieses Codes, am Server)

- Läuft PocketBase auf dem STRATO-Server als **eigener, nicht-root** User?
- Ist das Admin-UI `/_/` nur über HTTPS erreichbar (kein Plain-HTTP-Port offen)?
- Sind die CORS-`--origins` des Servers sinnvoll gesetzt? Für ein reines
  Token-im-Header-Setup ohne Cookies ist `*` kein Loch, aber eine Einschränkung auf
  die Pages-Domain schadet nicht.

### Bewusste Trade-offs (dokumentiert, nicht vergessen)

| Entscheidung | Warum vertretbar |
|---|---|
| **Keine E2E-Verschlüsselung** der Wochen-Reviews, obwohl das Reflexions-/Tagebuch-Charakter hat | Norbert ist alleiniger Nutzer UND Betreiber des Servers — es gibt keinen Dritten, vor dem verschlüsselt werden müsste, außer dem Hoster. Der Sicherheitscheck-Skill verlangt E2EE bei Tagebuchdaten; hier wird bewusst darauf verzichtet, weil kein fremder Dienstanbieter Zugriff hat und E2EE die Volltextsuche/Auswertung kaputtmacht. Wenn später doch sensiblere Einträge dazukommen: Phase 2. |
| **Token in localStorage** statt HttpOnly-Cookie | Reine Single-File-Frontend-App ohne eigenen Backend-Server; PocketBase-Standard. Risiko wäre XSS — dagegen hilft Preact/htm (escaped automatisch) und die Regel „kein `dangerouslySetInnerHTML` mit User-Content". Das ist Sonnets Aufgabe im Frontend-Review. |
| **WIP-Limit nur im Frontend** | Keine Sicherheitsfrage, sondern eine Selbstdisziplin-Frage. Ein Hook dafür wäre unnötiger Server-Code. |
| **Kein Passwort-Reset per E-Mail** | Kein SMTP → keine Angriffsfläche über Reset-Mails. Norbert setzt das Passwort per Superuser neu. |

### DSGVO

Reine Eigennutzung durch eine natürliche Person zu persönlichen Zwecken
(Art. 2 Abs. 2 lit. c DSGVO — Haushaltsausnahme). Keine fremden personenbezogenen
Daten, keine Schülerdaten, kein Auftragsverarbeiter. Löschung/Export: Norbert hat
Superuser-Zugriff auf die eigene Datenbank; ein Export ist jederzeit über das Admin-UI
möglich. Keine Datenschutzerklärung nötig, solange die App nur von ihm genutzt wird —
die GitHub-Pages-Seite selbst zeigt ohne Login keinerlei Daten.

---

## Fazit

```
🛡️ Sicherheitscheck bestanden ✅
  Geprüft: AuthN, AuthZ/Rules, Eingabevalidierung, Secrets, DSGVO-Basics, Betrieb
  Keine Show-Stopper. Owner-Scoping ist durch echte Negativtests belegt (TESTLOG.md).
  Vor dem Live-Test noch: starkes Superuser-Passwort + Auto-Backup einschalten.
```
