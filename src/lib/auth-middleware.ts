import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.redirect("/login");
    return;
  }
  res.locals.session = session;
  res.locals.user = session.user;
  next();
}
