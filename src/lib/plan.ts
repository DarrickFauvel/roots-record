import { db } from "../db/client.js";

export const FREE_PERSON_LIMIT = 50;

export async function getUserPlan(userId: string): Promise<{ plan: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null }> {
  const r = await db.execute({ sql: "SELECT plan, stripe_customer_id, stripe_subscription_id FROM user WHERE id = ?", args: [userId] });
  const row = r.rows[0];
  return {
    plan: String(row?.plan ?? "free"),
    stripeCustomerId: row?.stripe_customer_id ? String(row.stripe_customer_id) : null,
    stripeSubscriptionId: row?.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
  };
}

export async function getPeopleCount(userId: string): Promise<number> {
  const r = await db.execute({ sql: "SELECT COUNT(*) as c FROM people WHERE created_by = ?", args: [userId] });
  return Number(r.rows[0]?.c ?? 0);
}
