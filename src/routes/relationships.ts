import { Router } from "express";
import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/node";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { eta } from "../server.js";

export const relationshipsRouter = Router();
relationshipsRouter.use(requireAuth);

async function renderRelationships(personId: string, userId: string): Promise<string> {
  const [parents, spouses, children, siblings, allPeople] = await Promise.all([
    db.execute({ sql: `SELECT p.id, p.given_name, p.surname, r.id as rel_id FROM relationships r JOIN people p ON r.person1_id = p.id WHERE r.type = 'parent_child' AND r.person2_id = ?`, args: [personId] }),
    db.execute({ sql: `SELECT p.id, p.given_name, p.surname, r.id as rel_id, r.start_date FROM relationships r JOIN people p ON (CASE WHEN r.person1_id = ? THEN r.person2_id ELSE r.person1_id END = p.id) WHERE r.type = 'spouse' AND (r.person1_id = ? OR r.person2_id = ?)`, args: [personId, personId, personId] }),
    db.execute({ sql: `SELECT p.id, p.given_name, p.surname, r.id as rel_id FROM relationships r JOIN people p ON r.person2_id = p.id WHERE r.type = 'parent_child' AND r.person1_id = ?`, args: [personId] }),
    db.execute({ sql: `SELECT DISTINCT p.id, p.given_name, p.surname FROM relationships r1 JOIN relationships r2 ON r1.person1_id = r2.person1_id AND r1.type = 'parent_child' AND r2.type = 'parent_child' JOIN people p ON r2.person2_id = p.id WHERE r1.person2_id = ? AND r2.person2_id != ?`, args: [personId, personId] }),
    db.execute({ sql: "SELECT id, given_name, middle_name, surname FROM people WHERE created_by = ? ORDER BY surname, given_name", args: [userId] }),
  ]);
  return eta.renderAsync("partials/relationships", {
    parents: parents.rows, spouses: spouses.rows, children: children.rows,
    siblings: siblings.rows, personId, allPeople: allPeople.rows,
  });
}

// POST /api/relationships
relationshipsRouter.post("/", async (req, res) => {
  const { person_id, rel_person_id, rel_type, rel_direction, rel_start_date } =
    req.body as Record<string, string>;
  if (!person_id || !rel_person_id || !rel_type) {
    res.status(400).json({ error: "person_id, rel_person_id, and rel_type are required" });
    return;
  }
  const userId = res.locals.user.id as string;

  // Verify both people belong to this user
  const ownership = await db.execute({
    sql: "SELECT id FROM people WHERE id IN (?, ?) AND created_by = ?",
    args: [person_id, rel_person_id, userId],
  });
  if (ownership.rows.length < 2) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let person1Id: string, person2Id: string;
  if (rel_type === "parent_child") {
    if (rel_direction === "child") { person1Id = rel_person_id; person2Id = person_id; }
    else { person1Id = person_id; person2Id = rel_person_id; }
  } else {
    person1Id = person_id; person2Id = rel_person_id;
  }
  await db.execute({
    sql: "INSERT INTO relationships (id, person1_id, person2_id, type, start_date) VALUES (?, ?, ?, ?, ?)",
    args: [nanoid(), person1Id, person2Id, rel_type, rel_start_date || null],
  });
  const html = await renderRelationships(person_id, userId);
  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="relationships-section">${html}</div>`);
  });
});

// DELETE /api/relationships/:id
relationshipsRouter.delete("/:id", async (req, res) => {
  const { person_id } = req.body as Record<string, string>;
  const userId = res.locals.user.id as string;

  // Verify the relationship touches a person owned by this user
  const check = await db.execute({
    sql: `SELECT r.id FROM relationships r
          JOIN people p ON (p.id = r.person1_id OR p.id = r.person2_id)
          WHERE r.id = ? AND p.created_by = ?`,
    args: [req.params.id, userId],
  });
  if (check.rows.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.execute({ sql: "DELETE FROM relationships WHERE id = ?", args: [req.params.id] });
  if (!person_id) { res.json({ ok: true }); return; }
  const html = await renderRelationships(person_id, userId);
  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="relationships-section">${html}</div>`);
  });
});
