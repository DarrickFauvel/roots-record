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
  const layoutData = { plan: res.locals.plan ?? null, isDemo: res.locals.isDemo ?? false, ...data, body };
  const html = await eta.renderAsync("layout", layoutData);
  res.send(html);
}
