---
{}
---
# RUNBOOK — Sabbatjahr-Backend auf pb.tangojam.de bringen

Es gibt **zwei Wege** zum selben Ergebnis. Beide erzeugen exakt dasselbe Schema
(nachgewiesen, siehe `TESTLOG.md`, Abschnitt vom 01.08.2026):

| | Weg | Wann |
|---|---|---|
| **Variante A** | Browser: Admin-UI → *Import collections* | **empfohlen** — kein SSH nötig, 5 Minuten |
| **Variante B** | Terminal.app: Migrationen per `scp` + Neustart | wenn der SSH-Zugang wieder steht |

Stand 01.08.2026: Der MacBook-Schlüssel `macbook-air-nk` steht **nicht** in
`authorized_keys` auf pb.tangojam.de und Passwort-Login ist aus — Variante B ist
deshalb aktuell nicht fahrbar. Nimm Variante A.

---

# Variante A — Browser-Import (empfohlen)

Was passiert: Die fertige Datei `import-collections.json` wird in der PocketBase-
Admin-UI hochgeladen und legt die fünf `sj_*`-Collections samt Feldern, Indizes und
Rules an. Danach: eigenen App-Account anlegen und Auto-Backup einschalten.

**Die Datei liegt hier:**

```
~/Downloads/Codex playground/sabbatjahr/pocketbase/import-collections.json
```

> ⚠️ **Der eine Schalter, auf den es ankommt.** Die Instanz `pb.tangojam.de` ist mit
> anderen Apps geteilt (z. B. Deutschlandreise). Die Import-Seite von PocketBase
> **löscht standardmäßig alle Collections, die nicht in der Datei stehen** — der
> Schalter „Merge with the existing collections" ist beim Öffnen **aus**.
> Das ist kein theoretisches Risiko: im Test waren mit ausgeschaltetem Schalter
> anschließend `users` und die Fremd-Collection `dr_stops` **weg**.
> → Schritt 5 unten ist der wichtigste Schritt dieses Runbooks.

## Schritte

