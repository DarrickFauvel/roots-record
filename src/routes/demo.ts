import { Router } from "express";
import { db } from "../db/client.js";
import { renderPage } from "../lib/render.js";
import { getSignedUrl } from "../lib/cloudinary.js";

export const demoRouter = Router();

const DEMO_EMAIL = "demo@rootsrecord.com";

async function getDemoUserId(): Promise<string | null> {
  const r = await db.execute({ sql: "SELECT id FROM user WHERE email = ?", args: [DEMO_EMAIL] });
  return r.rows[0] ? String(r.rows[0].id) : null;
}

// GET /demo — overview
demoRouter.get("/demo", async (_req, res) => {
  const uid = await getDemoUserId();
  if (!uid) { res.redirect("/"); return; }

  const [peopleCount, relCount, recent] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as c FROM people WHERE created_by = ?", args: [uid] }).then((r) => Number(r.rows[0].c)),
    db.execute({ sql: "SELECT COUNT(*) as c FROM relationships r JOIN people p ON p.id = r.person1_id WHERE p.created_by = ?", args: [uid] }).then((r) => Number(r.rows[0].c)),
    db.execute({ sql: "SELECT id, given_name, middle_name, surname, birth_date, death_date FROM people WHERE created_by = ? ORDER BY birth_date NULLS LAST LIMIT 10", args: [uid] }),
  ]);

  await renderPage(res, "home", {
    title: "Demo — Roots Record",
    user: null,
    breadcrumbs: [],
    isDemo: true,
    stats: { peopleCount, relationshipCount: relCount, documentCount: 0 },
    recent: recent.rows,
  });
});

// GET /demo/people
demoRouter.get("/demo/people", async (_req, res) => {
  const uid = await getDemoUserId();
  if (!uid) { res.redirect("/"); return; }

  const result = await db.execute({
    sql: "SELECT id, given_name, middle_name, surname, birth_date, birth_place, death_date, death_place FROM people WHERE created_by = ? ORDER BY birth_date NULLS LAST",
    args: [uid],
  });
  await renderPage(res, "people/list", {
    title: "Demo — People — Roots Record",
    user: null,
    breadcrumbs: [{ label: "Demo", href: "/demo" }, { label: "People" }],
    isDemo: true,
    people: result.rows,
  });
});

// GET /demo/people/:id
demoRouter.get("/demo/people/:id", async (req, res) => {
  const uid = await getDemoUserId();
  if (!uid) { res.redirect("/"); return; }

  const pid = String(req.params.id);
  const [personResult, parents, spouses, children, siblings, residences, documents] = await Promise.all([
    db.execute({ sql: "SELECT * FROM people WHERE id = ? AND created_by = ?", args: [pid, uid] }),
    db.execute({ sql: `SELECT p.id, p.given_name, p.middle_name, p.surname, r.id as rel_id FROM relationships r JOIN people p ON r.person1_id = p.id WHERE r.type = 'parent_child' AND r.person2_id = ?`, args: [pid] }),
    db.execute({ sql: `SELECT p.id, p.given_name, p.middle_name, p.surname, r.id as rel_id, r.start_date FROM relationships r JOIN people p ON (CASE WHEN r.person1_id = ? THEN r.person2_id ELSE r.person1_id END = p.id) WHERE r.type = 'spouse' AND (r.person1_id = ? OR r.person2_id = ?)`, args: [pid, pid, pid] }),
    db.execute({ sql: `SELECT p.id, p.given_name, p.middle_name, p.surname, r.id as rel_id FROM relationships r JOIN people p ON r.person2_id = p.id WHERE r.type = 'parent_child' AND r.person1_id = ?`, args: [pid] }),
    db.execute({ sql: `SELECT DISTINCT p.id, p.given_name, p.middle_name, p.surname FROM relationships r1 JOIN relationships r2 ON r1.person1_id = r2.person1_id AND r1.type = 'parent_child' AND r2.type = 'parent_child' JOIN people p ON r2.person2_id = p.id WHERE r1.person2_id = ? AND r2.person2_id != ?`, args: [pid, pid] }),
    db.execute({ sql: "SELECT * FROM residences WHERE person_id = ? ORDER BY start_date", args: [pid] }),
    db.execute({ sql: "SELECT * FROM documents WHERE person_id = ? ORDER BY created_at DESC", args: [pid] }),
  ]);

  if (personResult.rows.length === 0) { res.status(404).send("Person not found"); return; }

  const person = personResult.rows[0];
  const personName = [person.given_name, person.surname].filter(Boolean).join(" ");
  await renderPage(res, "people/profile", {
    title: `${personName} — Demo — Roots Record`,
    user: null,
    breadcrumbs: [{ label: "Demo", href: "/demo" }, { label: "People", href: "/demo/people" }, { label: personName }],
    isDemo: true,
    person,
    parents: parents.rows,
    spouses: spouses.rows,
    children: children.rows,
    siblings: siblings.rows,
    residences: residences.rows,
    documents: documents.rows.map((d) => {
      const crop = d.crop_data ? JSON.parse(String(d.crop_data)) : null;
      return {
        ...d,
        signed_url: getSignedUrl(String(d.cloudinary_public_id), undefined, crop),
        signed_thumb_url: getSignedUrl(String(d.cloudinary_public_id), "w_200,h_200,c_thumb", crop),
      };
    }),
    allPeople: [],
  });
});

// GET /demo/tree
demoRouter.get("/demo/tree", async (req, res) => {
  const uid = await getDemoUserId();
  if (!uid) { res.redirect("/"); return; }

  const people = await db.execute({
    sql: "SELECT id, given_name, middle_name, surname, birth_date FROM people WHERE created_by = ? ORDER BY birth_date NULLS LAST",
    args: [uid],
  });

  const demoCookies = Object.fromEntries(
    (_req.headers.cookie ?? '').split(';').flatMap(c => {
      const [k, ...v] = c.trim().split('=');
      return k ? [[decodeURIComponent(k), decodeURIComponent(v.join('='))]] : [];
    })
  );
  const savedRoot = demoCookies['rr-demo-tree-root'];
  const validRoot = savedRoot && people.rows.some(p => String(p.id) === savedRoot) ? savedRoot : null;
  const rootId = validRoot ?? (people.rows[0]?.id ? String(people.rows[0].id) : null);
  let tree = null;
  if (rootId) {
    const { buildDescendantTree } = await import("../lib/tree.js");
    tree = await buildDescendantTree(rootId, db);
  }

  await renderPage(res, "tree/index", {
    title: "Demo — Family Tree — Roots Record",
    user: null,
    breadcrumbs: [{ label: "Demo", href: "/demo" }, { label: "Family Tree" }],
    isDemo: true,
    people: people.rows,
    rootId,
    tree,
  });
});
