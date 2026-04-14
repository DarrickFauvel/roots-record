import { Router } from "express";
import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/node";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { eta } from "../server.js";

export const residencesRouter = Router();
residencesRouter.use(requireAuth);

async function renderResidences(personId: string): Promise<string> {
  const result = await db.execute({
    sql: "SELECT * FROM residences WHERE person_id = ? ORDER BY start_date",
    args: [personId],
  });
  return eta.renderAsync("partials/residences", { residences: result.rows, personId });
}

// POST /api/residences
residencesRouter.post("/", async (req, res) => {
  const { person_id, res_place, res_type, res_start, res_end, res_notes } =
    req.body as Record<string, string>;
  if (!person_id || !res_place) {
    res.status(400).json({ error: "person_id and res_place are required" });
    return;
  }
  await db.execute({
    sql: "INSERT INTO residences (id, person_id, place, type, start_date, end_date, notes) VALUES (?,?,?,?,?,?,?)",
    args: [nanoid(), person_id, res_place, res_type || "residence", res_start || null, res_end || null, res_notes || null],
  });
  const html = await renderResidences(person_id);
  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="residences-section">${html}</div>`);
  });
});

// PUT /api/residences/:id
residencesRouter.put("/:id", async (req, res) => {
  const { edit_res_place, edit_res_type, edit_res_start, edit_res_end } =
    req.body as Record<string, string>;
  if (!edit_res_place) {
    res.status(400).json({ error: "place is required" });
    return;
  }
  const row = await db.execute({ sql: "SELECT person_id FROM residences WHERE id = ?", args: [req.params.id] });
  const personId = row.rows[0]?.person_id as string | undefined;
  if (!personId) { res.status(404).json({ error: "not found" }); return; }
  await db.execute({
    sql: "UPDATE residences SET place=?, type=?, start_date=?, end_date=? WHERE id=?",
    args: [edit_res_place, edit_res_type || "residence", edit_res_start || null, edit_res_end || null, req.params.id],
  });
  const html = await renderResidences(personId);
  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="residences-section">${html}</div>`);
  });
});

// DELETE /api/residences/:id
residencesRouter.delete("/:id", async (req, res) => {
  const row = await db.execute({ sql: "SELECT person_id FROM residences WHERE id = ?", args: [req.params.id] });
  const personId = row.rows[0]?.person_id as string | undefined;
  await db.execute({ sql: "DELETE FROM residences WHERE id = ?", args: [req.params.id] });
  if (!personId) { res.json({ ok: true }); return; }
  const html = await renderResidences(personId);
  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="residences-section">${html}</div>`);
  });
});
