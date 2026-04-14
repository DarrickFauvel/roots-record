import { Router } from "express";
import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/node";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { eta } from "../server.js";

export const peopleApiRouter = Router();
peopleApiRouter.use(requireAuth);

// POST /api/people — create
peopleApiRouter.post("/", async (req, res) => {
  const { given_name, surname, sex, birth_date, birth_place, death_date, death_place, death_cause, notes } = req.body as Record<string, string>;
  if (!given_name?.trim()) {
    res.status(400).json({ error: "given_name is required" });
    return;
  }
  const id = nanoid();
  await db.execute({
    sql: `INSERT INTO people (id, given_name, surname, sex, birth_date, birth_place, death_date, death_place, death_cause, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, given_name.trim(), surname?.trim() || null, sex || "unknown", birth_date || null, birth_place?.trim() || null,
           death_date || null, death_place?.trim() || null, death_cause?.trim() || null, notes?.trim() || null, res.locals.user.id],
  });
  await syncFts(id);
  res.redirect(`/people/${id}`);
});

// PUT /api/people/:id — update (owner only)
peopleApiRouter.put("/:id", async (req, res) => {
  const { given_name, surname, sex, birth_date, birth_place, death_date, death_place, death_cause, notes } = req.body as Record<string, string>;
  if (!given_name?.trim()) {
    res.status(400).json({ error: "given_name is required" });
    return;
  }
  await db.execute({
    sql: `UPDATE people SET given_name=?, surname=?, sex=?, birth_date=?, birth_place=?,
          death_date=?, death_place=?, death_cause=?, notes=?, updated_at=datetime('now')
          WHERE id=? AND created_by=?`,
    args: [given_name.trim(), surname?.trim() || null, sex || "unknown", birth_date || null, birth_place?.trim() || null,
           death_date || null, death_place?.trim() || null, death_cause?.trim() || null, notes?.trim() || null,
           req.params.id, res.locals.user.id],
  });
  await syncFts(req.params.id);
  res.redirect(`/people/${req.params.id}`);
});

// DELETE /api/people/:id — delete (owner only)
peopleApiRouter.delete("/:id", async (req, res) => {
  await db.execute({ sql: "DELETE FROM people WHERE id = ? AND created_by = ?", args: [req.params.id, res.locals.user.id] });
  await db.execute({ sql: "DELETE FROM people_fts WHERE id = ?", args: [req.params.id] });
  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.removeElements(`#person-${req.params.id}`);
    stream.executeScript("window.location='/people'");
  });
});

// GET /api/people/:id/relationships
peopleApiRouter.get("/:id/relationships", async (req, res) => {
  const userId = res.locals.user.id as string;
  const pid = req.params.id;
  const [parents, spouses, children, siblings, allPeople] = await Promise.all([
    db.execute({ sql: `SELECT p.id, p.given_name, p.surname, r.id as rel_id FROM relationships r JOIN people p ON r.person1_id = p.id WHERE r.type = 'parent_child' AND r.person2_id = ?`, args: [pid] }),
    db.execute({ sql: `SELECT p.id, p.given_name, p.surname, r.id as rel_id, r.start_date FROM relationships r JOIN people p ON (CASE WHEN r.person1_id = ? THEN r.person2_id ELSE r.person1_id END = p.id) WHERE r.type = 'spouse' AND (r.person1_id = ? OR r.person2_id = ?)`, args: [pid, pid, pid] }),
    db.execute({ sql: `SELECT p.id, p.given_name, p.surname, r.id as rel_id FROM relationships r JOIN people p ON r.person2_id = p.id WHERE r.type = 'parent_child' AND r.person1_id = ?`, args: [pid] }),
    db.execute({ sql: `SELECT DISTINCT p.id, p.given_name, p.surname FROM relationships r1 JOIN relationships r2 ON r1.person1_id = r2.person1_id AND r1.type = 'parent_child' AND r2.type = 'parent_child' JOIN people p ON r2.person2_id = p.id WHERE r1.person2_id = ? AND r2.person2_id != ?`, args: [pid, pid] }),
    db.execute({ sql: "SELECT id, given_name, middle_name, surname FROM people WHERE created_by = ? ORDER BY surname, given_name", args: [userId] }),
  ]);

  const html = await eta.renderAsync("partials/relationships", {
    parents: parents.rows, spouses: spouses.rows, children: children.rows,
    siblings: siblings.rows, personId: pid, allPeople: allPeople.rows,
  });

  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="relationships-section">${html}</div>`);
  });
});

// GET /api/people/:id/residences
peopleApiRouter.get("/:id/residences", async (req, res) => {
  const result = await db.execute({ sql: "SELECT * FROM residences WHERE person_id = ? ORDER BY start_date", args: [req.params.id] });
  const html = await eta.renderAsync("partials/residences", { residences: result.rows, personId: req.params.id });
  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="residences-section">${html}</div>`);
  });
});

// GET /api/people/:id/documents
peopleApiRouter.get("/:id/documents", async (req, res) => {
  const result = await db.execute({ sql: "SELECT * FROM documents WHERE person_id = ? ORDER BY created_at DESC", args: [req.params.id] });
  const html = await eta.renderAsync("partials/document-list", { documents: result.rows, personId: req.params.id });
  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="documents-section">${html}</div>`);
  });
});

async function syncFts(personId: string): Promise<void> {
  const r = await db.execute({ sql: "SELECT * FROM people WHERE id = ?", args: [personId] });
  if (r.rows.length === 0) return;
  const p = r.rows[0];
  await db.batch([
    { sql: "DELETE FROM people_fts WHERE id = ?", args: [personId] },
    {
      sql: "INSERT INTO people_fts(id, given_name, surname, birth_place, death_place, notes) VALUES (?,?,?,?,?,?)",
      args: [p.id, p.given_name, p.surname ?? "", p.birth_place ?? "", p.death_place ?? "", p.notes ?? ""],
    },
  ]);
}
