import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { renderPage } from "../lib/render.js";

export const pagesRouter = Router();

// Public routes
pagesRouter.get("/login", async (_req, res) => {
  const html = await import("../server.js").then((m) => m.eta.renderAsync("login", {}));
  const page = await import("../server.js").then((m) =>
    m.eta.renderAsync("layout", { title: "Sign In — Roots Record", user: null, body: html })
  );
  res.send(page);
});

pagesRouter.get("/register", async (_req, res) => {
  const { eta } = await import("../server.js");
  const html = await eta.renderAsync("register", {});
  const page = await eta.renderAsync("layout", { title: "Register — Roots Record", user: null, body: html });
  res.send(page);
});

// Protected routes
pagesRouter.get("/", requireAuth, async (_req, res) => {
  const [peopleCount, relCount, docCount, recent] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM people").then((r) => Number(r.rows[0].c)),
    db.execute("SELECT COUNT(*) as c FROM relationships").then((r) => Number(r.rows[0].c)),
    db.execute("SELECT COUNT(*) as c FROM documents").then((r) => Number(r.rows[0].c)),
    db.execute("SELECT id, given_name, surname, birth_date, death_date FROM people ORDER BY created_at DESC LIMIT 10"),
  ]);
  await renderPage(res, "home", {
    title: "Home — Roots Record",
    user: res.locals.user,
    stats: { peopleCount, relationshipCount: relCount, documentCount: docCount },
    recent: recent.rows,
  });
});

pagesRouter.get("/people", requireAuth, async (_req, res) => {
  const result = await db.execute(
    "SELECT id, given_name, surname, birth_date, birth_place, death_date, death_place FROM people ORDER BY surname, given_name"
  );
  await renderPage(res, "people/list", {
    title: "People — Roots Record",
    user: res.locals.user,
    people: result.rows,
  });
});

pagesRouter.get("/people/new", requireAuth, async (_req, res) => {
  await renderPage(res, "people/form", {
    title: "Add Person — Roots Record",
    user: res.locals.user,
    person: null,
  });
});

pagesRouter.get("/people/:id/edit", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const result = await db.execute({
    sql: "SELECT * FROM people WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) {
    res.status(404).send("Person not found");
    return;
  }
  await renderPage(res, "people/form", {
    title: "Edit Person — Roots Record",
    user: res.locals.user,
    person: result.rows[0],
  });
});

pagesRouter.get("/people/:id", requireAuth, async (req, res) => {
  const pid = String(req.params.id);
  const [personResult, parents, spouses, children, siblings, residences, documents, allPeople] =
    await Promise.all([
      db.execute({ sql: "SELECT * FROM people WHERE id = ?", args: [pid] }),
      db.execute({
        sql: `SELECT p.id, p.given_name, p.surname, r.id as rel_id
              FROM relationships r JOIN people p ON r.person1_id = p.id
              WHERE r.type = 'parent_child' AND r.person2_id = ?`,
        args: [pid],
      }),
      db.execute({
        sql: `SELECT p.id, p.given_name, p.surname, r.id as rel_id, r.start_date
              FROM relationships r
              JOIN people p ON (CASE WHEN r.person1_id = ? THEN r.person2_id ELSE r.person1_id END = p.id)
              WHERE r.type = 'spouse' AND (r.person1_id = ? OR r.person2_id = ?)`,
        args: [pid, pid, pid],
      }),
      db.execute({
        sql: `SELECT p.id, p.given_name, p.surname, r.id as rel_id
              FROM relationships r JOIN people p ON r.person2_id = p.id
              WHERE r.type = 'parent_child' AND r.person1_id = ?`,
        args: [pid],
      }),
      db.execute({
        sql: `SELECT DISTINCT p.id, p.given_name, p.surname
              FROM relationships r1
              JOIN relationships r2 ON r1.person1_id = r2.person1_id AND r1.type = 'parent_child' AND r2.type = 'parent_child'
              JOIN people p ON r2.person2_id = p.id
              WHERE r1.person2_id = ? AND r2.person2_id != ?`,
        args: [pid, pid],
      }),
      db.execute({ sql: "SELECT * FROM residences WHERE person_id = ? ORDER BY start_date", args: [pid] }),
      db.execute({ sql: "SELECT * FROM documents WHERE person_id = ? ORDER BY created_at DESC", args: [pid] }),
      db.execute("SELECT id, given_name, surname FROM people ORDER BY surname, given_name"),
    ]);

  if (personResult.rows.length === 0) {
    res.status(404).send("Person not found");
    return;
  }

  await renderPage(res, "people/profile", {
    title: `${personResult.rows[0].given_name} ${personResult.rows[0].surname ?? ""} — Roots Record`,
    user: res.locals.user,
    person: personResult.rows[0],
    parents: parents.rows,
    spouses: spouses.rows,
    children: children.rows,
    siblings: siblings.rows,
    residences: residences.rows,
    documents: documents.rows,
    allPeople: allPeople.rows,
  });
});

pagesRouter.get("/tree", requireAuth, async (req, res) => {
  const people = await db.execute(
    "SELECT id, given_name, surname, birth_date FROM people ORDER BY surname, given_name"
  );
  const rootId = req.query.root as string | undefined;
  let tree = null;
  if (rootId) {
    const { buildDescendantTree } = await import("../lib/tree.js");
    tree = await buildDescendantTree(rootId, db);
  }
  await renderPage(res, "tree/index", {
    title: "Family Tree — Roots Record",
    user: res.locals.user,
    people: people.rows,
    rootId: rootId ?? null,
    tree,
  });
});
