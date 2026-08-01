/// <reference path="../pb_data/types.d.ts" />
/**
 * Sabbatjahr-App — Durchgang 2 von 2: Cross-Relationen, Indizes, API-Rules.
 *
 * Läuft NACH 1785436800_sj_collections.js, weil sj_dreams.project und
 * sj_projects.dream sich gegenseitig referenzieren und beide Collections dafür
 * schon existieren müssen.
 *
 * Sicherheitskern dieses Projekts: alle vier Daten-Collections sind strikt
 * owner-scoped. Die PocketBase-Instanz ist mit anderen Apps geteilt (z. B.
 * Deutschlandreise mit anonymen Auth-Records), deshalb reicht
 * `@request.auth.id != ""` NICHT — es wird zusätzlich geprüft, dass der
 * Auth-Record aus sj_users stammt UND der Datensatz ihm gehört.
 *
 * Idempotent: Felder werden per addMarshaledJSON gesetzt (ersetzt vorhandene
 * gleichen Namens), Rules/Indizes werden einfach neu zugewiesen.
 */
migrate(
  (app) => {
    // ------------------------------------------------------------------
    // Rule-Bausteine
    // ------------------------------------------------------------------
    const IS_SJ_USER =
      '@request.auth.id != "" && @request.auth.collectionName = "sj_users"';

    // Lesen/Ändern/Löschen: nur eigene Datensätze.
    const OWNED = IS_SJ_USER + " && owner = @request.auth.id";

    // Anlegen: der mitgeschickte owner MUSS der eigene Auth-Record sein.
    // (`owner = @request.auth.id` prüft zusätzlich den entstehenden Datensatz.)
    const CREATE_OWNED =
      IS_SJ_USER +
      " && @request.body.owner = @request.auth.id" +
      " && owner = @request.auth.id";

    // Ändern: zusätzlich verbieten, den Datensatz an jemand anderen zu übergeben.
    const UPDATE_OWNED =
      OWNED +
      " && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)";

    function apply(name, fn) {
      const col = app.findCollectionByNameOrId(name);
      fn(col);
      app.save(col);
    }

    const dreams = app.findCollectionByNameOrId("sj_dreams");
    const projects = app.findCollectionByNameOrId("sj_projects");

    // ------------------------------------------------------------------
    // 1) Cross-Relationen nachziehen
    // ------------------------------------------------------------------
    apply("sj_dreams", (col) => {
      col.fields.addMarshaledJSON(
        JSON.stringify({
          name: "project",
          type: "relation",
          required: false,
          collectionId: projects.id,
          maxSelect: 1,
          minSelect: 0,
          cascadeDelete: false,
        })
      );
    });

    apply("sj_projects", (col) => {
      col.fields.addMarshaledJSON(
        JSON.stringify({
          name: "dream",
          type: "relation",
          required: false,
          collectionId: dreams.id,
          maxSelect: 1,
          minSelect: 0,
          cascadeDelete: false,
        })
      );
    });

    // ------------------------------------------------------------------
    // 2) Indizes
    // ------------------------------------------------------------------
    apply("sj_dreams", (col) => {
      col.indexes = ["CREATE INDEX `idx_sj_dreams_owner` ON `sj_dreams` (`owner`)"];
    });
    apply("sj_projects", (col) => {
      col.indexes = [
        "CREATE INDEX `idx_sj_projects_owner` ON `sj_projects` (`owner`)",
      ];
    });
    apply("sj_events", (col) => {
      col.indexes = [
        "CREATE INDEX `idx_sj_events_owner_start` ON `sj_events` (`owner`, `date_start`)",
      ];
    });
    apply("sj_weeks", (col) => {
      // Eine Wochenkarte pro Person und Montag.
      col.indexes = [
        "CREATE UNIQUE INDEX `idx_sj_weeks_owner_week` ON `sj_weeks` (`owner`, `week_start`)",
      ];
    });

    // ------------------------------------------------------------------
    // 3) API-Rules
    // ------------------------------------------------------------------
    const dataCollections = ["sj_dreams", "sj_projects", "sj_events", "sj_weeks"];
    for (let i = 0; i < dataCollections.length; i++) {
      apply(dataCollections[i], (col) => {
        col.listRule = OWNED;
        col.viewRule = OWNED;
        col.createRule = CREATE_OWNED;
        col.updateRule = UPDATE_OWNED;
        col.deleteRule = OWNED;
      });
    }

    // sj_users: kein Self-Signup, kein Auflisten, nur der eigene Record sichtbar.
    apply("sj_users", (col) => {
      col.listRule = null;
      col.viewRule = "id = @request.auth.id";
      col.createRule = null;
      col.updateRule = "id = @request.auth.id";
      col.deleteRule = null;
      col.manageRule = null;
    });
  },

  // ---------------------- down ----------------------
  (app) => {
    const names = ["sj_dreams", "sj_projects", "sj_events", "sj_weeks", "sj_users"];
    for (let i = 0; i < names.length; i++) {
      let col;
      try {
        col = app.findCollectionByNameOrId(names[i]);
      } catch (err) {
        continue;
      }
      col.listRule = null;
      col.viewRule = null;
      col.createRule = null;
      col.updateRule = null;
      col.deleteRule = null;
      if (names[i] === "sj_dreams") col.fields.removeByName("project");
      if (names[i] === "sj_projects") col.fields.removeByName("dream");
      app.save(col);
    }
  }
);
