import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Eta } from "eta";
import { runMigrations } from "./db/migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

export const app = express();
export const eta = new Eta({ views: path.join(ROOT, "views"), cache: false });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(ROOT, "public")));

// ── Routes ────────────────────────────────────────────────────────────────────
import { registerRoutes } from "./routes/index.js";
registerRoutes(app);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Roots Record running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
