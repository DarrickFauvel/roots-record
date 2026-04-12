import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";

export const relationshipsRouter = Router();
relationshipsRouter.use(requireAuth);

// POST /api/relationships
relationshipsRouter.post("/", async (req, res) => {
  const { person_id, rel_person_id, rel_type, rel_direction, rel_start_date } =
    req.body as Record<string, string>;

  if (!person_id || !rel_person_id || !rel_type) {
    res.status(400).json({ error: "person_id, rel_person_id, and rel_type are required" });
    return;
  }

  const id = nanoid();
  let person1Id: string;
  let person2Id: string;

  if (rel_type === "parent_child") {
    if (rel_direction === "child") {
      // rel_person_id is the parent
      person1Id = rel_person_id;
      person2Id = person_id;
    } else {
      // rel_person_id is the child
      person1Id = person_id;
      person2Id = rel_person_id;
    }
  } else {
    // spouse — order doesn't matter
    person1Id = person_id;
    person2Id = rel_person_id;
  }

  await db.execute({
    sql: "INSERT INTO relationships (id, person1_id, person2_id, type, start_date) VALUES (?, ?, ?, ?, ?)",
    args: [id, person1Id, person2Id, rel_type, rel_start_date || null],
  });

  res.json({ ok: true, id });
});

// DELETE /api/relationships/:id
relationshipsRouter.delete("/:id", async (req, res) => {
  await db.execute({ sql: "DELETE FROM relationships WHERE id = ?", args: [req.params.id] });
  res.json({ ok: true });
});
