import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { renderPage } from "../lib/render.js";
import { auth } from "../auth.js";
import { eta } from "../server.js";
import { getSignedUrl } from "../lib/cloudinary.js";

export const pagesRouter = Router();

async function renderAuth(res: import("express").Response, view: string, data: object) {
  const body = await eta.renderAsync(view, data);
  const page = await eta.renderAsync("layout", { title: view === "login" ? "Sign In — Roots Record" : "Register — Roots Record", user: null, body });
  res.send(page);
}

// Public routes
pagesRouter.get("/login", async (_req, res) => renderAuth(res, "login", {}));
pagesRouter.get("/register", async (_req, res) => renderAuth(res, "register", {}));

pagesRouter.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const result = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  if (!result.ok) {
    return renderAuth(res, "login", { error: true });
  }
  // Forward Set-Cookie from Better Auth response
  const cookie = result.headers.get("set-cookie");
  if (cookie) res.setHeader("set-cookie", cookie);
  res.redirect("/");
});

pagesRouter.get("/auth/sign-out", async (req, res) => {
  await auth.api.signOut({ headers: (await import("better-auth/node")).fromNodeHeaders(req.headers) });
  res.setHeader("set-cookie", "better-auth.session_token=; Max-Age=0; Path=/");
  res.redirect("/login");
});

pagesRouter.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };
  const result = await auth.api.signUpEmail({ body: { name, email, password }, asResponse: true });
  if (!result.ok) {
    const body = await result.json().catch(() => ({ message: "Registration failed" })) as { message?: string };
    return renderAuth(res, "register", { error: body.message ?? "Registration failed" });
  }
  const cookie = result.headers.get("set-cookie");
  if (cookie) res.setHeader("set-cookie", cookie);
  res.redirect("/");
});

// Root — public landing for guests, dashboard for authenticated users
pagesRouter.get("/", async (req, res) => {
  const { fromNodeHeaders } = await import("better-auth/node");
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

  if (!session) {
    const body = await eta.renderAsync("landing", {});
    const page = await eta.renderAsync("layout", {
      title: "Roots Record — Your Family's Living Archive",
      user: null,
      body,
      breadcrumbs: [],
    });
    res.send(page);
    return;
  }

  res.locals.user = session.user;
  const [peopleCount, relCount, docCount, recent] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM people").then((r) => Number(r.rows[0].c)),
    db.execute("SELECT COUNT(*) as c FROM relationships").then((r) => Number(r.rows[0].c)),
    db.execute("SELECT COUNT(*) as c FROM documents").then((r) => Number(r.rows[0].c)),
    db.execute("SELECT id, given_name, middle_name, surname, birth_date, death_date FROM people ORDER BY created_at DESC LIMIT 10"),
  ]);
  await renderPage(res, "home", {
    title: "Home — Roots Record",
    user: session.user,
    breadcrumbs: [],
    stats: { peopleCount, relationshipCount: relCount, documentCount: docCount },
    recent: recent.rows,
  });
});

pagesRouter.get("/people", requireAuth, async (_req, res) => {
  const result = await db.execute(
    "SELECT id, given_name, middle_name, surname, birth_date, birth_place, death_date, death_place FROM people ORDER BY surname, given_name"
  );
  await renderPage(res, "people/list", {
    title: "People — Roots Record",
    user: res.locals.user,
    breadcrumbs: [{ label: "People" }],
    people: result.rows,
  });
});

pagesRouter.get("/people/new", requireAuth, async (_req, res) => {
  await renderPage(res, "people/form", {
    title: "Add Person — Roots Record",
    user: res.locals.user,
    breadcrumbs: [{ label: "People", href: "/people" }, { label: "Add Person" }],
    person: null,
  });
});

