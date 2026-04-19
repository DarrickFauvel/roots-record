import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getUserPlan } from "./plan.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.redirect("/login");
    return;
  }
  res.locals.session = session;
  res.locals.user = session.user;
  const { plan } = await getUserPlan(session.user.id);
  res.locals.plan = plan;
  res.locals.isDemo = session.user.email === "demo@rootsrecord.com";
  next();
}