1. Admin-UI öffnen: **[https://pb.tangojam.de/_/](https://pb.tangojam.de/_/)** und als
   Superuser einloggen (E-Mail + Superuser-Passwort).
2. **Erst ein Backup ziehen.** Linke Seitenleiste unten → Zahnrad **Settings** →
   **Backups** → Button **„New backup"** → Namen bestätigen. Dauert Sekunden und ist
   die Rückfahrkarte für die ganze geteilte Instanz.
3. In derselben Settings-Liste auf **„Import collections"** klicken.
4. Button **„Load from JSON file"** klicken und die Datei
   `import-collections.json` (Pfad oben) auswählen.
   *Alternativ:* Dateiinhalt kopieren und in das große Feld **„Collections"** einfügen.
5. ⚠️ Den Schalter **„Merge with the existing collections" EINSCHALTEN.**
   Er erscheint erst, wenn die JSON gültig eingelesen wurde, und ist standardmäßig
   **aus**. Ohne ihn löscht der Import alles andere auf der Instanz.
6. Unter **„Detected changes"** kontrollieren:
   - **5 × grünes „Added":** `sj_users`, `sj_dreams`, `sj_projects`, `sj_events`, `sj_weeks`
   - **0 × rotes „Deleted".**
   Steht dort auch nur ein einziges rotes „Deleted" → **abbrechen**, zurück zu Schritt 5.
7. Button **„Review"** klicken. Es öffnet sich ein „Side-by-side diff".
   Dort **„Confirm and import"** klicken.
8. Erfolgsmeldung: **„Successfully imported collections configuration."**
9. Gegenprüfen: In der linken Collections-Liste stehen jetzt die fünf `sj_*`-Collections
   **und** alle vorher vorhandenen Collections der anderen Apps sind noch da.

## Danach: App-Account anlegen

Es gibt bewusst **keine Registrierung** in der App (`createRule = null`). Der eine
Account wird hier von Hand angelegt:

10. Linke Seitenleiste → Collection **`sj_users`** → Button **„New record"**.
11. Ausfüllen:
    - **email:** deine App-E-Mail (darf dieselbe wie beim Superuser sein, das Passwort **nicht**)
    - **password / passwordConfirm:** **mindestens 12 Zeichen**, NICHT das Superuser-Passwort
    - **verified:** einschalten
    - **name:** `Norbert`
12. **„Create"** klicken. HTTP 400 mit Meldung an `password` = Passwort zu kurz.
13. E-Mail + Passwort in den Passwortmanager. Damit loggst du dich später in der
    Sabbatjahr-App ein — das Superuser-Passwort brauchst du dort nie.

## Danach: Auto-Backup einschalten

14. **Settings → Backups → „Auto backups"** aktivieren, Zeitplan z. B. täglich,
    Aufbewahrung 7 Backups → **Save**.
    Begründung: `pb_data/data.db` ist die einzige Kopie eines ganzen Sabbatjahrs
    an Reflexion.

## Was davon Claude in Chrome übernehmen kann

Schritte 1–9 und 14 kann Claude in Chrome klicken. **Nicht** übernehmen kann/darf es:
das Superuser-Passwort (Schritt 1) und das App-Passwort (Schritt 11) — die tippt
Norbert selbst.

## Wenn bei Variante A etwas klemmt

| Symptom | Ursache / Lösung |
|---|---|
| „Invalid collections configuration." | Datei nicht vollständig eingefügt. Besser „Load from JSON file" statt Copy-Paste. |
| „Your collections configuration is already up-to-date!" | Das Schema ist schon drin — nichts zu tun, weiter mit Schritt 10. |
| Rote „Deleted"-Einträge in „Detected changes" | Schalter aus Schritt 5 ist aus. **Nicht** auf Review klicken. |
| Import lief mit Schalter AUS durch | Sofort das Backup aus Schritt 2 zurückspielen: Settings → Backups → beim Backup auf „Restore". |
| Schritt 12 gibt einen Fehler an `password` | Passwort kürzer als 12 Zeichen. |
| Schritt 12 gibt einen Fehler an `email` | Die E-Mail existiert schon in `sj_users`. |

**Wiederholbar:** Der Import ist idempotent — zweimal mit denselben Daten laufen zu
lassen ändert nichts (getestet). Nur der Schalter aus Schritt 5 muss jedes Mal an sein.

## Zurückrollen (Variante A)

Collections einzeln löschen: Collection öffnen → oben rechts Zahnrad → „Delete".
Löscht die enthaltenen Datensätze mit. Sauberer und vollständiger ist das Backup aus
Schritt 2 (Settings → Backups → „Restore") — das betrifft dann allerdings die
**ganze Instanz**, also auch die anderen Apps.

---

# Variante B — Terminal.app / SSH (Fallback)

> **Voraussetzung, die aktuell fehlt:** Der öffentliche Schlüssel `macbook-air-nk`
> (`SHA256:E8RCnRpp…`) muss auf dem Server in `/root/.ssh/authorized_keys` stehen.
> Solange das nicht der Fall ist, scheitert dieser Weg schon an Schritt 1 — dann
> Variante A nehmen.

> **Warum von Hand?** Weder die Cowork-Cloud-Sandbox noch `device_bash` erreichen den
> STRATO-Server (Egress-Gateway), und der SSH-Key liegt nur im macOS-Schlüsselbund.
> Das hier läuft also in **Terminal.app auf Norberts Mac** — einmal einfügen, fertig.
>
> Alles ist getestet, außer dem Server selbst. Was der Testlauf abdeckt: `TESTLOG.md`.

## Vorher kurz prüfen

- Terminal.app ist offen, Shell ist **zsh** (Standard auf dem Mac).
- `ssh root@pb.tangojam.de 'echo ok'` antwortet mit `ok`.
  Falls der Hostname anders ist (IP statt Domain), unten `PB_SSH` anpassen.
- Es gibt einen **Superuser** auf der Instanz (z. B. `mcp@tangojam.de` vom MCP-Setup).
  Falls nicht — siehe „Kein Superuser?" ganz unten.

## Der eine Befehl

Kompletter Block: Migrationen hochladen → PocketBase neu starten → prüfen, dass die
Collections da sind → Norberts Account anlegen → Login testen.

**Passwörter tippst nur du, sie landen in keiner Datei und in keinem Prozess-Argument.**

```zsh
PB_SSH="root@pb.tangojam.de"; PB_URL="https://pb.tangojam.de"; PB_DIR="/opt/pocketbase"
SJ="$HOME/Downloads/Codex playground/sabbatjahr/pocketbase" && \
echo "→ 1/5 Migrationen hochladen" && \
ssh "$PB_SSH" "mkdir -p $PB_DIR/pb_migrations" && \
scp "$SJ/pb_migrations/"*.js "$PB_SSH:$PB_DIR/pb_migrations/" && \
echo "→ 2/5 PocketBase neu starten" && \
ssh "$PB_SSH" "systemctl restart pocketbase && sleep 3 && systemctl is-active pocketbase" && \
for i in $(seq 1 30); do curl -sf -o /dev/null "$PB_URL/api/health" && break; sleep 1; done && echo "   Server ist wieder da" && \
echo "→ 3/5 Superuser-Login (für die Kontrolle)" && \
printf 'Superuser-E-Mail: ' && read -r SU_MAIL && \
printf 'Superuser-Passwort: ' && read -rs SU_PW && echo && \
SU_TOKEN=$(printf '{"identity":"%s","password":"%s"}' "$SU_MAIL" "$SU_PW" | curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" -H 'Content-Type: application/json' --data @- | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))') && \
unset SU_PW && \
[ -n "$SU_TOKEN" ] && echo "   Login ok" && \
echo "→ 4/5 Collections prüfen" && \
for C in sj_users sj_dreams sj_events sj_projects sj_weeks; do printf '   %-12s %s\n' "$C" "$(curl -s -o /dev/null -w '%{http_code}' "$PB_URL/api/collections/$C" -H "Authorization: $SU_TOKEN")"; done && \
echo "   (5x 200 = alles angelegt)" && \
echo "→ 5/5 Norberts App-Account anlegen (mind. 12 Zeichen, NICHT das Superuser-Passwort)" && \
printf 'App-E-Mail: ' && read -r APP_MAIL && \
printf 'App-Passwort: ' && read -rs APP_PW && echo && \
printf '{"email":"%s","password":"%s","passwordConfirm":"%s","name":"Norbert","verified":true}' "$APP_MAIL" "$APP_PW" "$APP_PW" | curl -s -X POST "$PB_URL/api/collections/sj_users/records" -H "Authorization: $SU_TOKEN" -H 'Content-Type: application/json' --data @- -o /tmp/sj_user.json -w '   Anlegen: HTTP %{http_code}\n' && \
printf '{"identity":"%s","password":"%s"}' "$APP_MAIL" "$APP_PW" | curl -s -X POST "$PB_URL/api/collections/sj_users/auth-with-password" -H 'Content-Type: application/json' --data @- -o /dev/null -w '   Login-Test: HTTP %{http_code} (200 = fertig)\n' ; \
unset SU_PW APP_PW SU_TOKEN; rm -f /tmp/sj_user.json; echo "→ Fertig. Passwörter aus der Shell entfernt."
```

### Was du sehen solltest

```
→ 1/5 Migrationen hochladen
→ 2/5 PocketBase neu starten
active
   Server ist wieder da
→ 3/5 Superuser-Login (für die Kontrolle)
   Login ok
→ 4/5 Collections prüfen
   sj_users      200
   sj_dreams     200
   sj_events     200
   sj_projects   200
   sj_weeks      200
   (5x 200 = alles angelegt)
→ 5/5 Norberts App-Account anlegen …
   Anlegen: HTTP 200
   Login-Test: HTTP 200 (200 = fertig)
→ Fertig. Passwörter aus der Shell entfernt.
```

Merke dir die **App-E-Mail + App-Passwort** (Passwortmanager) — damit loggst du dich
später in der Sabbatjahr-App ein. Das Superuser-Passwort brauchst du dort nie.

## Wenn etwas klemmt

| Symptom | Ursache / Lösung |
|---|---|
| `read: -p: no coprocess` | Du hast eine bash-Variante des Befehls erwischt. Der Block oben ist bewusst zsh-tauglich (`printf` + `read -rs`). |
| Schritt 4 zeigt `404` | Migrationen wurden nicht angewandt. Prüfen: `ssh root@pb.tangojam.de 'journalctl -u pocketbase -n 40 --no-pager'` — meist liegt der Migrations-Ordner falsch (`ls /opt/pocketbase/pb_migrations`). |
| Schritt 3 „Login ok" fehlt | Superuser-Passwort falsch oder es gibt keinen. Siehe unten. |
| Schritt 5 `HTTP 400` | Passwort kürzer als 12 Zeichen, oder die E-Mail existiert schon in `sj_users`. |
| Schritt 5 `HTTP 403` | Der Superuser-Token ist abgelaufen — Block einfach nochmal laufen lassen (Schritte 1–4 sind wiederholbar, die Migrationen laufen nicht doppelt). |

**Wiederholbar:** Der ganze Block ist idempotent, solange du in Schritt 5 keine
E-Mail nimmst, die es schon gibt. Migrationen, die schon angewandt sind, werden von
PocketBase übersprungen.

### Kein Superuser?

Auf dem Server anlegen — Passwort tippst du direkt in den Prompt, nichts landet in
einer Datei:

```zsh
ssh -t root@pb.tangojam.de 'cd /opt/pocketbase && ./pocketbase superuser upsert DEINE@MAIL.DE --dir /opt/pocketbase/pb_data'
```

### Passwort der App später ändern

Admin-UI `https://pb.tangojam.de/_/` → Collection `sj_users` → den Record öffnen →
neues Passwort setzen → Speichern. Danach musst du dich in der App neu einloggen.

### Zurückrollen

Die Migrationen sind reversibel (lokal getestet: `migrate down 2` und wieder hoch).
Auf dem Server:

```zsh
ssh -t root@pb.tangojam.de 'cd /opt/pocketbase && systemctl stop pocketbase && ./pocketbase migrate down 2 --dir /opt/pocketbase/pb_data && systemctl start pocketbase'
```

⚠️ Zwei Dinge:
1. Der Befehl **listet vor der Rückfrage die zwei Migrationen auf**, die er zurückrollt.
   Nur mit `y` bestätigen, wenn dort `1785436900_sj_relations_rules.js` und
   `1785436800_sj_collections.js` stehen — sonst erwischst du die Migration einer
   anderen App auf derselben Instanz.
2. Es **löscht die fünf `sj_*`-Collections samt Inhalt**. Erst machen, wenn wirklich
   noch keine echten Daten drin sind. Andere Apps auf der Instanz bleiben unberührt.
