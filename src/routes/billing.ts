import { Router } from "express";
import Stripe from "stripe";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth-middleware.js";
import { getUserPlan } from "../lib/plan.js";

export const billingRouter = Router();

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// GET /upgrade — plan comparison page
billingRouter.get("/upgrade", requireAuth, async (_req, res) => {
  const { renderPage } = await import("../lib/render.js");
  const { plan } = await getUserPlan(res.locals.user.id);
  await renderPage(res, "upgrade", {
    title: "Upgrade to Pro — Roots Record",
    user: res.locals.user,
    breadcrumbs: [{ label: "Upgrade" }],
    plan,
  });
});

// POST /billing/checkout — start Stripe Checkout
billingRouter.post("/billing/checkout", requireAuth, async (req, res) => {
  const stripe = getStripe();
  const userId = res.locals.user.id as string;
  const { plan, stripeCustomerId } = await getUserPlan(userId);

  if (plan === "pro") {
    res.redirect("/billing/portal");
    return;
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: stripeCustomerId ?? undefined,
    customer_email: stripeCustomerId ? undefined : (res.locals.user.email as string),
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    client_reference_id: userId,
    success_url: `${baseUrl}/billing/success`,
    cancel_url: `${baseUrl}/upgrade`,
  });

  res.redirect(303, session.url!);
});

// GET /billing/success — post-checkout landing
billingRouter.get("/billing/success", requireAuth, async (_req, res) => {
  res.redirect("/profile?success=billing");
});

// GET /billing/cancel
billingRouter.get("/billing/cancel", requireAuth, async (_req, res) => {
  res.redirect("/upgrade");
});

// GET /billing/portal — Stripe Customer Portal
billingRouter.get("/billing/portal", requireAuth, async (req, res) => {
  const stripe = getStripe();
  const { stripeCustomerId } = await getUserPlan(res.locals.user.id);
  if (!stripeCustomerId) {
    res.redirect("/upgrade");
    return;
  }
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${baseUrl}/profile`,
  });
  res.redirect(303, portalSession.url);
});

// POST /billing/webhook — Stripe events (raw body, no auth)
billingRouter.post("/billing/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  if (!sig) { res.status(400).send("Missing signature"); return; }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (userId && session.customer) {
        await db.execute({
          sql: "UPDATE user SET stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?",
          args: [String(session.customer), String(session.subscription ?? ""), userId],
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const plan = sub.status === "active" || sub.status === "trialing" ? "pro" : "free";
      await db.execute({
        sql: "UPDATE user SET plan = ?, stripe_subscription_id = ? WHERE stripe_customer_id = ?",
        args: [plan, sub.id, String(sub.customer)],
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await db.execute({
        sql: "UPDATE user SET plan = 'free', stripe_subscription_id = NULL WHERE stripe_customer_id = ?",
        args: [String(sub.customer)],
      });
      break;
    }
  }

  res.json({ received: true });
});
