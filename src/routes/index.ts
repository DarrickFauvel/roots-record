import type { Express, Request, Response, NextFunction } from "express";
import { pagesRouter } from "./pages.js";
import { peopleApiRouter } from "./people.js";
import { relationshipsRouter } from "./relationships.js";
import { residencesRouter } from "./residences.js";
import { documentsRouter } from "./documents.js";
import { treeRouter } from "./tree.js";
import { searchRouter } from "./search.js";
import { billingRouter } from "./billing.js";
import { adminRouter } from "./admin.js";
import { demoRouter } from "./demo.js";
import { auth } from "../auth.js";
import { toNodeHandler } from "better-auth/node";

function blockDemoWrites(req: Request, res: Response, next: NextFunction): void {
  if (res.locals.isDemo && req.method !== "GET") {
    res.status(403).json({ error: "Demo account is read-only." });
    return;
  }
  next();
}

export function registerRoutes(app: Express): void {
  // Better Auth — handles /api/auth/**
  app.all("/api/auth/*splat", toNodeHandler(auth));

  // Billing (webhook needs raw body — registered before API routes)
  app.use("/", billingRouter);

  // Admin
  app.use("/", adminRouter);

  // Public demo (no auth)
  app.use("/", demoRouter);

  // Block writes for the demo account across all API routes
  app.use("/api", blockDemoWrites);
  app.use("/people", blockDemoWrites);

  // API (SSE + uploads)
  app.use("/api/people", peopleApiRouter);
  app.use("/api/relationships", relationshipsRouter);
  app.use("/api/residences", residencesRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/tree", treeRouter);
  app.use("/api/search", searchRouter);

  // Full-page routes (last so API routes take priority)
  app.use("/", pagesRouter);
}
