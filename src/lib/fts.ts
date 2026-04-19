import { db } from "../db/client.js";

/**
 * Sync one person into the FTS5 index.
 * For content= tables we must use the people table's rowid so tokens align.
 */
export async function syncFts(personId: string): Promise<void> {
  const r = await db.execute({ sql: "SELECT rowid, * FROM people WHERE id = ?", args: [personId] });
  if (r.rows.length === 0) return;
  const p = r.rows[0];
  const rowid = p.rowid;

  // Remove old index entry then re-insert with correct rowid
  await db.batch([
    {
      sql: "INSERT INTO people_fts(people_fts, rowid, id, given_name, surname, birth_place, death_place, notes) VALUES('delete', ?, ?, ?, ?, ?, ?, ?)",
      args: [rowid, p.id, p.given_name, p.surname ?? "", p.birth_place ?? "", p.death_place ?? "", p.notes ?? ""],
    },
    {
      sql: "INSERT INTO people_fts(rowid, id, given_name, surname, birth_place, death_place, notes) VALUES(?, ?, ?, ?, ?, ?, ?)",
      args: [rowid, p.id, p.given_name, p.surname ?? "", p.birth_place ?? "", p.death_place ?? "", p.notes ?? ""],
    },
  ]);
}

/** Full rebuild — use on startup to fix any stale index. */
export async function rebuildFts(): Promise<void> {
  await db.execute(`INSERT INTO people_fts(people_fts) VALUES('rebuild')`);
}