pagesRouter.post("/people/new", requireAuth, async (req, res) => {
  const { given_name, middle_name, surname, maiden_name, sex, birth_date, birth_place, death_date, death_place, death_cause, notes } =
    req.body as Record<string, string>;
  if (!given_name?.trim()) { res.redirect("/people/new"); return; }
  const { nanoid } = await import("nanoid");
  const id = nanoid();
  await db.execute({
    sql: `INSERT INTO people (id, given_name, middle_name, surname, maiden_name, sex, birth_date, birth_place, death_date, death_place, death_cause, notes, created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, given_name.trim(), middle_name?.trim() || null, surname?.trim() || null,
           maiden_name?.trim() || null, sex || "unknown",
           birth_date || null, birth_place?.trim() || null, death_date || null,
           death_place?.trim() || null, death_cause?.trim() || null, notes?.trim() || null,
           res.locals.user.id],
  });
  res.redirect(`/people/${id}`);
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
  const p = result.rows[0];
  const fullName = [p.given_name, p.surname].filter(Boolean).join(" ");
  await renderPage(res, "people/form", {
    title: "Edit Person — Roots Record",
    user: res.locals.user,
    breadcrumbs: [
      { label: "People", href: "/people" },
      { label: fullName, href: `/people/${id}` },
      { label: "Edit" },
    ],
    person: p,
  });
});

pagesRouter.post("/people/:id/edit", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const { given_name, middle_name, surname, maiden_name, sex, birth_date, birth_place, death_date, death_place, death_cause, notes } =
    req.body as Record<string, string>;
  if (!given_name?.trim()) { res.redirect(`/people/${id}/edit`); return; }
  await db.execute({
    sql: `UPDATE people SET given_name=?, middle_name=?, surname=?, maiden_name=?, sex=?,
          birth_date=?, birth_place=?, death_date=?, death_place=?, death_cause=?, notes=?,
          updated_at=datetime('now') WHERE id=?`,
    args: [given_name.trim(), middle_name?.trim() || null, surname?.trim() || null,
           maiden_name?.trim() || null, sex || "unknown",
           birth_date || null, birth_place?.trim() || null, death_date || null,
           death_place?.trim() || null, death_cause?.trim() || null, notes?.trim() || null, id],
  });
  res.redirect(`/people/${id}`);
});

pagesRouter.get("/people/:id", requireAuth, async (req, res) => {
  const pid = String(req.params.id);
  const [personResult, parents, spouses, children, siblings, residences, documents, allPeople] =
    await Promise.all([
      db.execute({ sql: "SELECT * FROM people WHERE id = ?", args: [pid] }),
      db.execute({
        sql: `SELECT p.id, p.given_name, p.middle_name, p.surname, r.id as rel_id
              FROM relationships r JOIN people p ON r.person1_id = p.id
              WHERE r.type = 'parent_child' AND r.person2_id = ?`,
        args: [pid],
      }),
      db.execute({
        sql: `SELECT p.id, p.given_name, p.middle_name, p.surname, r.id as rel_id, r.start_date
              FROM relationships r
              JOIN people p ON (CASE WHEN r.person1_id = ? THEN r.person2_id ELSE r.person1_id END = p.id)
              WHERE r.type = 'spouse' AND (r.person1_id = ? OR r.person2_id = ?)`,
        args: [pid, pid, pid],
      }),
      db.execute({
        sql: `SELECT p.id, p.given_name, p.middle_name, p.surname, r.id as rel_id
              FROM relationships r JOIN people p ON r.person2_id = p.id
              WHERE r.type = 'parent_child' AND r.person1_id = ?`,
        args: [pid],
      }),
      db.execute({
        sql: `SELECT DISTINCT p.id, p.given_name, p.middle_name, p.surname
              FROM relationships r1
              JOIN relationships r2 ON r1.person1_id = r2.person1_id AND r1.type = 'parent_child' AND r2.type = 'parent_child'
              JOIN people p ON r2.person2_id = p.id
              WHERE r1.person2_id = ? AND r2.person2_id != ?`,
        args: [pid, pid],
      }),
      db.execute({ sql: "SELECT * FROM residences WHERE person_id = ? ORDER BY start_date", args: [pid] }),
      db.execute({ sql: "SELECT * FROM documents WHERE person_id = ? ORDER BY created_at DESC", args: [pid] }),
      db.execute("SELECT id, given_name, middle_name, surname FROM people ORDER BY surname, given_name"),
    ]);

  if (personResult.rows.length === 0) {
    res.status(404).send("Person not found");
    return;
  }

  const person = personResult.rows[0];
  const personName = [person.given_name, person.surname].filter(Boolean).join(" ");
  await renderPage(res, "people/profile", {
    title: `${personName} — Roots Record`,
    user: res.locals.user,
    breadcrumbs: [{ label: "People", href: "/people" }, { label: personName }],
    person,
    parents: parents.rows,
    spouses: spouses.rows,
    children: children.rows,
    siblings: siblings.rows,
    residences: residences.rows,
    documents: documents.rows.map((d) => ({
      ...d,
      signed_url: getSignedUrl(String(d.cloudinary_public_id)),
      signed_thumb_url: getSignedUrl(String(d.cloudinary_public_id), "w_200,h_200,c_thumb"),
    })),
    allPeople: allPeople.rows,
  });
});

pagesRouter.get("/tree", requireAuth, async (req, res) => {
  const people = await db.execute(
    "SELECT id, given_name, middle_name, surname, birth_date FROM people ORDER BY surname, given_name"
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
    breadcrumbs: [{ label: "Family Tree" }],
    people: people.rows,
    rootId: rootId ?? null,
    tree,
  });
});
