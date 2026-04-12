import type { Response } from "express";
import { eta } from "../server.js";

/**
 * Render a full page: wraps a content view in the layout.
 */
export async function renderPage(
  res: Response,
  view: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const body = await eta.renderAsync(view, data);
  const html = await eta.renderAsync("layout", { ...data, body });
  res.send(html);
}
