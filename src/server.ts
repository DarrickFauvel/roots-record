import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Eta } from "eta";
import { runMigrations, runAuthMigrations } from "./db/migrate.js";
import { seedDemo, seedDemoDocs } from "./lib/seed-demo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

export const app = express();
export const eta = new Eta({
  views: path.join(ROOT, "views"),
  cache: false,
  functionHeader: `const fmtDate = (v) => { if (!v) return ""; const m = String(v).match(/^(\\d{4})-(\\d{2})-(\\d{2})$/); return m ? m[2]+"/"+m[3]+"/"+m[1] : v; }; const fmtYear = (v) => { if (!v) return ""; const s = String(v); const m = s.match(/^(\\d{4})-\\d{2}-\\d{2}$/); if (m) return m[1]; const m2 = s.match(/(\\d{4})$/); return m2 ? m2[1] : s; };`,
});

app.use("/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(ROOT, "public")));

// ── Routes ────────────────────────────────────────────────────────────────────
import { registerRoutes } from "./routes/index.js";
registerRoutes(app);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);

Promise.all([runMigrations(), runAuthMigrations()])
  .then(() => seedDemo())
  .then(() => seedDemoDocs())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Roots Record running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
