import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";

export const residencesRouter = Router();
residencesRouter.use(requireAuth);

// POST /api/residences
residencesRouter.post("/", async (req, res) => {
  const { person_id, res_place, res_type, res_start, res_end, res_notes } =
    req.body as Record<string, string>;
  if (!person_id || !res_place) {
    res.status(400).json({ error: "person_id and res_place are required" });
    return;
  }
  const id = nanoid();
  await db.execute({
    sql: "INSERT INTO residences (id, person_id, place, type, start_date, end_date, notes) VALUES (?,?,?,?,?,?,?)",
    args: [id, person_id, res_place, res_type || "residence", res_start || null, res_end || null, res_notes || null],
  });
  res.json({ ok: true, id });
});

// DELETE /api/residences/:id
residencesRouter.delete("/:id", async (req, res) => {
  await db.execute({ sql: "DELETE FROM residences WHERE id = ?", args: [req.params.id] });
  res.json({ ok: true });
});
