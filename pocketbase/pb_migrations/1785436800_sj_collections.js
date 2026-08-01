/// <reference path="../pb_data/types.d.ts" />
/**
 * Sabbatjahr-App — Durchgang 1 von 2: Collections anlegen.
 *
 * WICHTIG (Playbook-Gotcha "Back-Relation / Cross-Relation in ZWEI Durchgängen"):
 * sj_dreams.project -> sj_projects und sj_projects.dream -> sj_dreams verweisen
 * aufeinander. Sie können deshalb NICHT beim Anlegen gesetzt werden. Dieser
 * Durchgang legt nur die Collections + die nicht-zirkulären Felder an, alle
 * API-Rules bleiben null (= nur Superuser). Durchgang 2
 * (1785436900_sj_relations_rules.js) ergänzt die Cross-Relationen, die Indizes
 * und die owner-scoped Rules.
 *
 * Idempotent: legt eine Collection nur an, wenn sie noch nicht existiert.
 */
migrate(
  (app) => {
    function findOrNull(nameOrId) {
      try {
        return app.findCollectionByNameOrId(nameOrId);
      } catch (err) {
        return null;
      }
    }

    // ------------------------------------------------------------------
    // 1) Auth-Collection sj_users
    //    Eigene Auth-Collection statt der zentralen `users`, weil die
    //    PocketBase-Instanz mit anderen Apps geteilt wird. Kein Self-Signup
    //    (createRule bleibt null, auch in Durchgang 2).
    // ------------------------------------------------------------------
    let users = findOrNull("sj_users");
    if (!users) {
      users = new Collection({
        type: "auth",
        name: "sj_users",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        manageRule: null,
        fields: [
          { name: "name", type: "text", max: 200 },
          // Mindestlänge 12 statt PocketBase-Default 8 (Sicherheitscheck).
          {
            name: "password",
            type: "password",
            system: true,
            hidden: true,
            required: true,
            min: 12,
            cost: 0,
          },
        ],
        passwordAuth: { enabled: true, identityFields: ["email"] },
        oauth2: { enabled: false },
        otp: { enabled: false },
        mfa: { enabled: false },
      });
      app.save(users);
      users = app.findCollectionByNameOrId("sj_users");
    }

    // Nachträgliche Härtung, falls die Collection schon existierte.
    const pwField = users.fields.getByName("password");
    if (pwField && pwField.min < 12) {
      users.fields.addMarshaledJSON(
        JSON.stringify([
          {
            id: pwField.id,
            name: "password",
            type: "password",
            system: true,
            hidden: true,
            required: true,
            min: 12,
            cost: 0,
          },
        ])
      );
      app.save(users);
      users = app.findCollectionByNameOrId("sj_users");
    }

    const ownerId = users.id;

    // Gemeinsames owner-Feld: Relation auf sj_users, Pflicht, Kaskaden-Löschung.
    function ownerField() {
      return {
        name: "owner",
        type: "relation",
        required: true,
        collectionId: ownerId,
        maxSelect: 1,
        minSelect: 0,
        cascadeDelete: true,
      };
    }

    const timestamps = [
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ];

    const AREAS = [
      "reise",
      "musik",
      "tango",
      "familie",
      "lernen",
      "gesundheit",
      "sonstiges",
    ];

    function createIfMissing(def) {
      if (findOrNull(def.name)) {
        return;
      }
      app.save(new Collection(def));
    }

    // ------------------------------------------------------------------
    // 2) sj_dreams — Träume & Bucketlist (ohne `project`, siehe Durchgang 2)
    // ------------------------------------------------------------------
    createIfMissing({
      type: "base",
      name: "sj_dreams",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        ownerField(),
        { name: "title", type: "text", required: true, max: 200 },
        { name: "description", type: "text", max: 2000 },
        { name: "category", type: "select", maxSelect: 1, values: AREAS },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["idee", "geplant", "in_umsetzung", "erlebt", "verworfen"],
        },
        { name: "priority", type: "number", min: 1, max: 3, onlyInt: true },
        {
          name: "target_month",
          type: "text",
          max: 7,
          pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$",
        },
        { name: "notes", type: "text", max: 5000 },
      ].concat(timestamps),
    });

    // ------------------------------------------------------------------
    // 3) sj_projects — Scanner-Board (ohne `dream`, siehe Durchgang 2)
    //    WIP-Limit (max. 3 aktiv) wird bewusst NUR im Frontend erzwungen.
    // ------------------------------------------------------------------
    createIfMissing({
      type: "base",
      name: "sj_projects",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        ownerField(),
        { name: "title", type: "text", required: true, max: 200 },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["idee", "aktiv", "pausiert", "abgeschlossen", "verworfen"],
        },
        { name: "area", type: "select", maxSelect: 1, values: AREAS },
        { name: "next_action", type: "text", max: 500 },
        { name: "definition_of_done", type: "text", max: 1000 },
        { name: "started_at", type: "date" },
        { name: "finished_at", type: "date" },
        { name: "notes", type: "text", max: 5000 },
      ].concat(timestamps),
    });

    // ------------------------------------------------------------------
    // 4) sj_events — feste Termine auf der Jahres-Timeline
    // ------------------------------------------------------------------
    createIfMissing({
      type: "base",
      name: "sj_events",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        ownerField(),
        { name: "title", type: "text", required: true, max: 200 },
        { name: "date_start", type: "date", required: true },
        { name: "date_end", type: "date" },
        { name: "all_day", type: "bool" },
        {
          name: "category",
          type: "select",
          maxSelect: 1,
          values: [
            "tango",
            "musik",
            "familie",
            "schule",
            "steuer",
            "reise",
            "sonstiges",
          ],
        },
        { name: "location", type: "text", max: 300 },
        { name: "url", type: "url" },
        { name: "notes", type: "text", max: 5000 },
      ].concat(timestamps),
    });

    // ------------------------------------------------------------------
    // 5) sj_weeks — Wochenplan + Review (unique je owner + week_start)
    // ------------------------------------------------------------------
    createIfMissing({
      type: "base",
      name: "sj_weeks",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        ownerField(),
        { name: "week_start", type: "date", required: true },
        { name: "plan", type: "json", maxSize: 20000 },
        { name: "review", type: "json", maxSize: 20000 },
        { name: "mood", type: "number", min: 1, max: 5, onlyInt: true },
      ].concat(timestamps),
    });
  },

  // ---------------------- down ----------------------
  (app) => {
    const names = ["sj_weeks", "sj_events", "sj_projects", "sj_dreams", "sj_users"];
    for (let i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]));
      } catch (err) {
        // existiert nicht (mehr) — ok
      }
    }
  }
);
