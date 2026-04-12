import type { Express } from "express";
import { pagesRouter } from "./pages.js";
import { peopleApiRouter } from "./people.js";
import { relationshipsRouter } from "./relationships.js";
import { residencesRouter } from "./residences.js";
import { documentsRouter } from "./documents.js";
import { treeRouter } from "./tree.js";
import { searchRouter } from "./search.js";
import { auth } from "../auth.js";
import { toNodeHandler } from "better-auth/node";

export function registerRoutes(app: Express): void {
  // Better Auth — handles /api/auth/**
  app.all("/api/auth/*splat", toNodeHandler(auth));

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
