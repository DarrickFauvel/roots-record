import { Router } from "express";
import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/node";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { eta } from "../server.js";

export const searchRouter = Router();
searchRouter.use(requireAuth);

// GET /api/search?q=...
searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();

  let rows;
  if (!q) {
    const result = await db.execute(
      "SELECT id, given_name, surname, birth_date, birth_place, death_date, death_place FROM people ORDER BY surname, given_name LIMIT 50"
    );
    rows = result.rows;
  } else {
    // Use FTS5 for full-text search
    const result = await db.execute({
      sql: `SELECT p.id, p.given_name, p.surname, p.birth_date, p.birth_place, p.death_date, p.death_place
            FROM people_fts f
            JOIN people p ON p.id = f.id
            WHERE people_fts MATCH ?
            ORDER BY rank
            LIMIT 50`,
      args: [`${q}*`],
    });
    rows = result.rows;
  }

  const cards = await Promise.all(
    rows.map((p) => eta.renderAsync("partials/person-card", { p }))
  );
  const html = cards.join("\n") || "<li><em>No results found.</em></li>";

  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<ul id="people-list" class="person-list">${html}</ul>`);
  });
});
