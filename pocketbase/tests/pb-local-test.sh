#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Sabbatjahr-App — ehrlicher Lokaltest des PocketBase-Schemas.
#
# Startet eine FRISCHE PocketBase-Instanz in einem Wegwerf-Verzeichnis, spielt
# pb_migrations/ ein und prüft per HTTP-API:
#   - CRUD auf allen vier Daten-Collections als Norbert-Testaccount
#   - Negativtests: anonym, zweiter Auth-Record, Auth-Record aus einer FREMDEN
#     Auth-Collection mit IDENTISCHER ID, Owner-Übernahme, Self-Signup
#
# Alle Passwörter werden zur Laufzeit zufällig erzeugt und nur im Wegwerf-
# Verzeichnis verwendet. KEINE Secrets in dieser Datei, keine im Repo.
#
# Aufruf:  bash pocketbase/tests/pb-local-test.sh /pfad/zur/pocketbase-binary
# ---------------------------------------------------------------------------
set -uo pipefail

PB_BIN="${1:-./pocketbase}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
PORT="${PB_TEST_PORT:-8096}"
BASE="http://127.0.0.1:${PORT}"
LOG="${WORK}/result.txt"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS  $1" | tee -a "$LOG"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL  $1" | tee -a "$LOG"; }
head_() { echo "" | tee -a "$LOG"; echo "== $1" | tee -a "$LOG"; }

# expect <label> <actual-http-code> <expected...>
expect() {
  local label="$1"; local actual="$2"; shift 2
  for e in "$@"; do [ "$actual" = "$e" ] && { ok "$label (HTTP $actual)"; return; }; done
  bad "$label — HTTP $actual, erwartet: $*"
}

rnd() { head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

cleanup() { pkill -x pocketbase >/dev/null 2>&1; }
trap cleanup EXIT

echo "Arbeitsverzeichnis: $WORK"
cp -r "${HERE}/pb_migrations" "${WORK}/pb_migrations"

SU_EMAIL="test-superuser@example.invalid"
SU_PW="TestOnly-$(rnd)"
"$PB_BIN" superuser upsert "$SU_EMAIL" "$SU_PW" --dir "${WORK}/pb_data" >/dev/null 2>&1 \
  || { echo "superuser upsert fehlgeschlagen"; exit 1; }

( "$PB_BIN" serve --dir "${WORK}/pb_data" --migrationsDir "${WORK}/pb_migrations" \
    --http "127.0.0.1:${PORT}" >"${WORK}/serve.log" 2>&1 & )

for i in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/health")" = "200" ] && break
  sleep 1
done

# --- Helfer: HTTP-Code / Body -------------------------------------------------
code() { # code METHOD PATH [TOKEN] [BODY]
  local m="$1" p="$2" t="${3:-}" b="${4:-}"
  local args=(-s -o "${WORK}/body.json" -w '%{http_code}' -X "$m" "${BASE}${p}")
  [ -n "$t" ] && args+=(-H "Authorization: $t")
  [ -n "$b" ] && args+=(-H 'Content-Type: application/json' -d "$b")
  curl "${args[@]}"
}
body() { cat "${WORK}/body.json"; }
# jq_ key [key...]  -> Wert aus der letzten Antwort ('' wenn nicht vorhanden)
jq_() {
  python3 - "${WORK}/body.json" "$@" <<'PY' 2>/dev/null
import sys, json
try:
    d = json.load(open(sys.argv[1]))
    for k in sys.argv[2:]:
        d = d[int(k)] if isinstance(d, list) else d[k]
    print(d)
except Exception:
    print("")
PY
}
# Anonyme/fremde list-Requests liefern in PocketBase HTTP 200 mit LEERER Liste,
# weil die listRule als Filter ausgewertet wird (nur listRule = null gibt 403).
# Deshalb wird hier auf "0 Treffer" geprüft, nicht auf einen Fehlercode.
expect_empty_list() { # expect_empty_list LABEL COLLECTION [TOKEN]
  local label="$1" col="$2" tok="${3:-}"
  local c; c=$(code GET "/api/collections/${col}/records" "$tok")
  local n; n=$(jq_ totalItems)
  if [ "$c" != "200" ]; then
    ok "$label — abgewiesen (HTTP $c)"
  elif [ "$n" = "0" ]; then
    ok "$label — HTTP 200, 0 Treffer"
  else
    bad "LECK: $label — HTTP 200, totalItems=$n"
  fi
}

