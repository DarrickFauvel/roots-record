import { Router } from "express";
import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/node";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { buildDescendantTree } from "../lib/tree.js";
import { eta } from "../server.js";

export const treeRouter = Router();
treeRouter.use(requireAuth);

// GET /api/tree/:id — SSE stream descendant chart HTML
treeRouter.get("/:id", async (req, res) => {
  const tree = await buildDescendantTree(String(req.params.id), db);
  if (!tree) {
    ServerSentEventGenerator.stream(req, res, (stream) => {
      stream.patchElements(`<div id="tree-container" class="tree-container"><p>Person not found.</p></div>`);
    });
    return;
  }

  const nodeHtml = await eta.renderAsync("partials/tree-node", { node: tree });
  const html = `<ul>${nodeHtml}</ul>`;

  ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="tree-container" class="tree-container">${html}</div>`);
  });
});
