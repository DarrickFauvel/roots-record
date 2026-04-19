import { Router } from "express";
import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { uploadDocument, deleteDocument } from "../lib/cloudinary.js";
import { getUserPlan } from "../lib/plan.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/documents
documentsRouter.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "file is required" }); return; }
  const { person_id, title, doc_type, notes } = req.body as Record<string, string>;
  if (!person_id || !title) { res.status(400).json({ error: "person_id and title are required" }); return; }

  const { plan } = await getUserPlan(res.locals.user.id);
  if (plan !== "pro") {
    res.redirect(`/upgrade?limit=documents&person_id=${person_id}`);
    return;
  }

  // Verify person belongs to this user
  const owns = await db.execute({ sql: "SELECT id FROM people WHERE id = ? AND created_by = ?", args: [person_id, res.locals.user.id] });
  if (owns.rows.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }

  const { public_id, secure_url } = await uploadDocument(req.file.buffer, { folder: `roots-record/${person_id}` });
  const id = nanoid();
  await db.execute({
    sql: `INSERT INTO documents (id, person_id, title, doc_type, cloudinary_public_id, cloudinary_url, notes, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, person_id, title, doc_type || "other", public_id, secure_url, notes || null, res.locals.user.id],
  });
  res.redirect(`/people/${person_id}`);
});

// POST /api/documents/:id/crop
documentsRouter.post("/:id/crop", express.urlencoded({ extended: false }), async (req, res) => {
  const result = await db.execute({
    sql: `SELECT d.id, d.person_id FROM documents d JOIN people p ON p.id = d.person_id WHERE d.id = ? AND p.created_by = ?`,
    args: [req.params.id, res.locals.user.id],
  });
  if (result.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  const { person_id } = result.rows[0];

  let cropData: string | null = null;
  if (req.body.reset !== "1") {
    const x = parseFloat(req.body.x), y = parseFloat(req.body.y);
    const w = parseFloat(req.body.w), h = parseFloat(req.body.h);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
      res.status(400).json({ error: "Invalid crop values" }); return;
    }
    cropData = JSON.stringify({ x, y, w, h });
  }

  await db.execute({ sql: "UPDATE documents SET crop_data = ? WHERE id = ?", args: [cropData, req.params.id] });
  res.redirect(`/people/${person_id}`);
});

// DELETE /api/documents/:id
documentsRouter.delete("/:id", async (req, res) => {
  const result = await db.execute({
    sql: `SELECT d.cloudinary_public_id, d.person_id FROM documents d
          JOIN people p ON p.id = d.person_id
          WHERE d.id = ? AND p.created_by = ?`,
    args: [req.params.id, res.locals.user.id],
  });
  if (result.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  const doc = result.rows[0];
  await deleteDocument(String(doc.cloudinary_public_id));
  await db.execute({ sql: "DELETE FROM documents WHERE id = ?", args: [req.params.id] });
  res.json({ ok: true });
});