head_ "0. Migrationen"
grep -q "sj_" "${WORK}/serve.log" 2>/dev/null
COLS=$(python3 - "$WORK" <<'PY'
import sqlite3,sys
c=sqlite3.connect(sys.argv[1]+"/pb_data/data.db")
print(",".join(sorted(r[0] for r in c.execute("select name from _collections") if r[0].startswith("sj_"))))
PY
)
[ "$COLS" = "sj_dreams,sj_events,sj_projects,sj_users,sj_weeks" ] \
  && ok "alle 5 sj_-Collections angelegt" || bad "Collections: $COLS"

SU_TOKEN=$(curl -s -X POST "${BASE}/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"${SU_EMAIL}\",\"password\":\"${SU_PW}\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
[ -n "$SU_TOKEN" ] && ok "Superuser-Login" || { bad "Superuser-Login"; exit 1; }

head_ "1. Accounts (per Superuser, wie im Runbook)"
A_PW="TestOnlyNorbert-$(rnd)"
B_PW="TestOnlyFremd-$(rnd)"

c=$(code POST /api/collections/sj_users/records "$SU_TOKEN" \
  "{\"email\":\"norbert-test@example.invalid\",\"password\":\"${A_PW}\",\"passwordConfirm\":\"${A_PW}\",\"name\":\"Norbert (Test)\",\"verified\":true}")
expect "Superuser legt Norbert-Account an" "$c" 200
A_ID=$(jq_ id)

c=$(code POST /api/collections/sj_users/records "$SU_TOKEN" \
  "{\"email\":\"fremd-test@example.invalid\",\"password\":\"${B_PW}\",\"passwordConfirm\":\"${B_PW}\",\"name\":\"Fremd (Test)\",\"verified\":true}")
expect "Superuser legt zweiten sj_users-Account an" "$c" 200
B_ID=$(jq_ id)

SHORT="kurz1234"
c=$(code POST /api/collections/sj_users/records "$SU_TOKEN" \
  "{\"email\":\"kurz-test@example.invalid\",\"password\":\"${SHORT}\",\"passwordConfirm\":\"${SHORT}\",\"verified\":true}")
expect "Passwort mit 8 Zeichen wird abgelehnt (min 12)" "$c" 400

A_TOKEN=$(curl -s -X POST "${BASE}/api/collections/sj_users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"norbert-test@example.invalid\",\"password\":\"${A_PW}\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
[ -n "$A_TOKEN" ] && ok "Login Norbert (E-Mail + Passwort)" || bad "Login Norbert"

B_TOKEN=$(curl -s -X POST "${BASE}/api/collections/sj_users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"fremd-test@example.invalid\",\"password\":\"${B_PW}\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
[ -n "$B_TOKEN" ] && ok "Login zweiter Account" || bad "Login zweiter Account"

head_ "2. CRUD als Norbert"
c=$(code POST /api/collections/sj_dreams/records "$A_TOKEN" \
  "{\"owner\":\"${A_ID}\",\"title\":\"Tango in Buenos Aires\",\"category\":\"tango\",\"status\":\"idee\",\"priority\":1,\"target_month\":\"2027-03\",\"description\":\"Milonga-Reise\"}")
expect "create sj_dreams" "$c" 200
D_ID=$(jq_ id)

c=$(code POST /api/collections/sj_projects/records "$A_TOKEN" \
  "{\"owner\":\"${A_ID}\",\"title\":\"Klavier: Bach-Invention 8\",\"status\":\"aktiv\",\"area\":\"musik\",\"next_action\":\"Takte 1-8 langsam\",\"definition_of_done\":\"auswendig, 100 bpm\"}")
expect "create sj_projects" "$c" 200
P_ID=$(jq_ id)

c=$(code PATCH "/api/collections/sj_dreams/records/${D_ID}" "$A_TOKEN" \
  "{\"status\":\"geplant\",\"project\":\"${P_ID}\"}")
expect "update sj_dreams + Cross-Relation dream->project" "$c" 200

c=$(code PATCH "/api/collections/sj_projects/records/${P_ID}" "$A_TOKEN" "{\"dream\":\"${D_ID}\"}")
expect "update sj_projects + Cross-Relation project->dream" "$c" 200

c=$(code POST /api/collections/sj_events/records "$A_TOKEN" \
  "{\"owner\":\"${A_ID}\",\"title\":\"Bendito Tango Marathon\",\"date_start\":\"2026-10-02 00:00:00.000Z\",\"date_end\":\"2026-10-04 00:00:00.000Z\",\"all_day\":true,\"category\":\"tango\",\"location\":\"Mannheim\",\"url\":\"https://example.invalid/marathon\"}")
expect "create sj_events" "$c" 200
E_ID=$(jq_ id)

c=$(code POST /api/collections/sj_weeks/records "$A_TOKEN" \
  "{\"owner\":\"${A_ID}\",\"week_start\":\"2026-08-03 00:00:00.000Z\",\"plan\":{\"top3\":[\"Steuer\",\"Klavier\",\"Reise planen\"],\"frog\":\"Steuerunterlagen sortieren\",\"fokus_projekt_id\":\"${P_ID}\"},\"review\":{\"gelungen\":\"\",\"haengt\":\"\",\"gelernt\":\"\",\"freude\":\"\"},\"mood\":4}")
expect "create sj_weeks (JSON-Felder)" "$c" 200
W_ID=$(jq_ id)

c=$(code POST /api/collections/sj_weeks/records "$A_TOKEN" \
  "{\"owner\":\"${A_ID}\",\"week_start\":\"2026-08-03 00:00:00.000Z\"}")
expect "zweite Woche mit gleichem week_start abgelehnt (unique index)" "$c" 400

c=$(code GET "/api/collections/sj_weeks/records/${W_ID}" "$A_TOKEN")
PLAN=$(jq_ plan frog)
[ "$PLAN" = "Steuerunterlagen sortieren" ] && ok "JSON-Feld liest sich als Objekt zurück" || bad "JSON-Feld: '$PLAN'"

for col in sj_dreams sj_projects sj_events sj_weeks; do
  c=$(code GET "/api/collections/${col}/records" "$A_TOKEN")
  N=$(jq_ totalItems)
  [ "$c" = "200" ] && [ "$N" -ge 1 ] && ok "list ${col} als Norbert -> ${N} Treffer" \
    || bad "list ${col} als Norbert -> HTTP $c / $N"
done

c=$(code GET "/api/collections/sj_projects/records/${P_ID}?expand=dream" "$A_TOKEN")
expect "expand über Cross-Relation" "$c" 200

head_ "3. Negativtest — anonym"
for col in sj_dreams sj_projects sj_events sj_weeks sj_users; do
  expect_empty_list "anonym list ${col}" "$col"
done
c=$(code GET "/api/collections/sj_dreams/records/${D_ID}")
expect "anonym view eines konkreten Traums verweigert" "$c" 400 403 404
c=$(code POST /api/collections/sj_dreams/records "" "{\"owner\":\"${A_ID}\",\"title\":\"Hack\"}")
expect "anonym create verweigert" "$c" 400 403
c=$(code POST /api/collections/sj_users/records "" \
  '{"email":"selfsignup@example.invalid","password":"LangGenug12345","passwordConfirm":"LangGenug12345"}')
expect "Self-Signup verweigert (createRule = null)" "$c" 400 403

head_ "4. Negativtest — zweiter sj_users-Account"
for col in sj_dreams sj_projects sj_events sj_weeks; do
  expect_empty_list "list ${col} als zweiter sj_users-Account" "$col" "$B_TOKEN"
done
c=$(code GET "/api/collections/sj_dreams/records/${D_ID}" "$B_TOKEN")
expect "Fremder kann Norberts Traum nicht lesen" "$c" 404 403
c=$(code PATCH "/api/collections/sj_dreams/records/${D_ID}" "$B_TOKEN" '{"title":"gekapert"}')
expect "Fremder kann Norberts Traum nicht ändern" "$c" 404 403
c=$(code DELETE "/api/collections/sj_events/records/${E_ID}" "$B_TOKEN")
expect "Fremder kann Norberts Termin nicht löschen" "$c" 404 403
c=$(code POST /api/collections/sj_dreams/records "$B_TOKEN" "{\"owner\":\"${A_ID}\",\"title\":\"untergeschoben\"}")
expect "Fremder kann keinen Datensatz auf Norbert anlegen" "$c" 400 403
c=$(code GET "/api/collections/sj_users/records/${A_ID}" "$B_TOKEN")
expect "Fremder kann Norberts Benutzer-Record nicht lesen" "$c" 404 403
c=$(code GET "/api/collections/sj_users/records" "$B_TOKEN")
expect "sj_users ist nicht auflistbar (listRule = null)" "$c" 400 403 404

head_ "5. Negativtest — Owner-Übernahme durch Norbert selbst"
c=$(code PATCH "/api/collections/sj_dreams/records/${D_ID}" "$A_TOKEN" "{\"owner\":\"${B_ID}\"}")
expect "owner kann nicht auf fremden Account umgebogen werden" "$c" 400 403 404
c=$(code GET "/api/collections/sj_dreams/records/${D_ID}" "$A_TOKEN")
OW=$(jq_ owner)
[ "$OW" = "$A_ID" ] && ok "owner unverändert nach Übernahmeversuch" || bad "owner ist jetzt '$OW'"

head_ "6. Negativtest — fremde Auth-Collection auf derselben Instanz"
# Reales Szenario: pb.tangojam.de ist geteilt. Andere Apps (z. B. Deutschlandreise)
# haben eigene Auth-Collections, teils mit anonym erzeugten Records.

# 6a) Kann ein fremder Auth-Record gezielt Norberts Record-ID bekommen?
X_PW="TestOnlyClash-$(rnd)"
c=$(code POST /api/collections/users/records "$SU_TOKEN" \
  "{\"id\":\"${A_ID}\",\"email\":\"clash-test@example.invalid\",\"password\":\"${X_PW}\",\"passwordConfirm\":\"${X_PW}\",\"verified\":true}")
if [ "$c" = "400" ] && grep -q "validation_invalid_auth_id" "${WORK}/body.json"; then
  ok "PocketBase verweigert doppelte Auth-Record-ID über Collection-Grenzen hinweg"
elif [ "$c" = "200" ]; then
  bad "ACHTUNG: fremde Auth-Collection konnte Norberts ID übernehmen"
else
  bad "unerwartete Antwort beim ID-Doppelgänger-Versuch (HTTP $c): $(body)"
fi

# 6b) Normaler Auth-Record einer fremden Collection sieht nichts.
Y_PW="TestOnlyFremdColl-$(rnd)"
c=$(code POST /api/collections/users/records "$SU_TOKEN" \
  "{\"email\":\"andere-app-test@example.invalid\",\"password\":\"${Y_PW}\",\"passwordConfirm\":\"${Y_PW}\",\"verified\":true}")
expect "Auth-Record in fremder Collection 'users' angelegt" "$c" 200
Y_ID=$(jq_ id)
Y_TOKEN=$(curl -s -X POST "${BASE}/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"andere-app-test@example.invalid\",\"password\":\"${Y_PW}\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
if [ -n "$Y_TOKEN" ]; then
  ok "Login als Nutzer einer fremden Auth-Collection"
  for col in sj_dreams sj_projects sj_events sj_weeks; do
    expect_empty_list "fremde Auth-Collection list ${col}" "$col" "$Y_TOKEN"
  done
  c=$(code GET "/api/collections/sj_dreams/records/${D_ID}" "$Y_TOKEN")
  expect "fremde Auth-Collection kann Norberts Traum nicht lesen" "$c" 404 403
  c=$(code POST /api/collections/sj_dreams/records "$Y_TOKEN" "{\"owner\":\"${A_ID}\",\"title\":\"clash\"}")
  expect "fremde Auth-Collection kann nichts auf Norbert anlegen" "$c" 400 403
  c=$(code POST /api/collections/sj_dreams/records "$Y_TOKEN" "{\"owner\":\"${Y_ID}\",\"title\":\"clash\"}")
  expect "fremde Auth-Collection kann nichts auf sich selbst anlegen" "$c" 400 403
else
  bad "Login in fremder Auth-Collection fehlgeschlagen (6b nicht aussagekräftig)"
fi

head_ "6c. Beweis: @request.auth.collectionName unterscheidet wirklich"
# Wegwerf-Collection, deren listRule NUR auf collectionName prüft (kein owner).
# Sieht Norbert den Datensatz und der Fremde nicht, ist bewiesen, dass die
# Klausel korrekt ausgewertet wird und nicht bloß immer wahr/falsch ist.
c=$(code POST /api/collections "$SU_TOKEN" \
  '{"name":"sj_probe_tmp","type":"base","fields":[{"name":"txt","type":"text"}],"listRule":"@request.auth.collectionName = \"sj_users\"","viewRule":"@request.auth.collectionName = \"sj_users\""}')
if [ "$c" = "200" ]; then
  ok "Probe-Collection mit reiner collectionName-Rule angelegt (Rule-Syntax gültig)"
  c=$(code POST /api/collections/sj_probe_tmp/records "$SU_TOKEN" '{"txt":"probe"}')
  expect "Probe-Datensatz angelegt" "$c" 200
  c=$(code GET "/api/collections/sj_probe_tmp/records" "$A_TOKEN"); N=$(jq_ totalItems)
  [ "$N" = "1" ] && ok "sj_users-Token erfüllt collectionName-Rule (1 Treffer)" \
                 || bad "sj_users-Token sieht $N Treffer (erwartet 1)"
  c=$(code GET "/api/collections/sj_probe_tmp/records" "$Y_TOKEN"); N=$(jq_ totalItems)
  [ "$N" = "0" ] && ok "Token aus fremder Auth-Collection erfüllt sie NICHT (0 Treffer)" \
                 || bad "fremdes Token sieht $N Treffer (erwartet 0)"
  c=$(code GET "/api/collections/sj_probe_tmp/records"); N=$(jq_ totalItems)
  [ "$N" = "0" ] && ok "anonym erfüllt sie NICHT (0 Treffer)" || bad "anonym sieht $N Treffer"
  code DELETE "/api/collections/sj_probe_tmp" "$SU_TOKEN" >/dev/null
else
  bad "Probe-Collection konnte nicht angelegt werden (HTTP $c): $(body)"
fi

head_ "7. Löschen als Eigentümer"
c=$(code DELETE "/api/collections/sj_events/records/${E_ID}" "$A_TOKEN")
expect "Norbert löscht eigenen Termin" "$c" 204 200

echo "" | tee -a "$LOG"
echo "==============================================" | tee -a "$LOG"
echo "  PASS: ${PASS}   FAIL: ${FAIL}" | tee -a "$LOG"
echo "==============================================" | tee -a "$LOG"
cp "$LOG" "${WORK}/../pb-local-test-result.txt" 2>/dev/null
echo "Logdatei: $LOG"
cleanup
[ "$FAIL" = "0" ] || exit 1
