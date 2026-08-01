# Sprint Sonnet — Sabbatjahr: CI-Gate + GitHub Pages Deploy

> **Session-Typ:** Sonnet (Standardarbeit) — gestartet als Subagent von Fable, 01.08.2026
> **Projektordner:** `~/Downloads/Codex playground/sabbatjahr/`
> **Sandbox-Mount (bash):** `/sessions/sweet-serene-keller/mnt/Codex playground/sabbatjahr/`
> **Kanonischer Stand:** `HANDOVER.md` — zuerst lesen.

## Kontext

Frontend (`index.html`) und 3 Playwright-Smoke-Specs sind fertig. Die Cowork-Sandbox
kann kein Chromium starten, auf dem MacBook fehlt der Browser-Download. Entscheidung
(HANDOVER, 01.08.): **Tests laufen in GitHub Actions** (Linux-Runner) als Deploy-Gate.
Repo `BenditoT/sabbatjahr` existiert noch nicht; das Projekt ist bewusst **kein**
Git-Repo (Sandbox-`git init` verboten — Lock-Datei-Falle). Der SSH-Key für GitHub
liegt in Norberts macOS-Schlüsselbund und funktioniert für den Account BenditoT
(Skill `git-deploy`).

## Ziel

Nach diesem Sprint gilt: Repo + Pages sind konfiguriert, `ci.yml` liegt bereit, und
für Norbert bleibt **genau EIN** Copy-Paste-Push-Block. Nach dessen Ausführung laufen
die Tests im echten Chromium und bei Grün deployt Pages automatisch.

## Aufgaben

1. **CI-Workflow schreiben:** `.github/workflows/ci.yml` im Projektordner.
   - Trigger: `push` auf `main` + `workflow_dispatch`.
   - Job 1 (Test-Gate): Ubuntu, Node 20, `npm ci`,
     `npx playwright install --with-deps chromium`, `npx playwright test`.
     Bei Rot: Playwright-Report als Artifact hochladen (`if: failure()`).
   - Job 2 (Deploy): nur bei Grün (`needs: test`), offizielles Pages-Muster
     (`actions/configure-pages`, `actions/upload-pages-artifact` mit `path: .`
     bzw. sinnvoll eingeschränkt, `actions/deploy-pages`), `permissions:
     pages: write, id-token: write`.
   - Muster: Skill `playwright-webapp-testing`. KEINE Timeouts erhöhen, keine
     Retries hochdrehen.
2. **`.gitignore` prüfen/ergänzen:** `node_modules/`, `.pw-browsers/`,
   `test-results/`, `playwright-report/`, `.DS_Store` müssen drin sein.
   Sicherstellen, dass KEINE Secrets im Ordner liegen (kurz greppen nach
   `password`, `token`, `secret` — Fundstellen bewerten, nicht blind löschen).
3. **Prüfen, ob `playwright.config.ts`/Fixtures CI-tauglich sind** (webServer-Start
   via http-server o. ä., `?forceMode=demo` — nur lesen/minimal anpassen, falls
   nötig für den Runner; keine Umbauten).
4. **Repo + Pages per Claude in Chrome:** Skill `github-pages-deploy-via-browser`.
   Chrome-Tools laden (`ToolSearch`), prüfen ob eine Browser-Verbindung besteht.
   - Wenn ja: Repo `BenditoT/sabbatjahr` anlegen (public, leer, ohne README —
     sonst divergiert die Historie beim Push), dann Settings → Pages →
     Source „GitHub Actions" aktivieren.
   - Wenn Claude in Chrome NICHT verbunden ist: NICHT abbrechen — stattdessen die
     Repo-Anlage als Teil des Push-Blocks lösen (`gh repo create` falls gh-CLI
     vorhanden ist, sonst 2 nummerierte Browser-Klick-Schritte VOR dem Push-Block)
     und das im Abschluss klar kennzeichnen.
5. **Den EINEN Push-Block formulieren** (für Norberts Terminal.app, zsh):
   `cd '~/Downloads/Codex playground/sabbatjahr'` → `git init -b main` →
   `git add -A` → Commit → `git remote add origin git@github.com:BenditoT/sabbatjahr.git`
   → `git push -u origin main`. Ein Block, keine Secrets, keine Platzhalter, die
   Norbert editieren muss.
6. **Verifikationsplan dokumentieren:** Nach Norberts Push kontrolliert der
   Orchestrator den Actions-Lauf im Browser. In der Abschlussmeldung die URLs
   nennen: `https://github.com/BenditoT/sabbatjahr/actions` und die erwartete
   Live-URL `https://benditot.github.io/sabbatjahr/`.

## Scope-Grenze

Mach NUR diese Aufgaben. NICHT anfassen: `index.html` (App-Code), `pocketbase/`
(macht der Opus-Sprint), keine neuen Features, keine Test-Änderungen außer
CI-Lauffähigkeit. **KEIN `git init` in der Sandbox oder im Mount** — Git läuft
ausschließlich in Norberts Push-Block. Keine Tokens/PATs anlegen oder verwenden.

## Operative Hinweise

- Dateien im Mount per Write/Edit-Tools anlegen (nicht bash-Heredoc in den Mount).
- `package.json` prüfen: `npm ci` braucht ein committetes `package-lock.json` — ist
  vorhanden. http-server o. ä. muss als devDependency drin sein, wenn der
  webServer es braucht; sonst `npx`-Aufruf im Config belassen.
- Der Pages-Artifact-Upload sollte `node_modules` NICHT mit hochladen — Include-Pfad
  klein halten (z. B. nur `index.html` in ein Deploy-Verzeichnis kopieren) oder
  Upload-Pfad gezielt setzen.

## Abschlusspflicht

Am Ende: `HANDOVER.md` aktualisieren (Stand CI/Deploy, was Norberts Push-Block ist,
was danach automatisch passiert). Abschlussmeldung mit: erstellte Dateien, Status
Repo/Pages (angelegt oder als Schritt an Norbert), der finale Push-Block als
Codeblock, offene Punkte.
