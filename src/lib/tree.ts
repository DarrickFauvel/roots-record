import type { Client } from "@libsql/client";

export interface PersonNode {
  id: string;
  given_name: string;
  middle_name: string | null;
  surname: string | null;
  birth_date: string | null;
  death_date: string | null;
  spouses: { id: string; given_name: string; middle_name: string | null; surname: string | null }[];
  children: PersonNode[];
}

/**
 * Recursively build a descendant tree starting from rootId.
 * Guards against circular relationships via a `visited` set.
 */
export async function buildDescendantTree(
  rootId: string,
  db: Client,
  visited = new Set<string>()
): Promise<PersonNode | null> {
  if (visited.has(rootId)) return null;
  visited.add(rootId);

  const personResult = await db.execute({
    sql: "SELECT id, given_name, middle_name, surname, birth_date, death_date FROM people WHERE id = ?",
    args: [rootId],
  });
  if (personResult.rows.length === 0) return null;
  const row = personResult.rows[0];

  // Fetch spouses
  const spouseResult = await db.execute({
    sql: `SELECT p.id, p.given_name, p.middle_name, p.surname
          FROM relationships r
          JOIN people p ON (
            CASE WHEN r.person1_id = ? THEN r.person2_id ELSE r.person1_id END = p.id
          )
          WHERE r.type = 'spouse' AND (r.person1_id = ? OR r.person2_id = ?)`,
    args: [rootId, rootId, rootId],
  });

  // Fetch children (this person is person1 = parent)
  const childResult = await db.execute({
    sql: `SELECT p.id FROM relationships r
          JOIN people p ON r.person2_id = p.id
          WHERE r.type = 'parent_child' AND r.person1_id = ?`,
    args: [rootId],
  });

  const children: PersonNode[] = [];
  for (const child of childResult.rows) {
    const childNode = await buildDescendantTree(String(child.id), db, visited);
    if (childNode) children.push(childNode);
  }

  return {
    id: String(row.id),
    given_name: String(row.given_name),
    middle_name: row.middle_name ? String(row.middle_name) : null,
    surname: row.surname ? String(row.surname) : null,
    birth_date: row.birth_date ? String(row.birth_date) : null,
    death_date: row.death_date ? String(row.death_date) : null,
    spouses: spouseResult.rows.map((s) => ({
      id: String(s.id),
      given_name: String(s.given_name),
      middle_name: s.middle_name ? String(s.middle_name) : null,
      surname: s.surname ? String(s.surname) : null,
    })),
    children,
  };
}
