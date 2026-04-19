import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../db/client.js";
import { renderPage } from "../lib/render.js";

export const adminRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) { res.status(403).send("Admin not configured."); return; }

  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session || session.user.email !== adminEmail) {
    res.status(403).send("Forbidden.");
    return;
  }
  res.locals.user = session.user;
  next();
}

// GET /admin — dashboard
adminRouter.get("/admin", requireAdmin, async (_req, res) => {
  const [userRows, stats] = await Promise.all([
    db.execute(`
      SELECT
        u.id, u.name, u.email, u.plan, u.createdAt,
        COUNT(DISTINCT p.id) as people_count,
        COUNT(DISTINCT d.id) as doc_count
      FROM user u
      LEFT JOIN people p ON p.created_by = u.id
      LEFT JOIN documents d ON d.uploaded_by = u.id
      GROUP BY u.id
      ORDER BY u.createdAt DESC
    `),
    db.execute(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) as pro_users,
        SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END) as free_users,
        (SELECT COUNT(*) FROM people) as total_people,
        (SELECT COUNT(*) FROM documents) as total_docs
      FROM user
    `),
  ]);

  const s = stats.rows[0];
  await renderPage(res, "admin/dashboard", {
    title: "Admin — Roots Record",
    user: res.locals.user,
    breadcrumbs: [{ label: "Admin" }],
    users: userRows.rows,
    stats: {
      totalUsers: Number(s.total_users ?? 0),
      proUsers: Number(s.pro_users ?? 0),
      freeUsers: Number(s.free_users ?? 0),
      totalPeople: Number(s.total_people ?? 0),
      totalDocs: Number(s.total_docs ?? 0),
    },
  });
});

// POST /admin/users/:id/plan — toggle free ↔ pro
adminRouter.post("/admin/users/:id/plan", requireAdmin, async (req, res) => {
  const userId = String(req.params.id);
  const { plan } = req.body as { plan: string };
  if (plan !== "free" && plan !== "pro") { res.status(400).send("Invalid plan."); return; }
  await db.execute({ sql: "UPDATE user SET plan = ? WHERE id = ?", args: [plan, userId] });
  res.redirect("/admin");
});
